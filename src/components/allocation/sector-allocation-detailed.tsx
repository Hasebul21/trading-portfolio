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
 percentOfPortfolio: number;
 targetPercent: number | null;
 color: string;
};

/** Muted, restrained palette inspired by the design — earthy and easy on the eyes. */
const COLORS = [
 "#3d5772", // deep navy (slot 0 — biggest slice)
 "#88a78c", // sage
 "#b8a05e", // ochre
 "#7a8a9e", // steel grey-blue
 "#8b7aa1", // muted purple
 "#c08274", // terracotta
 "#8d745e", // warm brown
 "#6b8794", // dusty teal
 "#a4895b", // honey
 "#9b8aa8", // soft lavender
];

const PCT_FORMATTER = new Intl.NumberFormat(undefined, {
 minimumFractionDigits: 1,
 maximumFractionDigits: 1,
});

function fmtPct(n: number): string {
 return `${PCT_FORMATTER.format(n)}%`;
}

function buildSlices(
 holdings: AllocationHolding[],
 targets: SectorTarget[],
): { slices: SectorSlice[]; total: number } {
 const bySector = new Map<
 string,
 { label: string; invested: number; holdings: AllocationHolding[] }
 >();
 let total = 0;

 for (const h of holdings) {
 const cost = Number(h.totalCost);
 if (!Number.isFinite(cost) || cost <= 0) continue;
 const sectorLabel = h.sector?.trim() || "Unknown";
 const key = sectorMatchKey(sectorLabel);
 const entry =
 bySector.get(key) ?? { label: sectorLabel, invested: 0, holdings: [] };
 entry.invested += cost;
 entry.holdings.push(h);
 bySector.set(key, entry);
 total += cost;
 }

 // Targets indexed by case-insensitive sector key. A target without a current
 // position still gets a row so its target slice still shows on the chart.
 const targetByKey = new Map<string, SectorTarget>();
 for (const t of targets) {
 if (!t.sector?.trim()) continue;
 targetByKey.set(sectorMatchKey(t.sector), t);
 }
 for (const [key, target] of targetByKey) {
 if (!bySector.has(key)) {
 bySector.set(key, { label: target.sector, invested: 0, holdings: [] });
 }
 }

 const baseSlices = [...bySector.entries()].map(
 ([key, { label, invested, holdings: hs }]) => {
 const target = targetByKey.get(key);
 const percentOfPortfolio = total > 0 ? (invested / total) * 100 : 0;
 const targetPercent = target ? target.target_percent : null;
 return {
 key,
 sector: target?.sector ?? label,
 holdings: [...hs].sort((a, b) => b.totalCost - a.totalCost),
 investedBdt: invested,
 percentOfPortfolio,
 targetPercent,
 };
 },
 );

 // Held positions first (largest invested first), then targeted-but-empty
 // sectors (largest target first).
 baseSlices.sort((a, b) => {
 if (a.investedBdt > 0 && b.investedBdt === 0) return -1;
 if (a.investedBdt === 0 && b.investedBdt > 0) return 1;
 if (a.investedBdt !== b.investedBdt) return b.investedBdt - a.investedBdt;
 return (b.targetPercent ?? 0) - (a.targetPercent ?? 0);
 });

 const slices: SectorSlice[] = baseSlices.map((s, i) => ({
 sector: s.sector,
 holdings: s.holdings,
 investedBdt: s.investedBdt,
 percentOfPortfolio: s.percentOfPortfolio,
 targetPercent: s.targetPercent,
 color: COLORS[i % COLORS.length],
 }));

 return { slices, total };
}

/**
 * Build a `conic-gradient` value from a list of (color, percent) pairs.
 * Pads any remaining arc with `padColor` so the ring still closes cleanly
 * when percentages don't sum to 100.
 */
function conicGradient(
 parts: { color: string; percent: number }[],
 padColor = "#e7e5dd",
): string {
 if (parts.length === 0) return padColor;
 const stops: string[] = [];
 let cumulative = 0;
 for (const { color, percent } of parts) {
 if (percent <= 0) continue;
 stops.push(`${color} ${cumulative}%`);
 cumulative += percent;
 stops.push(`${color} ${cumulative}%`);
 }
 if (cumulative < 100) {
 stops.push(`${padColor} ${cumulative}%`);
 stops.push(`${padColor} 100%`);
 }
 return `conic-gradient(from 0deg, ${stops.join(", ")})`;
}

