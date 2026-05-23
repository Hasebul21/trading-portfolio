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
 <AppPageStack gapClass="gap-4 sm:gap-5" className="mx-auto w-full min-w-0 max-w-3xl text-left">
 <RecordForm instruments={instruments} instrumentsError={error} />

 {/*
 Recent transactions — visible on mobile so the bottom-nav
 "Transactions" tab serves as both Add and History. On desktop the
 dedicated /trade-history page already covers this so we hide it.
 */}
 <section className="md:hidden">
 <header className="mb-3 flex items-baseline justify-between gap-3">
 <h2 className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
 Recent transactions
 </h2>
 <span className="text-[12px] text-[var(--ink-muted)]">last 30 days</span>
 </header>
 <TradeHistorySection rows={recentRows} loadError={txRes.error} />
 </section>
 </AppPageStack>
 );
}
