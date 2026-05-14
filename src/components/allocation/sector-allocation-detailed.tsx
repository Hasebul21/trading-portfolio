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
 investedBdt: number;
 percentOfPortfolio: number;
 targetPercent: number | null;
 /** target − actual in BDT. Positive = need to buy, negative = need to trim. */
 driftBdt: number | null;
 /** actual − target in %. Positive = over-allocated, negative = under-allocated. */
 driftPct: number | null;
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

function fmtPct(n: number, signed = false): string {
 const sign = signed ? (n > 0 ? "+" : n < 0 ? "−" : "") : "";
 return `${sign}${PCT_FORMATTER.format(Math.abs(n))}%`;
}

function buildSlices(
 holdings: AllocationHolding[],
 targets: SectorTarget[],
): { slices: SectorSlice[]; total: number } {
 const bySector = new Map<string, { label: string; invested: number }>();
 let total = 0;

 for (const h of holdings) {
 const cost = Number(h.totalCost);
 if (!Number.isFinite(cost) || cost <= 0) continue;
 const sectorLabel = h.sector?.trim() || "Unknown";
 const key = sectorMatchKey(sectorLabel);
 const entry = bySector.get(key) ?? { label: sectorLabel, invested: 0 };
 entry.invested += cost;
 bySector.set(key, entry);
 total += cost;
 }

 // Targets indexed by case-insensitive sector key. A target without a current
 // position still gets a row so the rebalance plan can suggest the buy.
 const targetByKey = new Map<string, SectorTarget>();
 for (const t of targets) {
 if (!t.sector?.trim()) continue;
 targetByKey.set(sectorMatchKey(t.sector), t);
 }
 for (const [key, target] of targetByKey) {
 if (!bySector.has(key)) {
 bySector.set(key, { label: target.sector, invested: 0 });
 }
 }

 const baseSlices = [...bySector.entries()].map(([key, { label, invested }]) => {
 const target = targetByKey.get(key);
 const percentOfPortfolio = total > 0 ? (invested / total) * 100 : 0;
 const targetPercent = target ? target.target_percent : null;
 const driftPct =
 targetPercent === null ? null : percentOfPortfolio - targetPercent;
 const driftBdt =
 targetPercent === null ? null : (driftPct! / 100) * total;
 return {
 key,
 sector: target?.sector ?? label,
 investedBdt: invested,
 percentOfPortfolio,
 targetPercent,
 driftPct,
 driftBdt,
 };
 });

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
 investedBdt: s.investedBdt,
 percentOfPortfolio: s.percentOfPortfolio,
 targetPercent: s.targetPercent,
 driftPct: s.driftPct,
 driftBdt: s.driftBdt,
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

 const driftSlices = useMemo(
 () => visibleSlices.filter((s) => s.targetPercent !== null),
 [visibleSlices],
 );

 const totals = useMemo(() => {
 let addTotal = 0;
 let trimTotal = 0;
 let totalDriftAbs = 0;
 for (const s of driftSlices) {
 if (s.driftBdt === null) continue;
 const absD = Math.abs(s.driftBdt);
 totalDriftAbs += absD;
 if (s.driftBdt < 0) addTotal += absD;
 else trimTotal += absD;
 }
 return { addTotal, trimTotal, totalDriftAbs };
 }, [driftSlices]);

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
 {/* Page header — eyebrow + h1 on left, summary stats on right. */}
 <header className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
 <div>
 <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
 Allocation
 </p>
 <h1 className="mt-1 text-[26px] leading-tight tracking-tight text-[var(--ink-strong)]">
 Rebalance plan
 </h1>
 </div>
 <dl className="grid w-full grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-right text-[13px] tabular-nums sm:w-auto sm:gap-x-4">
 <dt className="text-left text-[var(--ink-muted)] sm:text-right">Total invested</dt>
 <dd className="text-[var(--ink-strong)]">{formatBdt(total)} BDT</dd>
 <dt className="text-left text-[var(--ink-muted)] sm:text-right">Total drift</dt>
 <dd className="text-[var(--ink-strong)]">
 {totals.totalDriftAbs > 0 ? `${formatBdt(totals.totalDriftAbs)} BDT` : "—"}
 </dd>
 </dl>
 </header>

 <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
 <DonutCard slices={visibleSlices} />
 <AdjustmentsCard
 slices={driftSlices}
 totals={totals}
 hasAnyTargets={driftSlices.length > 0}
 />
 </div>

 <p className="text-[12px] leading-relaxed text-[var(--ink-muted)]">
 Suggestions are in BDT and don&apos;t yet account for tick size or share
 rounding. Pair with the Watchlist&apos;s <em className="not-italic">Near buy</em> column to pick
 specific symbols to add.
 </p>
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
 Inner ring is actual share of invested capital. Outer ring is the target.
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
 {slices.map((slice) => (
 <li key={slice.sector} className="flex items-center justify-between gap-3">
 <span className="flex min-w-0 items-center gap-2">
 <span
 className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
 style={{ background: slice.color }}
 aria-hidden
 />
 <span className="truncate text-[var(--ink-strong)]">{slice.sector}</span>
 </span>
 <span className="tabular-nums text-[var(--ink-strong)]">
 {fmtPct(slice.percentOfPortfolio)}
 </span>
 </li>
 ))}
 </ul>
 </section>
 );
}

