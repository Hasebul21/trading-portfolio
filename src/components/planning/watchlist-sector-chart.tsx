"use client";

import { formatBdt } from "@/lib/format-bdt";
import { useMemo } from "react";

export type PortfolioHoldingForChart = {
  symbol: string;
  sector: string | null;
  totalCost: number;
};

const COLORS = [
    "#14b8a6", // teal
    "#3b82f6", // blue
    "#a855f7", // purple
    "#ec4899", // pink
    "#f59e0b", // amber
    "#10b981", // emerald
    "#06b6d4", // cyan
    "#8b5cf6", // violet
];

function buildSectorSlices(
  holdings: PortfolioHoldingForChart[],
): Array<{
  sector: string;
  count: number;
  totalInvested: number;
}> {
  const sectorMap: Record<string, { count: number; totalInvested: number }> = {};

  for (const holding of holdings) {
    const sector = holding.sector ?? "Unknown";
    if (!sectorMap[sector]) {
      sectorMap[sector] = { count: 0, totalInvested: 0 };
    }
    sectorMap[sector].count += 1;
    sectorMap[sector].totalInvested += holding.totalCost;
  }

  return Object.entries(sectorMap)
    .map(([sector, { count, totalInvested }]) => ({
      sector,
      count,
      totalInvested: Math.round(totalInvested * 100) / 100,
    }))
    .sort((a, b) => b.totalInvested - a.totalInvested);
}

function chartBackground(
  slices: Array<{ sector: string; count: number; totalInvested: number }>,
): string {
  if (slices.length === 0) return "transparent";

  const total = slices.reduce((sum, s) => sum + s.totalInvested, 0);
  if (total === 0) return "transparent";

  const stops: string[] = [];
  let cumulativePercent = 0;

  for (const slice of slices) {
    const percent = (slice.totalInvested / total) * 100;
    const color = COLORS[(stops.length / 2) % COLORS.length];
    stops.push(`${color} ${cumulativePercent}%`);
    cumulativePercent += percent;
    stops.push(`${color} ${cumulativePercent}%`);
  }

  return `conic-gradient(${stops.join(", ")})`;
}

export function WatchlistSectorChart({ holdings }: { holdings: PortfolioHoldingForChart[] }) {
    const slices = useMemo(() => buildSectorSlices(holdings), [holdings]);
    const total = useMemo(() => slices.reduce((sum, s) => sum + s.totalInvested, 0), [slices]);
    const bg = useMemo(() => chartBackground(slices), [slices]);

    if (slices.length === 0 || total === 0) {
        return null;
    }

    return (
        <div className="mb-4 rounded-md border border-teal-200/60 bg-gradient-to-br from-white/95 to-teal-50/40 px-3 py-2 dark:border-teal-900/40 dark:from-zinc-900/80 dark:to-teal-950/20">
            <p className="mb-2 text-[11px] font-normal uppercase tracking-widest text-teal-700 dark:text-teal-300">
                Sector Allocation
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                {/* Donut Chart */}
                <div className="flex flex-col items-center gap-1">
                    <div
                        className="relative flex h-24 w-24 items-center justify-center rounded-full"
                        style={{ background: bg }}
                    >
                        {/* Center circle for donut effect */}
                        <div className="absolute h-14 w-14 rounded-full bg-white dark:bg-zinc-900" />
                        <div className="absolute flex flex-col items-center gap-0 text-center">
                            <span className="text-[10px] font-normal uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                                Sectors
                            </span>
                            <span className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">{slices.length}</span>
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-1 flex-col gap-1">
                    {slices.map((slice, i) => {
                        const color = COLORS[i % COLORS.length];
                        const percent = ((slice.totalInvested / total) * 100).toFixed(1);
                        return (
                            <div key={slice.sector} className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                                <div className="min-w-0 flex-1 truncate">
                                    <span className="text-[12px] font-normal text-zinc-700 dark:text-zinc-300">{slice.sector}</span>
                                </div>
                                <div className="flex items-baseline gap-0.5 whitespace-nowrap text-right font-mono text-[11px] flex-shrink-0">
                                    <span className="text-zinc-500 dark:text-zinc-400">{percent}%</span>
                                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">({slice.count})</span>
                                </div>
                            </div>
                        );
                    })}
                    <div className="mt-1.5 border-t border-teal-200/40 pt-1.5 dark:border-teal-900/40">
                        <div className="flex items-center justify-between text-[12px] font-semibold">
                            <span className="text-zinc-700 dark:text-zinc-300">Total tracked</span>
                            <span className="font-mono text-teal-700 dark:text-teal-300">{formatBdt(total)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
