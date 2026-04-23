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
        <section className="rounded-2xl border border-teal-200/50 bg-white/75 p-4 shadow-xl shadow-teal-950/[0.07] ring-1 ring-black/[0.04] backdrop-blur-md dark:border-teal-900/35 dark:bg-zinc-900/65 dark:shadow-black/40 dark:ring-white/[0.06]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <p className="text-[13px] font-normal uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                        Sector allocation
                    </p>
                    <h2 className="mt-1 text-[18px] font-semibold text-zinc-900 dark:text-zinc-50">
                        Invested amount by sector
                    </h2>
                    <p className="mt-1 text-[14px] font-normal text-zinc-500 dark:text-zinc-400">
                        Total tracked: {formatBdt(totalInvestedBdt)} BDT
                    </p>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex justify-center sm:justify-start">
                        <div
                            className="relative h-40 w-40 rounded-full"
                            style={{ background: chartBackground(slices) }}
                            aria-label="Portfolio invested amount by sector"
                            role="img"
                        >
                            <div className="absolute inset-[22px] flex items-center justify-center rounded-full border border-white/70 bg-white/90 text-center shadow-inner dark:border-zinc-800/70 dark:bg-zinc-950/90">
                                <div>
                                    <p className="text-[11px] font-normal uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                                        Sectors
                                    </p>
                                    <p className="mt-1 text-[22px] font-semibold leading-none text-zinc-900 dark:text-zinc-50">
                                        {slices.length}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid min-w-0 gap-2 sm:min-w-[18rem]">
                        {slices.map((slice) => (
                            <div
                                key={slice.sector}
                                className="grid grid-cols-[auto,1fr,auto] items-center gap-3 rounded-xl border border-zinc-200/70 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800/80 dark:bg-zinc-950/60"
                            >
                                <span
                                    className="h-3 w-3 rounded-full"
                                    style={{ backgroundColor: slice.color }}
                                    aria-hidden
                                />
                                <div className="min-w-0">
                                    <p className="truncate text-[14px] font-medium text-zinc-900 dark:text-zinc-50">
                                        {slice.sector}
                                    </p>
                                    <p className="text-[13px] font-normal text-zinc-500 dark:text-zinc-400">
                                        {formatBdt(slice.investedBdt)} BDT
                                    </p>
                                </div>
                                <p className="text-[13px] font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                                    {slice.percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
