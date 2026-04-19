import { createClient } from "@/lib/supabase/server";
import type { TransactionRow } from "@/lib/portfolio";

export async function fetchAllUserTransactions(): Promise<{
  rows: TransactionRow[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("transactions")
    .select(
      "id, created_at, symbol, side, quantity, price_per_share, category, fees_bdt",
    )
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return { rows: [], error: error.message };
  }
  return { rows: (rows ?? []) as TransactionRow[], error: null };
}

/** Newest first (then id for stable tie-break). */
export function sortTransactionsByLatest(
  rows: readonly TransactionRow[],
): TransactionRow[] {
  return [...rows].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (tb !== ta) return tb - ta;
    return b.id.localeCompare(a.id);
  });
}

const DHAKA_OFFSET = "+06:00";

export function filterTransactionsLastNDays(
  rows: readonly TransactionRow[],
  days: number,
): TransactionRow[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const filtered = rows.filter(
    (r) => new Date(r.created_at).getTime() >= cutoff,
  );
  return sortTransactionsByLatest(filtered);
}

/** `ymd` is `YYYY-MM-DD` interpreted as Asia/Dhaka calendar date. */
export function filterTransactionsDhakaCalendarDay(
  rows: readonly TransactionRow[],
  ymd: string,
): TransactionRow[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return [];
  const start = new Date(`${ymd}T00:00:00${DHAKA_OFFSET}`).getTime();
  const end = new Date(`${ymd}T23:59:59.999${DHAKA_OFFSET}`).getTime();
  const filtered = rows.filter((r) => {
    const t = new Date(r.created_at).getTime();
    return t >= start && t <= end;
  });
  return sortTransactionsByLatest(filtered);
}
