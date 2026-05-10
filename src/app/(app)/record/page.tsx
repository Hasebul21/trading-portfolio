import { AppPageStack } from "@/components/app-page-stack";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import {
  fetchAllUserTransactions,
  filterTransactionsLastNDays,
} from "@/lib/user-transactions";
import { TradeHistorySection } from "../trade-history/trade-history-section";
import { RecordForm } from "./record-form";

export default async function RecordPage() {
  const [{ instruments, error }, txRes] = await Promise.all([
    getCachedDseInstruments(),
    fetchAllUserTransactions(),
  ]);
  const recentRows = filterTransactionsLastNDays(txRes.rows, 30);

  return (
    <AppPageStack>
      <div className="mx-auto min-w-0 max-w-xl text-left">
        <RecordForm instruments={instruments} instrumentsError={error} />
      </div>

      {/*
        Recent transactions — visible on mobile so the bottom-nav
        "Transactions" tab serves as both Add and History. On desktop the
        dedicated /trade-history page already covers this so we hide it.
      */}
      <section className="mx-auto w-full min-w-0 max-w-xl text-left md:hidden">
        <h2 className="mb-2 text-[15px] font-medium text-zinc-50">
          Recent transactions
          <span className="ml-2 text-[12px] font-normal text-zinc-400">
            last 30 days
          </span>
        </h2>
        <TradeHistorySection rows={recentRows} loadError={txRes.error} />
      </section>
    </AppPageStack>
  );
}
