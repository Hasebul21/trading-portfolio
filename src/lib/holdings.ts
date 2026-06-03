import { createClient } from "@/lib/supabase/server";
import {
  aggregateHoldings,
  totalInvestedBdt,
  totalRealizedProfitLossBdt,
  type TransactionRow,
} from "@/lib/portfolio";
import { fetchPositionOverrides, mergeLedgerWithOverrides } from "@/lib/portfolio-overrides";
import { cache } from "react";

export const fetchUserHoldings = cache(async () => {
  const supabase = await createClient();
  const [txRes, ovRes, caRes, divRes] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, created_at, symbol, side, quantity, price_per_share, category, fees_bdt",
      )
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    fetchPositionOverrides(supabase),
    supabase.from("cash_adjustments").select("amount_bdt"),
    supabase.from("dividends").select("cash_dividend_bdt"),
  ]);

  if (txRes.error) {
    return {
      error: txRes.error.message,
      holdings: [] as ReturnType<typeof aggregateHoldings>,
      totalRealizedBdt: 0,
      totalInvestedBdt: 0,
      totalCashAdjustmentsBdt: 0,
      totalCashDividendsBdt: 0,
    };
  }

  if (ovRes.error) {
    return {
      error: ovRes.error,
      holdings: [] as ReturnType<typeof aggregateHoldings>,
      totalRealizedBdt: 0,
      totalInvestedBdt: 0,
      totalCashAdjustmentsBdt: 0,
      totalCashDividendsBdt: 0,
    };
  }

  const txRows = (txRes.data ?? []) as TransactionRow[];
  const ledger = aggregateHoldings(txRows);
  const holdings = mergeLedgerWithOverrides(ledger, ovRes.rows);
  const totalRealizedBdt = totalRealizedProfitLossBdt(txRows);
  // Invested capital reflects only active holdings (after merging any user
  // overrides). Sums the same `totalCost` numbers that the holdings table
  // displays, so header total and per-row column always agree.
  const totalInvested = totalInvestedBdt(holdings);

  // `cash_adjustments` may not yet exist on older databases; tolerate the
  // missing-table error so the rest of the portfolio still renders. Manual
  // adjustments (deposits/withdrawals) flow into Unrealized P/L. Cash dividends
  // from /dividend are tracked separately and roll into Net P/L instead.
  let totalCashAdjustmentsBdt = 0;
  if (!caRes.error) {
    for (const row of (caRes.data ?? []) as { amount_bdt: number | string | null }[]) {
      const n = typeof row.amount_bdt === "number" ? row.amount_bdt : Number(row.amount_bdt ?? 0);
      if (Number.isFinite(n)) totalCashAdjustmentsBdt += n;
    }
  }
  totalCashAdjustmentsBdt = Math.round(totalCashAdjustmentsBdt * 100) / 100;

  let totalCashDividendsBdt = 0;
  if (!divRes.error) {
    for (const row of (divRes.data ?? []) as { cash_dividend_bdt: number | string | null }[]) {
      const n =
        typeof row.cash_dividend_bdt === "number"
          ? row.cash_dividend_bdt
          : Number(row.cash_dividend_bdt ?? 0);
      if (Number.isFinite(n)) totalCashDividendsBdt += n;
    }
  }
  totalCashDividendsBdt = Math.round(totalCashDividendsBdt * 100) / 100;

  return {
    error: null as string | null,
    holdings,
    totalRealizedBdt,
    totalInvestedBdt: totalInvested,
    totalCashAdjustmentsBdt,
    totalCashDividendsBdt,
  };
});
