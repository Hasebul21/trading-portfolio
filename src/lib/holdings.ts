import { createClient } from "@/lib/supabase/server";
import {
  aggregateHoldings,
  totalRealizedProfitLossBdt,
  type TransactionRow,
} from "@/lib/portfolio";
import { fetchPositionOverrides, mergeLedgerWithOverrides } from "@/lib/portfolio-overrides";

export async function fetchUserHoldings() {
  const supabase = await createClient();
  const [txRes, ovRes] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, created_at, symbol, side, quantity, price_per_share, category, fees_bdt",
      )
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    fetchPositionOverrides(supabase),
  ]);

  if (txRes.error) {
    return {
      error: txRes.error.message,
      holdings: [] as ReturnType<typeof aggregateHoldings>,
      totalRealizedBdt: 0,
    };
  }

  if (ovRes.error) {
    return {
      error: ovRes.error,
      holdings: [] as ReturnType<typeof aggregateHoldings>,
      totalRealizedBdt: 0,
    };
  }

  const txRows = (txRes.data ?? []) as TransactionRow[];
  const ledger = aggregateHoldings(txRows);
  const holdings = mergeLedgerWithOverrides(ledger, ovRes.rows);
  const totalRealizedBdt = totalRealizedProfitLossBdt(txRows);

  return { error: null as string | null, holdings, totalRealizedBdt };
}
