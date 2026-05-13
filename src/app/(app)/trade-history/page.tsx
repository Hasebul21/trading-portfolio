import { realizedPnlByTransaction } from "@/lib/portfolio";
import {
  fetchAllUserTransactions,
  filterTransactionsDhakaCalendarDay,
  filterTransactionsLastNDays,
} from "@/lib/user-transactions";
import { TradeHistorySection } from "./trade-history-section";

type PageProps = {
  searchParams: Promise<{ day?: string }>;
};

export default async function TradeHistoryPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const dayParam =
    typeof sp.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.day)
      ? sp.day
      : null;

  const txRes = await fetchAllUserTransactions();
  const pnlById = realizedPnlByTransaction(txRes.rows);
  const historyRows = dayParam
    ? filterTransactionsDhakaCalendarDay(txRes.rows, dayParam)
    : filterTransactionsLastNDays(txRes.rows, 7);
  const pnlForRows = Object.fromEntries(
    historyRows
      .map((r) => [r.id, pnlById.get(r.id)] as const)
      .filter(([, v]) => typeof v === "number"),
  ) as Record<string, number>;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl text-left">
      <TradeHistorySection
        key={dayParam ?? "last-7-days"}
        rows={historyRows}
        pnlById={pnlForRows}
        loadError={txRes.error}
      />
    </div>
  );
}