export function SectorAllocationDetailed({
 holdings,
 targets = [],
}: {
 holdings: AllocationHolding[];
 targets?: SectorTarget[];
}) {
 const { slices, total } = useMemo(
 () => buildSlices(holdings, targets),
 [holdings, targets],
 );

 const visibleSlices = useMemo(
 () =>
 slices.filter((s) => s.percentOfPortfolio > 0 || s.targetPercent !== null),
 [slices],
 );

 // Empty state — no holdings AND no targets.
 if (visibleSlices.length === 0 || total <= 0) {
 return (
 <div className="rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--bg-surface)] px-6 py-10 text-center text-[14px] text-[var(--ink-muted)]">
 No open positions to allocate. Record a buy first.
 </div>
 );
 }

 return (
 <div className="flex w-full min-w-0 flex-col gap-6 text-[var(--ink-strong)]">
 {/* Page header — eyebrow + h1 on left, summary stat on right. */}
 <header className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
 <div>
 <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
 Allocation
 </p>
 <h1 className="mt-1 text-[26px] leading-tight tracking-tight text-[var(--ink-strong)]">
 By sector
 </h1>
 </div>
 <dl className="grid w-full grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-right text-[13px] tabular-nums sm:w-auto sm:gap-x-4">
 <dt className="text-left text-[var(--ink-muted)] sm:text-right">Total invested</dt>
 <dd className="text-[var(--ink-strong)]">{formatBdt(total)} BDT</dd>
 </dl>
 </header>

 <DonutCard slices={visibleSlices} />

 <SectorBreakdown slices={visibleSlices} total={total} />
 </div>
 );
}

/* ────────────────────────────────────────────────────────────────────────── */

function DonutCard({ slices }: { slices: SectorSlice[] }) {
 const actualParts = slices.map((s) => ({
 color: s.color,
 percent: s.percentOfPortfolio,
 }));
 const targetParts = slices.map((s) => ({
 color: s.color,
 percent: s.targetPercent ?? 0,
 }));

 const actualBg = conicGradient(actualParts);
 const targetBg = conicGradient(targetParts);
 const anyTarget = slices.some((s) => s.targetPercent !== null);

 return (
 <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] p-5">
 <header>
 <h2 className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
 Current vs target
 </h2>
 <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
 Inner ring is actual share of invested capital. Outer ring is the
 target from Settings.
 </p>
 </header>

 <div className="my-6 flex items-center justify-center">
 <div className="relative h-56 w-56" aria-label="Sector allocation donut" role="img">
 {/* Outer ring = target. */}
 <div
 className="absolute inset-0 rounded-full"
 style={{ background: anyTarget ? targetBg : "#e7e5dd" }}
 />
 {/* Gap between rings (uses the card surface so it reads as a gap). */}
 <div className="absolute inset-[15%] rounded-full bg-[var(--bg-surface)]" />
 {/* Inner ring = actual. */}
 <div
 className="absolute inset-[18%] rounded-full"
 style={{ background: actualBg }}
 />
 {/* Centre hole. */}
 <div className="absolute inset-[38%] rounded-full bg-[var(--bg-surface)]" />
 {/* Centre label. */}
 <div className="absolute inset-0 flex items-center justify-center text-center">
 <div className="text-[10px] uppercase leading-snug tracking-[0.16em] text-[var(--ink-muted)]">
 Actual
 <br />
 vs
 <br />
 Target
 </div>
 </div>
 </div>
 </div>

 <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
 {/* Column headers — clarify what the two numbers per row mean. */}
 <li
 className="col-span-full hidden grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 border-b border-[var(--line)] pb-1 text-[10px] uppercase tracking-[0.14em] text-[var(--ink-muted)] sm:grid"
 aria-hidden
 >
 <span>Sector</span>
 <span className="text-right">Actual</span>
 <span className="text-right">Target</span>
 </li>
 {slices.map((slice) => (
 <li
 key={slice.sector}
 className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3"
 >
 <span className="flex min-w-0 items-center gap-2">
 <span
 className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
 style={{ background: slice.color }}
 aria-hidden
 />
 <span className="truncate text-[var(--ink-strong)]">{slice.sector}</span>
 </span>
 <span className="text-right tabular-nums text-[var(--ink-strong)]">
 {fmtPct(slice.percentOfPortfolio)}
 </span>
 <span className="text-right tabular-nums text-[var(--ink-muted)]">
 {slice.targetPercent !== null ? fmtPct(slice.targetPercent) : "—"}
 </span>
 </li>
 ))}
 </ul>
 </section>
 );
}

