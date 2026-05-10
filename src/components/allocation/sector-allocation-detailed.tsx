"use client";

import { formatBdt } from "@/lib/format-bdt";
import { useMemo } from "react";

export type AllocationHolding = {
    symbol: string;
    sector: string | null;
    /** Cost basis (book value) for this position in BDT. */
    totalCost: number;
    /** Share count remaining. */
    shares: number;
    /** Weighted-average buy cost per share. */
    avgPrice: number;
};

type SectorSlice = {
    sector: string;
    holdings: AllocationHolding[];
    investedBdt: number;
    sharesTotal: number;
    weightedAvgPrice: number;
    percentOfPortfolio: number;
    color: string;
};

const COLORS = [
    "#0f766e", // teal-700
    "#0891b2", // cyan-600
    "#2563eb", // blue-600
    "#7c3aed", // violet-600
    "#db2777", // pink-600
    "#ea580c", // orange-600
    "#ca8a04", // yellow-600
    "#65a30d", // lime-600
    "#dc2626", // red-600
    "#16a34a", // green-600
] as const;

/** Anything > this single-sector share is flagged as concentration risk. */
const CONCENTRATION_WARNING_THRESHOLD_PERCENT = 40;

function buildSectorSlices(holdings: AllocationHolding[]): {
    slices: SectorSlice[];
    total: number;
} {
    const bySector = new Map<
        string,
        { holdings: AllocationHolding[]; invested: number; shares: number }
    >();
    let total = 0;

    for (const h of holdings) {
        const cost = Number(h.totalCost);
        if (!Number.isFinite(cost) || cost <= 0) continue;

        const sector = h.sector?.trim() || "Unknown";
        const entry = bySector.get(sector) ?? {
            holdings: [],
            invested: 0,
            shares: 0,
        };
        entry.holdings.push(h);
        entry.invested += cost;
        entry.shares += Number.isFinite(h.shares) ? h.shares : 0;
        bySector.set(sector, entry);
        total += cost;
    }

    const slices = [...bySector.entries()]
        .sort((a, b) => b[1].invested - a[1].invested)
        .map(([sector, { holdings: hs, invested, shares }], i) => ({
            sector,
            holdings: [...hs].sort((a, b) => b.totalCost - a.totalCost),
            investedBdt: invested,
            sharesTotal: shares,
            weightedAvgPrice: shares > 0 ? invested / shares : 0,
            percentOfPortfolio: total > 0 ? (invested / total) * 100 : 0,
            color: COLORS[i % COLORS.length],
        }));

    return { slices, total };
}

function chartBackground(slices: SectorSlice[], total: number): string {
    if (slices.length === 0 || total <= 0) return "transparent";

    const stops: string[] = [];
    let cumulative = 0;
    slices.forEach((slice, i) => {
        stops.push(`${slice.color} ${cumulative}%`);
        cumulative =
            i === slices.length - 1
                ? 100
                : cumulative + slice.percentOfPortfolio;
        stops.push(`${slice.color} ${cumulative}%`);
    });
    return `conic-gradient(${stops.join(", ")})`;
}

