"use client";

import { formatBdt } from "@/lib/format-bdt";
import { sectorMatchKey } from "@/lib/sector-targets";
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

export type SectorTarget = {
    sector: string;
    target_percent: number;
};

type SectorSlice = {
    sector: string;
    holdings: AllocationHolding[];
    investedBdt: number;
    sharesTotal: number;
    weightedAvgPrice: number;
    percentOfPortfolio: number;
    targetPercent: number | null;
    /** current − target. Positive = over-allocated, negative = under-allocated. */
    deltaPercent: number | null;
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

function buildSectorSlices(
    holdings: AllocationHolding[],
    targets: SectorTarget[],
): {
    slices: SectorSlice[];
    total: number;
} {
    const bySector = new Map<
        string,
        { label: string; holdings: AllocationHolding[]; invested: number; shares: number }
    >();
    let total = 0;

    for (const h of holdings) {
        const cost = Number(h.totalCost);
        if (!Number.isFinite(cost) || cost <= 0) continue;

        const sectorLabel = h.sector?.trim() || "Unknown";
        const key = sectorMatchKey(sectorLabel);
        const entry = bySector.get(key) ?? {
            label: sectorLabel,
            holdings: [],
            invested: 0,
            shares: 0,
        };
        entry.holdings.push(h);
        entry.invested += cost;
        entry.shares += Number.isFinite(h.shares) ? h.shares : 0;
        bySector.set(key, entry);
        total += cost;
    }

    // Targets indexed by case-insensitive sector key.
    const targetByKey = new Map<string, SectorTarget>();
    for (const t of targets) {
        if (!t.sector?.trim()) continue;
        targetByKey.set(sectorMatchKey(t.sector), t);
    }

    // A sector that has a target but no current holding still gets a row, so
    // the user can see the gap.
    for (const [key, target] of targetByKey) {
        if (!bySector.has(key)) {
            bySector.set(key, {
                label: target.sector,
                holdings: [],
                invested: 0,
                shares: 0,
            });
        }
    }

    const baseSlices = [...bySector.entries()].map(([key, { label, holdings: hs, invested, shares }]) => {
        const target = targetByKey.get(key);
        const percentOfPortfolio = total > 0 ? (invested / total) * 100 : 0;
        const targetPercent = target ? target.target_percent : null;
        return {
            key,
            label: target?.sector ?? label,
            holdings: [...hs].sort((a, b) => b.totalCost - a.totalCost),
            investedBdt: invested,
            sharesTotal: shares,
            weightedAvgPrice: shares > 0 ? invested / shares : 0,
            percentOfPortfolio,
            targetPercent,
            deltaPercent:
                targetPercent === null ? null : percentOfPortfolio - targetPercent,
        };
    });

    baseSlices.sort((a, b) => {
        // Held positions first (by invested desc), then targeted-but-empty
        // sectors (by target desc) so the user's actual book leads the list.
        if (a.investedBdt > 0 && b.investedBdt === 0) return -1;
        if (a.investedBdt === 0 && b.investedBdt > 0) return 1;
        if (a.investedBdt !== b.investedBdt) return b.investedBdt - a.investedBdt;
        const aTarget = a.targetPercent ?? -1;
        const bTarget = b.targetPercent ?? -1;
        if (aTarget !== bTarget) return bTarget - aTarget;
        return a.label.localeCompare(b.label);
    });

    const slices: SectorSlice[] = baseSlices.map(
        ({ label, holdings: hs, investedBdt, sharesTotal, weightedAvgPrice, percentOfPortfolio, targetPercent, deltaPercent }, i) => ({
            sector: label,
            holdings: hs,
            investedBdt,
            sharesTotal,
            weightedAvgPrice,
            percentOfPortfolio,
            targetPercent,
            deltaPercent,
            color: COLORS[i % COLORS.length],
        }),
    );

    return { slices, total };
}

function chartBackground(slices: SectorSlice[], total: number): string {
    if (slices.length === 0 || total <= 0) return "transparent";

    const real = slices.filter((s) => s.percentOfPortfolio > 0);
    if (real.length === 0) return "transparent";

    const stops: string[] = [];
    let cumulative = 0;
    real.forEach((slice, i) => {
        stops.push(`${slice.color} ${cumulative}%`);
        cumulative =
            i === real.length - 1 ? 100 : cumulative + slice.percentOfPortfolio;
        stops.push(`${slice.color} ${cumulative}%`);
    });
    return `conic-gradient(${stops.join(", ")})`;
}

function fmtPct(n: number): string {
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export function SectorAllocationDetailed({
    holdings,
    targets = [],
}: {
    holdings: AllocationHolding[];
    targets?: SectorTarget[];
}) {
    const { slices, total } = useMemo(
        () => buildSectorSlices(holdings, targets),
        [holdings, targets],
    );
    const bg = useMemo(() => chartBackground(slices, total), [slices, total]);

    // Sectors with non-zero allocation come first; targeted-but-empty sectors
    // (no current position) are rendered after so the user still sees the gap.
    const visibleSlices = useMemo(
        () =>
            slices.filter(
                (s) => s.percentOfPortfolio > 0 || s.targetPercent !== null,
            ),
        [slices],
    );

    const chartedSlices = useMemo(
        () => slices.filter((s) => s.percentOfPortfolio > 0),
        [slices],
    );

    const positionCount = useMemo(
        () => chartedSlices.reduce((sum, s) => sum + s.holdings.length, 0),
        [chartedSlices],
    );

    if (visibleSlices.length === 0 || total <= 0) {
        return (
            <div className="rounded-2xl border border-dashed border-teal-300/70 bg-white/80 px-6 py-10 text-center text-[15px] font-normal text-zinc-600 dark:border-teal-800/60 dark:bg-zinc-900/70 dark:text-zinc-400">
                No open positions to allocate. Record a buy first.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {chartedSlices.length > 0 ? (
                <section className="rounded-2xl border border-teal-200/60 bg-white/85 px-3 py-4 shadow-sm sm:px-5 dark:border-teal-900/40 dark:bg-zinc-900/70">
                    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
                        <div
                            className="relative h-32 w-32 flex-shrink-0 rounded-full sm:h-40 sm:w-40"
                            style={{ background: bg }}
                            aria-label="Sector allocation donut"
                            role="img"
                        >
                            <div className="absolute inset-[20px] flex items-center justify-center rounded-full border border-white/70 bg-white/95 text-center shadow-inner sm:inset-[26px] dark:border-zinc-800/70 dark:bg-zinc-950/90">
                                <div>
                                    <p className="text-[10px] font-normal uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                                        Invested
                                    </p>
                                    <p className="mt-0.5 text-[15px] font-semibold leading-none tabular-nums text-zinc-900 dark:text-zinc-50">
                                        {formatBdt(total)}
                                    </p>
                                    <p className="mt-1 text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                                        {chartedSlices.length}{" "}
                                        {chartedSlices.length === 1 ? "sector" : "sectors"} ·{" "}
                                        {positionCount}{" "}
                                        {positionCount === 1 ? "position" : "positions"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <ul className="flex w-full flex-1 flex-col gap-1.5">
                            {chartedSlices.map((slice) => (
                                <li
                                    key={slice.sector}
                                    className="flex items-center justify-between gap-3 text-[13px] font-normal text-zinc-700 dark:text-zinc-200"
                                >
                                    <span className="flex min-w-0 items-center gap-2">
                                        <span
                                            className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                                            style={{ background: slice.color }}
                                            aria-hidden
                                        />
                                        <span className="truncate">{slice.sector}</span>
                                    </span>
                                    <span className="flex items-center gap-2 whitespace-nowrap">
                                        <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
                                            {fmtPct(slice.percentOfPortfolio)}
                                        </span>
                                        <span className="text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
                                            {formatBdt(slice.investedBdt)}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            ) : null}

            {visibleSlices.map((slice) => (
                <SectorCard key={slice.sector} slice={slice} />
            ))}
        </div>
    );
}

function SectorCard({ slice }: { slice: SectorSlice }) {
    const isEmptyTarget = slice.investedBdt === 0 && slice.targetPercent !== null;

    return (
        <section
            className={`flex flex-col gap-2 rounded-2xl border bg-white/85 p-3 shadow-sm sm:p-4 dark:bg-zinc-900/70 ${isEmptyTarget
                ? "border-dashed border-amber-300/70 dark:border-amber-700/60"
                : "border-teal-200/60 dark:border-teal-900/40"
                }`}
        >
            <header className="flex items-baseline justify-between gap-2">
                <h3 className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
                    {slice.sector}
                </h3>
                <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="text-[13px] font-normal text-zinc-500 dark:text-zinc-400">
                        {slice.holdings.length}{" "}
                        {slice.holdings.length === 1 ? "symbol" : "symbols"}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="rounded-md bg-teal-50/70 px-2 py-0.5 font-mono text-[12px] tabular-nums text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
                            {fmtPct(slice.percentOfPortfolio)}
                        </span>
                        <span className="text-[12px] text-zinc-400 dark:text-zinc-500">
                            /
                        </span>
                        <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[12px] tabular-nums text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200">
                            {slice.targetPercent === null
                                ? "—"
                                : fmtPct(slice.targetPercent)}
                        </span>
                    </span>
                </div>
            </header>

            {isEmptyTarget ? (
                <p className="text-[12px] font-normal text-amber-800 dark:text-amber-200">
                    No position yet — buy into this sector to reach your{" "}
                    {fmtPct(slice.targetPercent ?? 0)} target.
                </p>
            ) : null}

            {!isEmptyTarget ? (
                <>
                    <p className="text-[12px] font-normal text-zinc-500 dark:text-zinc-400">
                        Invested:{" "}
                        <span className="tabular-nums text-zinc-900 dark:text-zinc-50">
                            {formatBdt(slice.investedBdt)}
                        </span>
                    </p>

                    <table className="w-full text-left text-[13px] font-normal">
                        <thead>
                            <tr className="text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                                <th className="py-1 font-normal">Symbol</th>
                                <th className="py-1 text-right font-normal">Shares</th>
                                <th className="hidden py-1 text-right font-normal sm:table-cell">
                                    Avg cost
                                </th>
                                <th className="py-1 text-right font-normal">Invested</th>
                                <th className="hidden py-1 text-right font-normal sm:table-cell">
                                    % sector
                                </th>
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
                                    <td className="hidden py-1 text-right tabular-nums text-zinc-700 sm:table-cell dark:text-zinc-200">
                                        {formatBdt(h.avgPrice)}
                                    </td>
                                    <td className="py-1 text-right tabular-nums text-zinc-900 dark:text-zinc-50">
                                        {formatBdt(h.totalCost)}
                                    </td>
                                    <td className="hidden py-1 text-right tabular-nums text-zinc-700 sm:table-cell dark:text-zinc-200">
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
                </>
            ) : null}
        </section>
    );
}