/* ────────────────────────────────────────────────────────────────────────── */

function SectorBreakdown({
 slices,
 total,
}: {
 slices: SectorSlice[];
 total: number;
}) {
 const heldSlices = slices.filter((s) => s.holdings.length > 0);
 if (heldSlices.length === 0) return null;

 return (
 <section className="flex flex-col gap-3">
 <header>
 <h2 className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
 Breakdown by sector
 </h2>
 <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
 Each position&apos;s share of total invested capital.
 </p>
 </header>

 <div className="grid gap-3 lg:grid-cols-2">
 {heldSlices.map((slice) => (
 <SectorCard key={slice.sector} slice={slice} portfolioTotal={total} />
 ))}
 </div>
 </section>
 );
}

function SectorCard({
 slice,
 portfolioTotal,
}: {
 slice: SectorSlice;
 portfolioTotal: number;
}) {
 return (
 <article className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-surface)]">
 <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
 <div className="flex min-w-0 items-center gap-2">
 <span
 className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
 style={{ background: slice.color }}
 aria-hidden
 />
 <h3 className="truncate text-[14px] text-[var(--ink-strong)]">
 {slice.sector}
 </h3>
 </div>
 <div className="flex items-baseline gap-2 whitespace-nowrap text-[12px] tabular-nums">
 <span className="text-[var(--ink-strong)]">
 {fmtPct(slice.percentOfPortfolio)}
 </span>
 <span className="text-[var(--ink-muted)]">
 of {formatBdt(slice.investedBdt)}
 </span>
 </div>
 </header>

 <table className="w-full text-left text-[13px]">
 <thead>
 <tr className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
 <th className="px-4 py-2 font-normal">Symbol</th>
 <th className="px-2 py-2 text-right font-normal">Shares</th>
 <th className="hidden px-2 py-2 text-right font-normal sm:table-cell">
 Avg cost
 </th>
 <th className="px-2 py-2 text-right font-normal">Invested</th>
 <th className="hidden px-2 py-2 text-right font-normal sm:table-cell">
 % sector
 </th>
 <th className="px-4 py-2 text-right font-normal">% portfolio</th>
 </tr>
 </thead>
 <tbody>
 {slice.holdings.map((h) => {
 const sectorShare =
 slice.investedBdt > 0
 ? (h.totalCost / slice.investedBdt) * 100
 : 0;
 const portfolioShare =
 portfolioTotal > 0 ? (h.totalCost / portfolioTotal) * 100 : 0;
 return (
 <tr
 key={h.symbol}
 className="border-t border-[var(--line)] tabular-nums"
 >
 <td className="px-4 py-2 text-[var(--ink-strong)]">{h.symbol}</td>
 <td className="px-2 py-2 text-right text-[var(--ink-strong)]">
 {h.shares.toLocaleString(undefined, {
 maximumFractionDigits: 2,
 })}
 </td>
 <td className="hidden px-2 py-2 text-right text-[var(--ink-muted)] sm:table-cell">
 {formatBdt(h.avgPrice)}
 </td>
 <td className="px-2 py-2 text-right text-[var(--ink-strong)]">
 {formatBdt(h.totalCost)}
 </td>
 <td className="hidden px-2 py-2 text-right text-[var(--ink-muted)] sm:table-cell">
 {fmtPct(sectorShare)}
 </td>
 <td className="px-4 py-2 text-right text-[var(--ink-strong)]">
 {fmtPct(portfolioShare)}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </article>
 );
}