function fmtPct(n: number): string {
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export function SectorAllocationDetailed({
    holdings,
}: {
    holdings: AllocationHolding[];
}) {
    const { slices, total } = useMemo(() => buildSectorSlices(holdings), [holdings]);
    const bg = useMemo(() => chartBackground(slices, total), [slices, total]);

    const positionCount = useMemo(
        () => slices.reduce((sum, s) => sum + s.holdings.length, 0),
        [slices],
    );

    const concentrated = slices.filter(
        (s) => s.percentOfPortfolio > CONCENTRATION_WARNING_THRESHOLD_PERCENT,
    );

    if (slices.length === 0 || total <= 0) {
        return (
            <div className="rounded-2xl border border-dashed border-teal-300/70 bg-white/80 px-6 py-10 text-center text-[15px] font-normal text-zinc-600 dark:border-teal-800/60 dark:bg-zinc-900/70 dark:text-zinc-400">
                No open positions to allocate. Record a buy first.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 sm:gap-5">
            {/* Top summary strip */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                <SummaryCell label="Total invested" value={formatBdt(total)} />
                <SummaryCell label="Sectors" value={String(slices.length)} />
                <SummaryCell label="Positions" value={String(positionCount)} />
                <SummaryCell
                    label="Largest sector"
                    value={`${slices[0]!.sector} · ${fmtPct(slices[0]!.percentOfPortfolio)}`}
                />
            </div>

            {/* Concentration warning */}
            {concentrated.length > 0 ? (
                <div className="rounded-xl border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-[15px] font-normal text-amber-900 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
                    <span className="font-medium">Concentration risk: </span>
                    {concentrated
                        .map(
                            (s) =>
                                `${s.sector} (${fmtPct(s.percentOfPortfolio)})`,
                        )
                        .join(", ")}{" "}
                    exceed{concentrated.length === 1 ? "s" : ""}{" "}
                    {CONCENTRATION_WARNING_THRESHOLD_PERCENT}% of the portfolio. Consider
                    diversifying.
                </div>
            ) : null}

            {/* Donut + legend */}
            <div className="rounded-2xl border border-teal-200/60 bg-white/80 px-3 py-4 shadow-sm sm:px-5 dark:border-teal-900/40 dark:bg-zinc-900/65">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
                    <div
                        className="relative h-40 w-40 flex-shrink-0 rounded-full"
                        style={{ background: bg }}
                        aria-label="Sector allocation donut"
                        role="img"
                    >
                        <div className="absolute inset-[26px] flex items-center justify-center rounded-full border border-white/70 bg-white/95 text-center shadow-inner dark:border-zinc-800/70 dark:bg-zinc-950/90">
                            <div>
                                <p className="text-[10px] font-normal uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                                    Sectors
                                </p>
                                <p className="mt-0.5 text-[20px] font-semibold leading-none text-zinc-900 dark:text-zinc-50">
                                    {slices.length}
                                </p>
                                <p className="mt-1 text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                                    {positionCount} {positionCount === 1 ? "position" : "positions"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid w-full min-w-0 gap-1.5 sm:grid-cols-2">
                        {slices.map((slice) => (
                            <div
                                key={slice.sector}
                                className="flex items-center gap-2 rounded-md border border-zinc-200/70 bg-zinc-50/60 px-2.5 py-1.5 dark:border-zinc-800/80 dark:bg-zinc-950/60"
                            >
                                <span
                                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                                    style={{ backgroundColor: slice.color }}
                                    aria-hidden
                                />
                                <span className="min-w-0 flex-1 truncate text-[13px] font-normal text-zinc-700 dark:text-zinc-100">
                                    {slice.sector}
                                </span>
                                <span className="whitespace-nowrap font-mono text-[12px] tabular-nums text-zinc-700 dark:text-zinc-100">
                                    {fmtPct(slice.percentOfPortfolio)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Per-sector detail cards */}
            <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
                {slices.map((slice) => (
                    <SectorCard key={slice.sector} slice={slice} />
                ))}
            </div>
        </div>
    );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-teal-200/60 bg-white/80 px-3 py-2 text-center shadow-sm dark:border-teal-900/40 dark:bg-zinc-900/65">
            <p className="text-[11px] font-normal uppercase tracking-widest text-teal-700 dark:text-teal-300">
                {label}
            </p>
            <p className="mt-0.5 text-[15px] font-normal tabular-nums text-zinc-900 dark:text-zinc-50">
                {value}
            </p>
        </div>
    );
}

function SectorCard({ slice }: { slice: SectorSlice }) {
    const top = slice.holdings[0];
    return (
        <section className="flex flex-col gap-2 rounded-2xl border border-teal-200/60 bg-white/85 p-3 shadow-sm sm:p-4 dark:border-teal-900/40 dark:bg-zinc-900/70">
            <header className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span
                        className="h-3 w-3 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: slice.color }}
                        aria-hidden
                    />
                    <h3 className="truncate text-[15px] font-normal text-zinc-900 dark:text-zinc-50">
                        {slice.sector}
                    </h3>
                </div>
                <span className="whitespace-nowrap rounded-md bg-teal-50/70 px-2 py-0.5 font-mono text-[12px] tabular-nums text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
                    {fmtPct(slice.percentOfPortfolio)}
                </span>
            </header>

            <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                    <p className="text-[10px] font-normal uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                        Invested
                    </p>
                    <p className="mt-0.5 text-[14px] font-normal tabular-nums text-zinc-900 dark:text-zinc-50">
                        {formatBdt(slice.investedBdt)}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] font-normal uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                        Holdings
                    </p>
                    <p className="mt-0.5 text-[14px] font-normal tabular-nums text-zinc-900 dark:text-zinc-50">
                        {slice.holdings.length}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] font-normal uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                        Wt. avg cost
                    </p>
                    <p className="mt-0.5 text-[14px] font-normal tabular-nums text-zinc-900 dark:text-zinc-50">
                        {formatBdt(slice.weightedAvgPrice)}
                    </p>
                </div>
            </div>

            {top ? (
                <p className="rounded-md border border-dashed border-teal-200/70 bg-teal-50/30 px-2 py-1 text-center text-[12px] font-normal text-teal-900 dark:border-teal-800/50 dark:bg-teal-950/20 dark:text-teal-200">
                    Top holding:{" "}
                    <span className="font-mono tabular-nums">{top.symbol}</span>{" "}
                    · {formatBdt(top.totalCost)} ·{" "}
                    {fmtPct(
                        slice.investedBdt > 0
                            ? (top.totalCost / slice.investedBdt) * 100
                            : 0,
                    )}{" "}
                    of sector
                </p>
            ) : null}

            <table className="w-full text-left text-[13px] font-normal">
                <thead>
                    <tr className="text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                        <th className="py-1 font-normal">Symbol</th>
                        <th className="py-1 text-right font-normal">Shares</th>
                        <th className="py-1 text-right font-normal">Avg cost</th>
                        <th className="py-1 text-right font-normal">Invested</th>
                        <th className="py-1 text-right font-normal">% sector</th>
                    </tr>
                </thead>
                <tbody>
                    {slice.holdings.map((h) => (
                        <tr
                            key={h.symbol}
                            className="border-t border-zinc-200/60 dark:border-zinc-800/70"
                        >
                            <td className="py-1 font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-50">
                                {h.symbol}
                            </td>
                            <td className="py-1 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                                {h.shares.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                })}
                            </td>
                            <td className="py-1 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                                {formatBdt(h.avgPrice)}
                            </td>
                            <td className="py-1 text-right tabular-nums text-zinc-900 dark:text-zinc-50">
                                {formatBdt(h.totalCost)}
                            </td>
                            <td className="py-1 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                                {fmtPct(
                                    slice.investedBdt > 0
                                        ? (h.totalCost / slice.investedBdt) * 100
                                        : 0,
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}
