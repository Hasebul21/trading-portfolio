import { AppPageStack } from "@/components/app-page-stack";
import {
 SectorAllocationDetailed,
 type AllocationHolding,
 type SectorTarget,
} from "@/components/allocation/sector-allocation-detailed";
import { getSectorTargets } from "../sector-target-actions";
import { fetchUserHoldings } from "@/lib/holdings";
import { fetchDseCompanyExtrasMap } from "@/lib/market/dse-company-52w";

export const revalidate = 0;

export default async function AllocationPage() {
 const [holdingsRes, targetsRes] = await Promise.all([
 fetchUserHoldings(),
 getSectorTargets(),
 ]);

 if (holdingsRes.error) {
 return (
 <AppPageStack
 gapClass="gap-4 sm:gap-5"
 className="mx-auto min-w-0 max-w-2xl text-left"
 >
 <p className="rounded-lg bg-[var(--loss-50)] px-3 py-2 text-[var(--loss-700)]">
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

 const targets: SectorTarget[] = targetsRes.ok
 ? targetsRes.data.rows
 .filter((r) => r.target_percent !== null)
 .map((r) => ({
 sector: r.sector,
 target_percent: r.target_percent as number,
 }))
 : [];

 return (
 <AppPageStack
 gapClass="gap-4 sm:gap-5"
 className="mx-auto w-full min-w-0 max-w-6xl text-left"
 >
 <SectorAllocationDetailed holdings={allocationRows} targets={targets} />
 </AppPageStack>
 );
}
