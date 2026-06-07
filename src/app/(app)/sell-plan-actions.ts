"use server";

import { fetchDseLspQuoteMapFresh } from "@/lib/market/dse-lsp-quotes";
import {
  normalizeSymbol,
  validateSellPlans,
  type SellPlanRow,
} from "@/lib/sell-plans";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type SellPlanState = {
  rows: SellPlanRow[];
};

/**
 * Returns the user's saved sell-plan rows, ordered by symbol. Empty when the
 * user has not set any yet.
 */
export async function getSellPlans(): Promise<
  { ok: true; data: SellPlanState } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase
    .from("sell_plans")
    .select("symbol, quantity_shares")
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  const rows: SellPlanRow[] = (data ?? []).map((r) => ({
    symbol: normalizeSymbol((r as { symbol: unknown }).symbol),
    quantity_shares: Number((r as { quantity_shares: unknown }).quantity_shares ?? 0),
  }));

  rows.sort((a, b) => a.symbol.localeCompare(b.symbol));

  return { ok: true, data: { rows } };
}

/**
 * Replace the user's full sell plan. Symbols omitted from `payload` are
 * deleted; symbols present are upserted. Validates and deduplicates each row.
 */
export async function saveSellPlans(
  payload: ReadonlyArray<{ symbol: string; quantity_shares: unknown }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validated = validateSellPlans(payload);
  if (!validated.ok) return validated;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Upsert what we have.
  if (validated.rows.length > 0) {
    const updated_at = new Date().toISOString();
    const upsertRows = validated.rows.map((r) => ({
      user_id: user.id,
      symbol: r.symbol,
      quantity_shares: r.quantity_shares,
      updated_at,
    }));
    const { error: upErr } = await supabase
      .from("sell_plans")
      .upsert(upsertRows, { onConflict: "user_id,symbol" });
    if (upErr) return { ok: false, error: upErr.message };
  }

  // Delete anything not in the payload.
  const { data: existing, error: fetchErr } = await supabase
    .from("sell_plans")
    .select("symbol")
    .eq("user_id", user.id);
  if (fetchErr) return { ok: false, error: fetchErr.message };

  const keep = new Set(validated.rows.map((r) => r.symbol));
  const toDelete = (existing ?? [])
    .map((r) => normalizeSymbol((r as { symbol: unknown }).symbol))
    .filter((s) => !keep.has(s));

  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("sell_plans")
      .delete()
      .eq("user_id", user.id)
      .in("symbol", toDelete);
    if (delErr) return { ok: false, error: delErr.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Live last-traded prices for the given symbols, bypassing the cache so the
 * sell plan can recompute proceeds against the latest market price. Returns a
 * plain `{ SYMBOL: ltp }` map for symbols that have a published price.
 */
export async function fetchSellPlanLtps(
  rawSymbols: ReadonlyArray<string>,
): Promise<{ ltpBySymbol: Record<string, number>; error: string | null }> {
  const symbols = Array.from(
    new Set(rawSymbols.map((s) => normalizeSymbol(s)).filter(Boolean)),
  );
  if (symbols.length === 0) return { ltpBySymbol: {}, error: null };

  const { bySymbol, error } = await fetchDseLspQuoteMapFresh();
  const ltpBySymbol: Record<string, number> = {};
  for (const symbol of symbols) {
    const quote = bySymbol.get(symbol);
    if (quote && Number.isFinite(quote.ltp)) {
      ltpBySymbol[symbol] = quote.ltp;
    }
  }
  return { ltpBySymbol, error };
}
