import { formatBdt } from "@/lib/format-bdt";
import type { PortfolioMarketRow } from "@/lib/market/portfolio-with-quotes";

type SectorSlice = {
 sector: string;
 investedBdt: number;
 percent: number;
 color: string;
};

const CHART_COLORS = [
 "#0f766e",
 "#0891b2",
 "#2563eb",
 "#7c3aed",
 "#db2777",
 "#ea580c",
 "#ca8a04",
 "#65a30d",
] as const;

function buildSectorSlices(rows: PortfolioMarketRow[]): SectorSlice[] {
 const bySector = new Map<string, number>();
 let total = 0;

 for (const row of rows) {
 const investedBdt = Number(row.totalCost);
 if (!Number.isFinite(investedBdt) || investedBdt <= 0) continue;
 const sector = row.sector?.trim() || "Unknown";
 bySector.set(sector, (bySector.get(sector) ?? 0) + investedBdt);
 total += investedBdt;
 }

 return [...bySector.entries()]
 .sort((a, b) => b[1] - a[1])
 .map(([sector, investedBdt], index) => ({
 sector,
 investedBdt,
 percent: total > 0 ? (investedBdt / total) * 100 : 0,
 color: CHART_COLORS[index % CHART_COLORS.length],
 }));
}

function chartBackground(slices: SectorSlice[]): string {
 if (slices.length === 0) {
 return "conic-gradient(#d4d4d8 0deg 360deg)";
 }

 let start = 0;
 const stops = slices.map((slice) => {
 const end = start + (slice.percent / 100) * 360;
 const segment = `${slice.color} ${start}deg ${end}deg`;
 start = end;
 return segment;
 });
 return `conic-gradient(${stops.join(", ")})`;
}

export function PortfolioSectorChart({ rows }: { rows: PortfolioMarketRow[] }) {
 const slices = buildSectorSlices(rows);
 const totalInvestedBdt = slices.reduce((sum, slice) => sum + slice.investedBdt, 0);

 if (slices.length === 0) return null;

 return (
 <section className="rounded-lg border border-[var(--line)] bg-[var(--bg-surface)] p-3 shadow-md shadow-teal-950/[0.05] ring-1 ring-black/[0.03] backdrop-blur-sm ">
 <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
 <div className="min-w-0">
 <p className="text-[12px] font-normal uppercase tracking-[0.2em] text-[var(--ink-strong)]">
 Sector allocation
 </p>
 <p className="mt-0.5 text-[15px] font-normal text-[var(--ink-strong)]">
 Total tracked: {formatBdt(totalInvestedBdt)} BDT
 </p>
 </div>

 <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
 <div className="flex justify-center sm:justify-start">
 <div
 className="relative h-24 w-24 rounded-full"
 style={{ background: chartBackground(slices) }}
 aria-label="Portfolio invested amount by sector"
 role="img"
 >
 <div className="absolute inset-[14px] flex items-center justify-center rounded-full border border-white/70 bg-[var(--bg-surface)] text-center shadow-inner ">
 <div>
 <p className="text-[9px] font-normal uppercase tracking-[0.15em] text-[var(--ink-strong)]">
 Sectors
 </p>
 <p className="mt-0.5 text-[16px] font-semibold leading-none text-[var(--ink-strong)]">
 {slices.length}
 </p>
 </div>
 </div>
 </div>
 </div>

 <div className="grid min-w-0 gap-1.5 sm:min-w-[14rem]">
 {slices.map((slice) => (
 <div
 key={slice.sector}
 className="grid grid-cols-[auto,1fr,auto] items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--bg-surface-soft)] px-2.5 py-1.5 "
 >
 <span
 className="h-2.5 w-2.5 rounded-full flex-shrink-0"
 style={{ backgroundColor: slice.color }}
 aria-hidden
 />
 <div className="min-w-0">
 <p className="truncate text-[12px] font-medium text-[var(--ink-strong)]">
 {slice.sector}
 </p>
 <p className="text-[11px] font-normal text-[var(--ink-strong)]">
 {formatBdt(slice.investedBdt)} BDT
 </p>
 </div>
 <p className="text-[11px] font-semibold tabular-nums text-[var(--ink-strong)] flex-shrink-0">
 {slice.percent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
 </p>
 </div>
 ))}
 </div>
 </div>
 </div>
 </section>
 );
}
