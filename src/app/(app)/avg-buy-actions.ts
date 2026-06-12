"use server";

import { createClient } from "@/lib/supabase/server";

const DHAKA_OFFSET = "+06:00";

export type AvgBuyPriceRow = {
  symbol: string;
  avgPrice: number;
  totalQty: number;
  trades: number;
};

/**
 * Weighted average buy price per symbol for transactions on/after `fromYmd`
 * (Asia/Dhaka calendar). Optionally scoped to a single symbol. Fees are
 * ignored — this is purely sum(qty × price_per_share) / sum(qty) over BUYs.
 */
export async function getAvgBuyPriceSince(
  fromYmd: string,
  symbol?: string | null,
): Promise<{ rows: AvgBuyPriceRow[]; error: string | null }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromYmd)) {
    return { rows: [], error: "Invalid date." };
  }
  const startIso = new Date(
    `${fromYmd}T00:00:00${DHAKA_OFFSET}`,
  ).toISOString();
  const supabase = await createClient();
  let q = supabase
    .from("transactions")
    .select("symbol, quantity, price_per_share")
    .eq("side", "buy")
    .gte("created_at", startIso);
  const trimmed = symbol?.trim().toUpperCase();
  if (trimmed) q = q.eq("symbol", trimmed);
  const { data, error } = await q;
  if (error) return { rows: [], error: error.message };

  type Agg = { totalCost: number; totalQty: number; trades: number };
  const map = new Map<string, Agg>();
  for (const row of data ?? []) {
    const sym = String(row.symbol ?? "")
      .trim()
      .toUpperCase();
    if (!sym) continue;
    const qty = Number(row.quantity);
    const price = Number(row.price_per_share);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) continue;
    const cur = map.get(sym) ?? { totalCost: 0, totalQty: 0, trades: 0 };
    cur.totalCost += qty * price;
    cur.totalQty += qty;
    cur.trades += 1;
    map.set(sym, cur);
  }
  const rows: AvgBuyPriceRow[] = Array.from(map.entries())
    .filter(([, v]) => v.totalQty > 0)
    .map(([sym, v]) => ({
      symbol: sym,
      avgPrice: v.totalCost / v.totalQty,
      totalQty: v.totalQty,
      trades: v.trades,
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  return { rows, error: null };
}

/** Distinct symbols the current user has ever traded — used to populate the
 *  symbol selector in the Avg Buy popup. */
export async function listUserSymbols(): Promise<{
  symbols: string[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("symbol");
  if (error) return { symbols: [], error: error.message };
  const set = new Set<string>();
  for (const row of data ?? []) {
    const s = String(row.symbol ?? "")
      .trim()
      .toUpperCase();
    if (s) set.add(s);
  }
  return { symbols: Array.from(set).sort(), error: null };
}

