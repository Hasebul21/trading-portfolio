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
  const detailsById = realizedPnlByTransaction(txRes.rows);
  const historyRows = dayParam
    ? filterTransactionsDhakaCalendarDay(txRes.rows, dayParam)
    : filterTransactionsLastNDays(txRes.rows, 7);
  const pnlForRows = Object.fromEntries(
    historyRows
      .map((r) => [r.id, detailsById.get(r.id)?.pnl] as const)
      .filter(([, v]) => typeof v === "number"),
  ) as Record<string, number>;
  const avgCostForRows = Object.fromEntries(
    historyRows
      .map((r) => [r.id, detailsById.get(r.id)?.avgCost] as const)
      .filter(([, v]) => typeof v === "number"),
  ) as Record<string, number>;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 text-left">
      <header className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
            History
          </div>
          <h1 className="mt-1 text-[28px] leading-tight tracking-tight text-[var(--ink-strong)]">
            {dayParam ? `Trades on ${dayParam}` : "Recent trades"}
          </h1>
        </div>
        <div className="text-right text-[12px] text-[var(--ink-muted)]">
          <div>{dayParam ? "Single-day view" : "Last 7 days"}</div>
          <div className="mt-0.5">{historyRows.length} entries</div>
        </div>
      </header>

      <TradeHistorySection
        key={dayParam ?? "last-7-days"}
        rows={historyRows}
        pnlById={pnlForRows}
        avgCostById={avgCostForRows}
        loadError={txRes.error}
      />
    </div>
  );
}
