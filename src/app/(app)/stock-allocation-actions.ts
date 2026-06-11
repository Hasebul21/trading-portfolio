"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeSymbol } from "@/lib/sell-plans";
import {
  validateStockAllocations,
  type StockAllocationRow,
} from "@/lib/stock-allocation-targets";
import { revalidatePath } from "next/cache";

export type StockAllocationsState = {
  rows: StockAllocationRow[];
};

/**
 * Returns the user's saved per-stock allocation targets. The portfolio page
 * builds a `symbol → target_percent` map from these and renders each target
 * beside the stock's current weight within its sector.
 */
export async function getStockAllocations(): Promise<
  { ok: true; data: StockAllocationsState } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase
    .from("stock_allocation_targets")
    .select("symbol, sector, target_percent")
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  const rows: StockAllocationRow[] = (data ?? []).map((r) => ({
    symbol: normalizeSymbol((r as { symbol: unknown }).symbol),
    sector: String((r as { sector: unknown }).sector ?? "").trim(),
    target_percent: Number((r as { target_percent: unknown }).target_percent ?? 0),
  }));

  return { ok: true, data: { rows } };
}

/**
 * Replace the user's full set of per-stock allocation targets. Symbols omitted
 * from `payload` are deleted; symbols present are upserted. Validates each row
 * and deduplicates by upper-cased symbol.
 */
export async function saveStockAllocations(
  payload: ReadonlyArray<{ symbol: string; sector?: string; target_percent: unknown }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validated = validateStockAllocations(payload);
  if (!validated.ok) return validated;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (validated.rows.length > 0) {
    const updated_at = new Date().toISOString();
    const upsertRows = validated.rows.map((r) => ({
      user_id: user.id,
      symbol: r.symbol,
      sector: r.sector,
      target_percent: r.target_percent,
      updated_at,
    }));
    const { error: upErr } = await supabase
      .from("stock_allocation_targets")
      .upsert(upsertRows, { onConflict: "user_id,symbol" });
    if (upErr) return { ok: false, error: upErr.message };
  }

  // Delete anything not in the payload (case-insensitive on symbol).
  const { data: existing, error: fetchErr } = await supabase
    .from("stock_allocation_targets")
    .select("symbol")
    .eq("user_id", user.id);
  if (fetchErr) return { ok: false, error: fetchErr.message };

  const keep = new Set(validated.rows.map((r) => r.symbol));
  const toDelete = (existing ?? [])
    .map((r) => normalizeSymbol((r as { symbol: unknown }).symbol))
    .filter((s) => !keep.has(s));

  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("stock_allocation_targets")
      .delete()
      .eq("user_id", user.id)
      .in("symbol", toDelete);
    if (delErr) return { ok: false, error: delErr.message };
  }

  revalidatePath("/portfolio");
  return { ok: true };
}
