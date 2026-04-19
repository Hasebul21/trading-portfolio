import { createClient } from "@/lib/supabase/server";
import {
  aggregateHoldings,
  sortHoldingsByTotalInvestedDesc,
  type TransactionRow,
} from "@/lib/portfolio";

export async function fetchUserHoldings() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("transactions")
    .select(
      "id, created_at, symbol, side, quantity, price_per_share, category, fees_bdt",
    )
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return { error: error.message, holdings: [] as ReturnType<typeof aggregateHoldings> };
  }

  const holdings = sortHoldingsByTotalInvestedDesc(
    aggregateHoldings((rows ?? []) as TransactionRow[]),
  );
  return { error: null as string | null, holdings };
}
