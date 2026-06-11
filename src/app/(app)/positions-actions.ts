"use server";

import {
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
    executed: Boolean(r.executed),
    created_at: String(r.created_at),
  };
}

/**
 * Load the open buy/sell plans plus the standalone balance. Executed rows from
 * a previous session are purged here first, so a marked row disappears on the
 * next page load (the balance was already moved when it was marked).
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
      .select("id, side, symbol, quantity_shares, target_price, executed, created_at")
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

/** Add a buy or sell plan row. Returns the created row for optimistic insert. */
export async function addPositionPlan(input: {
  side: PositionSide;
  symbol: string;
  quantity_shares: number | string;
  target_price: number | string;
}): Promise<{ ok: true; row: PositionPlanRow } | { ok: false; error: string }> {
  const validated = validatePositionPlan(input);
  if (!validated.ok) return validated;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase
    .from("position_plans")
    .insert({ user_id: user.id, ...validated.row })
    .select("id, side, symbol, quantity_shares, target_price, executed, created_at")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, row: mapRow(data as Record<string, unknown>) };
}

/** Remove a plan row without touching the balance. */
export async function deletePositionPlan(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = id.trim();
  if (!trimmed) return { ok: false, error: "Missing id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("position_plans")
    .delete()
    .eq("id", trimmed)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Mark a plan executed: apply its commission-adjusted amount to the balance
 * immediately (buy deducts, sell adds) and flag the row. The row is left in
 * place so the UI can show it struck-through; it is purged on the next load.
 * Returns the new balance. Idempotent — already-executed rows are a no-op.
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

  const { data: plan, error: planErr } = await supabase
    .from("position_plans")
    .select("side, quantity_shares, target_price, executed")
    .eq("id", trimmed)
    .eq("user_id", user.id)
    .maybeSingle();

  if (planErr) return { ok: false, error: planErr.message };
  if (!plan) return { ok: false, error: "Plan not found." };

  const { data: settings, error: setErr } = await supabase
    .from("user_settings")
    .select("positions_balance_bdt, trade_commission_rate")
    .eq("user_id", user.id)
    .maybeSingle();
  if (setErr) return { ok: false, error: setErr.message };

  const currentBalance = Number(settings?.positions_balance_bdt ?? 0);

  // Already executed → balance unchanged, just report current.
  if ((plan as { executed?: unknown }).executed) {
    return { ok: true, balance: currentBalance };
  }

  const delta = planBalanceDelta(
    (plan as { side: PositionSide }).side,
    Number((plan as { quantity_shares: unknown }).quantity_shares),
    Number((plan as { target_price: unknown }).target_price),
    settings?.trade_commission_rate === null || settings?.trade_commission_rate === undefined
      ? null
      : Number(settings.trade_commission_rate),
  );
  const newBalance = Math.round((currentBalance + delta) * 100) / 100;

  const { error: updErr } = await supabase
    .from("user_settings")
    .update({ positions_balance_bdt: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (updErr) return { ok: false, error: updErr.message };

  const { error: flagErr } = await supabase
    .from("position_plans")
    .update({ executed: true })
    .eq("id", trimmed)
    .eq("user_id", user.id);
  if (flagErr) return { ok: false, error: flagErr.message };

  return { ok: true, balance: newBalance };
}
