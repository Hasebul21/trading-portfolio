import { createClient } from "@/lib/supabase/server";
import { aggregateHoldings, type TransactionRow } from "@/lib/portfolio";
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
    return { error: txRes.error.message, holdings: [] as ReturnType<typeof aggregateHoldings> };
  }

  if (ovRes.error) {
    return { error: ovRes.error, holdings: [] as ReturnType<typeof aggregateHoldings> };
  }

  const ledger = aggregateHoldings((txRes.data ?? []) as TransactionRow[]);
  const holdings = mergeLedgerWithOverrides(ledger, ovRes.rows);

  return { error: null as string | null, holdings };
}
