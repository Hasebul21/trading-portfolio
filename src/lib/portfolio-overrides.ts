import type { SupabaseClient } from "@supabase/supabase-js";
import type { HoldingRow } from "@/lib/portfolio";
import { calculateBreakEvenPrice, sortHoldingsByTotalInvestedDesc } from "@/lib/portfolio";

export type PositionOverrideRow = {
  symbol: string;
  shares: number;
  avg_price_bdt: number;
  total_cost_bdt: number;
};

export function mergeLedgerWithOverrides(
  ledger: HoldingRow[],
  overrides: PositionOverrideRow[],
): HoldingRow[] {
  const bySym = new Map<string, HoldingRow>(ledger.map((h) => [h.symbol, { ...h }]));

  for (const raw of overrides) {
    const sym = raw.symbol.trim().toUpperCase();
    if (!sym) continue;
    const shares = Number(raw.shares);
    const totalCost = Number(raw.total_cost_bdt);
    const avgPrice = Number(raw.avg_price_bdt);
    if (!(shares > 0) || !Number.isFinite(totalCost) || !Number.isFinite(avgPrice)) continue;

    const base = bySym.get(sym);
    // Overrides are meant to adjust existing open ledger positions only.
    // If a symbol is fully sold, ignore any stale override row for it.
    if (!base || !(base.shares > 0)) continue;
    bySym.set(sym, {
      symbol: sym,
      shares,
      totalCost,
      avgPrice,
      breakEvenPrice: calculateBreakEvenPrice(avgPrice),
      category: base?.category ?? null,
      feesInPositionBdt: 0,
    });
  }

  return sortHoldingsByTotalInvestedDesc(
    [...bySym.values()].filter((h) => h.shares > 0),
  );
}

export function tripletMatchesLedger(
  shares: number,
  avgPrice: number,
  totalCost: number,
  ledger: HoldingRow,
): boolean {
  return (
    nearlyEqual(shares, ledger.shares) &&
    nearlyEqual(avgPrice, ledger.avgPrice) &&
    nearlyEqual(totalCost, ledger.totalCost)
  );
}

export function nearlyEqual(a: number, b: number, eps = 0.02): boolean {
  return Math.abs(a - b) <= eps;
}

/** Basic checks only; total and average may differ (e.g. fees, rounding). */
export function validateCostTriplet(shares: number, avgPrice: number, totalCost: number): string | null {
  if (!(shares > 0) || !Number.isFinite(shares)) {
    return "Shares must be a positive number.";
  }
  if (!Number.isFinite(avgPrice) || avgPrice < 0) {
    return "Average cost must be zero or greater.";
  }
  if (!Number.isFinite(totalCost) || totalCost < 0) {
    return "Total invested must be zero or greater.";
  }
  return null;
}

export async function fetchPositionOverrides(
  supabase: SupabaseClient,
): Promise<{ rows: PositionOverrideRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("portfolio_position_overrides")
    .select("symbol, shares, avg_price_bdt, total_cost_bdt");

  if (error) {
    return { rows: [], error: error.message };
  }

  const rows: PositionOverrideRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
    symbol: String(r.symbol ?? "").trim().toUpperCase(),
    shares: Number(r.shares),
    avg_price_bdt: Number(r.avg_price_bdt),
    total_cost_bdt: Number(r.total_cost_bdt),
  }));

  return { rows, error: null };
}
