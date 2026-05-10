import { AppPageHeader } from "@/components/app-page-header";
import { AppPageStack } from "@/components/app-page-stack";
import {
    SectorAllocationDetailed,
    type AllocationHolding,
} from "@/components/allocation/sector-allocation-detailed";
import { fetchUserHoldings } from "@/lib/holdings";
import { fetchDseCompanyExtrasMap } from "@/lib/market/dse-company-52w";

export const revalidate = 0;

export default async function AllocationPage() {
    const holdingsRes = await fetchUserHoldings();

    if (holdingsRes.error) {
        return (
            <AppPageStack
                gapClass="gap-4 sm:gap-5"
                className="mx-auto min-w-0 max-w-2xl text-left"
            >
                <AppPageHeader title="Sector Allocation" />
                <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800 dark:bg-red-950/40 dark:text-red-200">
                    {holdingsRes.error}
                </p>
            </AppPageStack>
        );
    }

    const sectorBySymbol = await fetchDseCompanyExtrasMap(
        holdingsRes.holdings.map((h) => h.symbol),
    );

    const allocationRows: AllocationHolding[] = holdingsRes.holdings.map((h) => {
        const sector = sectorBySymbol.get(h.symbol)?.sector ?? h.category ?? null;
        return {
            symbol: h.symbol,
            sector,
            totalCost: h.totalCost,
            shares: h.shares,
            avgPrice: h.avgPrice,
        };
    });

    return (
        <AppPageStack
            gapClass="gap-4 sm:gap-5"
            className="mx-auto w-full min-w-0 max-w-6xl text-left"
        >
            <AppPageHeader title="Sector Allocation" />
            <SectorAllocationDetailed holdings={allocationRows} />
        </AppPageStack>
    );
}