/* ────────────────────────────────────────────────────────────────────────── */

function AdjustmentsCard({
 slices,
 totals,
 hasAnyTargets,
}: {
 slices: SectorSlice[];
 totals: { addTotal: number; trimTotal: number; totalDriftAbs: number };
 hasAnyTargets: boolean;
}) {
 return (
 <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-surface)]">
 <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-[var(--line)] px-5 py-4">
 <h2 className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
 Suggested adjustments
 </h2>
 {hasAnyTargets ? (
 <div className="flex flex-wrap items-baseline gap-x-5 text-[13px] tabular-nums">
 <span className="text-[var(--ink-muted)]">
 <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--gain-700)]">
 Add
 </span>{" "}
 <span className="text-[var(--gain-700)]">
 {totals.addTotal > 0 ? formatBdt(totals.addTotal) : "—"}
 </span>
 </span>
 <span className="text-[var(--ink-muted)]">
 <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--warn-700)]">
 Trim
 </span>{" "}
 <span className="text-[var(--warn-700)]">
 {totals.trimTotal > 0 ? formatBdt(totals.trimTotal) : "—"}
 </span>
 </span>
 </div>
 ) : null}
 </header>

 {!hasAnyTargets ? (
 <p className="px-5 py-8 text-center text-[13px] text-[var(--ink-muted)]">
 Set sector targets in <span className="text-[var(--ink-strong)]">Settings → Sector targets</span> to see rebalance suggestions.
 </p>
 ) : (
 <ul>
 {slices.map((slice, i) => (
 <AdjustmentRow key={slice.sector} slice={slice} isLast={i === slices.length - 1} />
 ))}
 </ul>
 )}
 </section>
 );
}

function AdjustmentRow({ slice, isLast }: { slice: SectorSlice; isLast: boolean }) {
 const driftBdt = slice.driftBdt ?? 0;
 const driftPct = slice.driftPct ?? 0;
 const action: "add" | "trim" | null =
 Math.abs(driftBdt) < 1 ? null : driftBdt < 0 ? "add" : "trim";
 const actionClass =
 action === "add"
 ? "text-[var(--gain-700)]"
 : action === "trim"
 ? "text-[var(--warn-700)]"
 : "text-[var(--ink-muted)]";
 const driftClass =
 driftPct > 0 ? "text-[var(--warn-700)]" : driftPct < 0 ? "text-[var(--gain-700)]" : "text-[var(--ink-muted)]";
 const rowBorder = isLast ? "" : "border-b border-[var(--line)]";

 return (
 <li className={`px-5 py-4 ${rowBorder}`}>
 <div className="grid grid-cols-2 items-start gap-x-4 gap-y-3 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_minmax(0,1.1fr)] md:items-center md:gap-x-6">
 {/* Sector name + invested vs target */}
 <div className="col-span-2 flex items-start gap-2 md:col-span-1">
 <span
 className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
 style={{ background: slice.color }}
 aria-hidden
 />
 <div className="flex flex-col">
 <span className="text-[14px] text-[var(--ink-strong)]">{slice.sector}</span>
 <span className="text-[12px] text-[var(--ink-muted)] tabular-nums">
 Invested {formatBdt(slice.investedBdt)} ·{" "}
 <span>
 target{" "}
 {slice.targetPercent !== null && slice.driftBdt !== null
 ? formatBdt(slice.investedBdt - slice.driftBdt)
 : "—"}
 </span>
 </span>
 </div>
 </div>

 <StatCell label="Actual" value={fmtPct(slice.percentOfPortfolio)} />
 <StatCell
 label="Target"
 value={slice.targetPercent !== null ? fmtPct(slice.targetPercent) : "—"}
 />
 <StatCell
 label="Drift"
 value={slice.driftPct !== null ? fmtPct(slice.driftPct, true) : "—"}
 valueClass={slice.targetPercent !== null ? driftClass : "text-[var(--ink-muted)]"}
 />

 <div className="col-span-2 text-right md:col-span-1">
 <div className={`text-[10px] uppercase tracking-[0.14em] ${actionClass}`}>
 {action === "add" ? "Add" : action === "trim" ? "Trim" : "On target"}
 </div>
 <div className={`mt-0.5 text-[15px] tabular-nums ${actionClass}`}>
 {action ? formatBdt(Math.abs(driftBdt)) : "—"}
 </div>
 </div>
 </div>
 </li>
 );
}

function StatCell({
 label,
 value,
 valueClass,
}: {
 label: string;
 value: string;
 valueClass?: string;
}) {
 return (
 <div>
 <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">{label}</div>
 <div className={`mt-0.5 text-[14px] tabular-nums ${valueClass ?? "text-[var(--ink-strong)]"}`}>
 {value}
 </div>
 </div>
 );
}
