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
  const historyRows = dayParam
    ? filterTransactionsDhakaCalendarDay(txRes.rows, dayParam)
    : filterTransactionsLastNDays(txRes.rows, 7);

  return (
    <div className="mx-auto max-w-5xl text-left">
      <TradeHistorySection
        key={dayParam ?? "last-7-days"}
        rows={historyRows}
        loadError={txRes.error}
      />
    </div>
  );
}
