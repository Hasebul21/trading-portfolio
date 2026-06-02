import { AppPageStack } from "@/components/app-page-stack";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { listDividends } from "../dividend-actions";
import { DividendForm } from "./dividend-form";

export const metadata = {
  title: "Dividends — Portfolio",
};

export default async function DividendPage() {
  const [{ instruments, error: instrumentsError }, dividendsRes] = await Promise.all([
    getCachedDseInstruments(),
    listDividends(),
  ]);

  return (
    <AppPageStack
      gapClass="gap-4 sm:gap-5"
      className="mx-auto w-full min-w-0 max-w-2xl text-left text-[var(--ink-strong)]"
    >
      <DividendForm
        instruments={instruments}
        instrumentsError={instrumentsError}
        initialRows={dividendsRes.ok ? dividendsRes.rows : []}
        initialTotalCash={dividendsRes.ok ? dividendsRes.totalCash : 0}
        initialTotalStockShares={dividendsRes.ok ? dividendsRes.totalStockShares : 0}
        initialError={dividendsRes.ok ? null : dividendsRes.error}
      />
    </AppPageStack>
  );
}
