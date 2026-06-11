import { AppPageStack } from "@/components/app-page-stack";
import { PositionsView } from "@/components/positions/positions-view";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { getPositions } from "../positions-actions";

export const metadata = {
  title: "Positions — Portfolio",
};

export default async function PositionsPage() {
  const [positionsRes, instrumentsRes] = await Promise.all([
    getPositions(),
    getCachedDseInstruments(),
  ]);

  if (!positionsRes.ok) {
    return (
      <AppPageStack className="mx-auto w-full min-w-0 max-w-2xl text-left">
        <div className="rounded-lg border border-[var(--loss-200)] bg-[var(--loss-50)] px-4 py-3 text-[var(--loss-700)]">
          <p className="text-[14px]">{positionsRes.error}</p>
        </div>
      </AppPageStack>
    );
  }

  return (
    <AppPageStack
      gapClass="gap-4 sm:gap-5"
      className="mx-auto w-full min-w-0 max-w-5xl text-left text-[var(--ink-strong)]"
    >
      <PositionsView
        initialBuy={positionsRes.data.buy}
        initialSell={positionsRes.data.sell}
        initialBalance={positionsRes.data.balance}
        commissionRate={positionsRes.data.commissionRate}
        instruments={instrumentsRes.instruments}
        instrumentsError={instrumentsRes.error}
      />
    </AppPageStack>
  );
}
