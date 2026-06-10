import { roundBdt, type HoldingRow } from "@/lib/portfolio";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reconcile a watchlist row (`long_term_holdings`) with the post-transaction
 * ledger for one symbol. Centralises the rule used by `recordTransaction`,
 * `deleteTransaction`, and the PDF importer so the watchlist's "tracked
 * amount" never drifts from the actual portfolio book.
 *
 * Rules:
 * 1. If the user holds nothing for this symbol after the change, both manual
 *    cost overrides are cleared so the row no longer shows stale figures for
 *    shares we don't own.
 * 2. Otherwise, if the user has set `manual_total_invested_bdt` *and* it is
 *    higher than the new ledger book value, snap it down to ledger book value
 *    (selling can only reduce invested capital, never increase it).
 *    `manual_avg_cost_bdt` is left alone — partial sells with cost-basis
 *    deduction don't change the average price.
 */
export async function syncWatchlistAfterLedgerChange(
  supabase: SupabaseClient,
  userId: string,
  symbol: string,
  newLedger: HoldingRow[],
): Promise<void> {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return;

  const remaining = newLedger.find((h) => h.symbol === sym);
  const remainingShares = remaining?.shares ?? 0;
  const newBook = remaining?.totalCost ?? 0;

  const { data: ltRow } = await supabase
    .from("long_term_holdings")
    .select("id, manual_avg_cost_bdt, manual_total_invested_bdt")
    .eq("user_id", userId)
    .ilike("symbol", sym)
    .maybeSingle();

  if (!ltRow) return;

  const patch: Record<string, number | null> = {};

  if (remainingShares <= 0) {
    if (ltRow.manual_avg_cost_bdt !== null) patch.manual_avg_cost_bdt = null;
    if (ltRow.manual_total_invested_bdt !== null) patch.manual_total_invested_bdt = null;
  } else if (ltRow.manual_total_invested_bdt !== null) {
    const currentManual = Number(ltRow.manual_total_invested_bdt);
    if (Number.isFinite(currentManual) && currentManual > newBook) {
      patch.manual_total_invested_bdt = roundBdt(newBook);
    }
  }

  if (Object.keys(patch).length === 0) return;

  await supabase
    .from("long_term_holdings")
    .update(patch)
    .eq("id", ltRow.id)
    .eq("user_id", userId);
}
