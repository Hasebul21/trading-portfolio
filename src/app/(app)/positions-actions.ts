"use server";

import {
  normalizeBrokerage,
  normalizeSymbol,
  planBalanceDelta,
  validatePositionPlan,
  type PositionPlanRow,
  type PositionSide,
} from "@/lib/positions";
import { createClient } from "@/lib/supabase/server";

export type PositionsState = {
  buy: PositionPlanRow[];
  sell: PositionPlanRow[];
  balance: number;
  commissionRate: number | null;
};

function mapRow(r: Record<string, unknown>): PositionPlanRow {
  return {
    id: String(r.id),
    side: (r.side === "sell" ? "sell" : "buy") as PositionSide,
    symbol: normalizeSymbol(r.symbol),
    quantity_shares: Number(r.quantity_shares ?? 0),
    target_price: Number(r.target_price ?? 0),
    brokerage: normalizeBrokerage(r.brokerage),
    executed: Boolean(r.executed),
    created_at: String(r.created_at),
  };
}

/**
 * Load the open buy/sell plans plus the standalone balance. Executed rows from
 * a previous session are purged here first, so a marked row disappears on the
 * next page load (the balance was already moved when the row was added).
 */
export async function getPositions(): Promise<
  { ok: true; data: PositionsState } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Purge any rows marked executed before this load.
  await supabase
    .from("position_plans")
    .delete()
    .eq("user_id", user.id)
    .eq("executed", true);

  const [plansRes, settingsRes] = await Promise.all([
    supabase
      .from("position_plans")
      .select("id, side, symbol, quantity_shares, target_price, brokerage, executed, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("user_settings")
      .select("positions_balance_bdt, trade_commission_rate")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (plansRes.error) return { ok: false, error: plansRes.error.message };
  if (settingsRes.error) return { ok: false, error: settingsRes.error.message };

  const rows = (plansRes.data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  const settings = (settingsRes.data ?? {}) as Record<string, unknown>;

  return {
    ok: true,
    data: {
      buy: rows.filter((r) => r.side === "buy"),
      sell: rows.filter((r) => r.side === "sell"),
      balance: Number(settings.positions_balance_bdt ?? 0),
      commissionRate:
        settings.trade_commission_rate === null || settings.trade_commission_rate === undefined
          ? null
          : Number(settings.trade_commission_rate),
    },
  };
}

/** Read the balance + commission rate for the signed-in user. */
async function readBalanceAndRate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ balance: number; rate: number | null; error?: string }> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("positions_balance_bdt, trade_commission_rate")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { balance: 0, rate: null, error: error.message };
  return {
    balance: Number(data?.positions_balance_bdt ?? 0),
    rate:
      data?.trade_commission_rate === null || data?.trade_commission_rate === undefined
        ? null
        : Number(data.trade_commission_rate),
  };
}

async function writeBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  balance: number,
): Promise<string | null> {
  const { error } = await supabase
    .from("user_settings")
    .update({ positions_balance_bdt: balance, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  return error ? error.message : null;
}

/**
 * Add a buy or sell plan row and apply its commission-adjusted amount to the
 * balance right away: a sell adds its proceeds, a buy deducts its cost. Returns
 * the created row and the new balance.
 */
export async function addPositionPlan(input: {
  side: PositionSide;
  symbol: string;
  quantity_shares: number | string;
  target_price: number | string;
  brokerage: string;
}): Promise<
  { ok: true; row: PositionPlanRow; balance: number } | { ok: false; error: string }
> {
  const validated = validatePositionPlan({
    side: input.side,
    symbol: input.symbol,
    quantity_shares: input.quantity_shares,
    target_price: input.target_price,
    brokerage: input.brokerage,
  });
  if (!validated.ok) return validated;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const settings = await readBalanceAndRate(supabase, user.id);
  if (settings.error) return { ok: false, error: settings.error };

  const { data, error } = await supabase
    .from("position_plans")
    .insert({ user_id: user.id, ...validated.row })
    .select("id, side, symbol, quantity_shares, target_price, executed, created_at")
    .single();
  if (error) return { ok: false, error: error.message };

  const delta = planBalanceDelta(
    validated.row.side,
    validated.row.quantity_shares,
    validated.row.target_price,
    settings.rate,
  );
  const newBalance = Math.round((settings.balance + delta) * 100) / 100;
  const writeErr = await writeBalance(supabase, user.id, newBalance);
  if (writeErr) return { ok: false, error: writeErr };

  return { ok: true, row: mapRow(data as Record<string, unknown>), balance: newBalance };
}

/**
 * Edit a plan row (symbol / quantity / target price) and adjust the balance by
 * the difference between the row's new and old commission-adjusted amounts, so
 * the total reflects the updated values. The side is preserved. Returns the
 * updated row and the new balance.
 */
export async function updatePositionPlan(input: {
  id: string;
  symbol: string;
  quantity_shares: number | string;
  target_price: number | string;
  brokerage: string;
}): Promise<
  { ok: true; row: PositionPlanRow; balance: number } | { ok: false; error: string }
> {
  const id = input.id.trim();
  if (!id) return { ok: false, error: "Missing id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: existing, error: fetchErr } = await supabase
    .from("position_plans")
    .select("side, quantity_shares, target_price")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!existing) return { ok: false, error: "Plan not found." };

  const side = (existing as { side: PositionSide }).side;
  const validated = validatePositionPlan({
    side,
    symbol: input.symbol,
    quantity_shares: input.quantity_shares,
    target_price: input.target_price,
    brokerage: input.brokerage,
  });
  if (!validated.ok) return validated;

  const settings = await readBalanceAndRate(supabase, user.id);
  if (settings.error) return { ok: false, error: settings.error };

  const oldDelta = planBalanceDelta(
    side,
    Number((existing as { quantity_shares: unknown }).quantity_shares),
    Number((existing as { target_price: unknown }).target_price),
    settings.rate,
  );
  const newDelta = planBalanceDelta(
    side,
    validated.row.quantity_shares,
    validated.row.target_price,
    settings.rate,
  );

  const { data, error } = await supabase
    .from("position_plans")
    .update({
      symbol: validated.row.symbol,
      quantity_shares: validated.row.quantity_shares,
      target_price: validated.row.target_price,
      brokerage: validated.row.brokerage,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, side, symbol, quantity_shares, target_price, executed, created_at")
    .single();
  if (error) return { ok: false, error: error.message };

  const newBalance = Math.round((settings.balance + (newDelta - oldDelta)) * 100) / 100;
  const writeErr = await writeBalance(supabase, user.id, newBalance);
  if (writeErr) return { ok: false, error: writeErr };

  return { ok: true, row: mapRow(data as Record<string, unknown>), balance: newBalance };
}

/**
 * Remove a plan row and reverse its effect on the balance (cancel the plan): a
 * removed sell takes its proceeds back out, a removed buy refunds its cost.
 * Returns the new balance.
 */
export async function deletePositionPlan(
  id: string,
): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  const trimmed = id.trim();
  if (!trimmed) return { ok: false, error: "Missing id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: plan, error: planErr } = await supabase
    .from("position_plans")
    .select("side, quantity_shares, target_price")
    .eq("id", trimmed)
    .eq("user_id", user.id)
    .maybeSingle();
  if (planErr) return { ok: false, error: planErr.message };

  const settings = await readBalanceAndRate(supabase, user.id);
  if (settings.error) return { ok: false, error: settings.error };

  const { error: delErr } = await supabase
    .from("position_plans")
    .delete()
    .eq("id", trimmed)
    .eq("user_id", user.id);
  if (delErr) return { ok: false, error: delErr.message };

  // Reverse the amount this row had applied when it was added.
  if (!plan) return { ok: true, balance: settings.balance };
  const delta = planBalanceDelta(
    (plan as { side: PositionSide }).side,
    Number((plan as { quantity_shares: unknown }).quantity_shares),
    Number((plan as { target_price: unknown }).target_price),
    settings.rate,
  );
  const newBalance = Math.round((settings.balance - delta) * 100) / 100;
  const writeErr = await writeBalance(supabase, user.id, newBalance);
  if (writeErr) return { ok: false, error: writeErr };

  return { ok: true, balance: newBalance };
}

/**
 * Mark a plan as executed. The balance was already moved when the row was
 * added, so this only flags the row (shown struck-through) — it is purged on
 * the next page load. Returns the unchanged balance to keep the client in sync.
 */
export async function markPositionPlan(
  id: string,
): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  const trimmed = id.trim();
  if (!trimmed) return { ok: false, error: "Missing id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const settings = await readBalanceAndRate(supabase, user.id);
  if (settings.error) return { ok: false, error: settings.error };

  const { error } = await supabase
    .from("position_plans")
    .update({ executed: true })
    .eq("id", trimmed)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  return { ok: true, balance: settings.balance };
}
