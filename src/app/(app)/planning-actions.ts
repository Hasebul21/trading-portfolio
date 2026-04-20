"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchDseLspQuoteMapFresh } from "@/lib/market/dse-lsp-quotes";
import { zoneLevelsFromLspQuote } from "@/lib/market/dse-zone-levels";
import { revalidatePath } from "next/cache";

function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase();
}

export async function addCapitalContribution(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const amount = Number(String(formData.get("amount_bdt") ?? "").trim());
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!Number.isFinite(amount) || amount <= 0) return;

  await supabase.from("capital_contributions").insert({
    user_id: user.id,
    amount_bdt: amount,
    note,
  });

  revalidatePath("/invested");
}

export async function deleteCapitalContribution(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await supabase
    .from("capital_contributions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/invested");
}

export async function addLongTermHolding(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const symbol = normalizeSymbol(String(formData.get("symbol") ?? ""));

  if (!symbol) return { ok: false, error: "Enter a symbol." };

  const { data: dup } = await supabase
    .from("long_term_holdings")
    .select("id")
    .eq("user_id", user.id)
    .ilike("symbol", symbol)
    .limit(1)
    .maybeSingle();

  if (dup) {
    return { ok: false, error: `${symbol} is already in your long-term list.` };
  }

  const lsp = await fetchDseLspQuoteMapFresh();
  const quote = lsp.bySymbol.get(symbol);
  if (!quote) {
    const hint = lsp.error
      ? ` DSE price table: ${lsp.error}`
      : " No row for this code in today’s DSE latest-price table.";
    return {
      ok: false,
      error: `Could not load live session high/low/close for ${symbol}.${hint}`,
    };
  }

  const zones = zoneLevelsFromLspQuote(quote);
  if (!zones) {
    return { ok: false, error: `Could not compute zones for ${symbol} (invalid high/low/close).` };
  }

  const { error } = await supabase.from("long_term_holdings").insert({
    user_id: user.id,
    symbol,
    notes: null,
    buy_point_bdt: zones.firstBuyZone,
    sell_point_bdt: zones.sellZoneBlend,
  });

  if (error) {
    console.error("addLongTermHolding", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/long-term");
  return { ok: true };
}

export async function deleteLongTermHolding(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await supabase
    .from("long_term_holdings")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/long-term");
}

export type LongTermRowSavePayload = {
  id: string;
  /** Used to refresh DSE zone columns from the same LSP snapshot as the portfolio page. */
  symbol: string;
  manual_avg_cost_bdt: number | null;
  manual_total_invested_bdt: number | null;
};

function sanitizeLongTermNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Persist all long-term rows in one action (used by table-level Save). */
export async function saveLongTermTable(
  updates: LongTermRowSavePayload[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  if (!Array.isArray(updates) || updates.length === 0) {
    return { ok: true };
  }

  const lsp = await fetchDseLspQuoteMapFresh();

  for (const u of updates) {
    const id = String(u.id ?? "").trim();
    if (!id) continue;

    const sym = normalizeSymbol(String(u.symbol ?? ""));
    const manual_avg_cost_bdt = sanitizeLongTermNumber(u.manual_avg_cost_bdt);
    const manual_total_invested_bdt = sanitizeLongTermNumber(u.manual_total_invested_bdt);

    const quote = sym ? lsp.bySymbol.get(sym) : undefined;
    const zones = quote ? zoneLevelsFromLspQuote(quote) : null;

    const patch: Record<string, unknown> = {
      manual_avg_cost_bdt,
      manual_total_invested_bdt,
    };
    if (zones) {
      patch.buy_point_bdt = zones.firstBuyZone;
      patch.sell_point_bdt = zones.sellZoneBlend;
    }

    const { error } = await supabase
      .from("long_term_holdings")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("saveLongTermTable", error.message);
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/long-term");
  return { ok: true };
}

export async function addTradePlan(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const symbol = normalizeSymbol(String(formData.get("symbol") ?? ""));
  const side = String(formData.get("side") ?? "").toLowerCase();
  const priceRaw = String(formData.get("target_price") ?? "").trim();
  const targetPrice = Number(priceRaw);

  if (!symbol) return;
  if (side !== "buy" && side !== "sell") return;
  if (!Number.isFinite(targetPrice) || targetPrice < 0) return;

  await supabase.from("immediate_trade_plans").insert({
    user_id: user.id,
    symbol,
    side,
    target_price: targetPrice,
    notes: null,
  });

  revalidatePath("/trade-plans");
}

export async function deleteTradePlan(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await supabase
    .from("immediate_trade_plans")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/trade-plans");
}
