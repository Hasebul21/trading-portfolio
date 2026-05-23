"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  OracleResult,
  OraclePickResult,
  OracleWatchlistItem,
  OracleGateReject,
  OracleHoldingAnalysis,
  HoldingSignal,
  ValuationSignal,
} from "@/lib/market/oracle-scoring";

export type TradeDeskData = OracleResult & {
  totalSymbols: number;
  gatedOut: number;
  topSectors: string[];
};

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 75 ? "text-emerald-700 border-emerald-300 bg-emerald-50"
      : score >= 62 ? "text-teal-700 border-teal-300 bg-teal-50"
        : "text-amber-700 border-amber-300 bg-amber-50";
  return (
    <div className={`flex flex-col items-center justify-center rounded-full border-2 h-14 w-14 shrink-0 ${cls}`}>
      <span className="text-[17px] font-bold leading-none">{score}</span>
      <span className="text-[9px] leading-none opacity-70">/ 100</span>
    </div>
  );
}

// ─── Valuation signal badge ───────────────────────────────────────────────────
function ValuationBadge({ signal }: { signal: ValuationSignal | null }) {
  if (!signal) return null;
  const cfg: Record<ValuationSignal, { cls: string }> = {
    "Deep Value": { cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    "Undervalued": { cls: "bg-teal-100 text-teal-800 border-teal-300" },
    "Fair Value": { cls: "bg-amber-100 text-amber-800 border-amber-300" },
    "Overvalued": { cls: "bg-red-100 text-red-800 border-red-300" },
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cfg[signal].cls}`}>
      {signal}
    </span>
  );
}

// ─── Source badge ─────────────────────────────────────────────────────────────
// Identifies where each card came from in the unified opportunity grid.
type CardSource = "pick" | "holding" | "watch" | "discovery";
const SOURCE_CFG: Record<CardSource, { label: string; cls: string }> = {
  pick:      { label: "Top Pick",  cls: "bg-violet-100 text-violet-800 border-violet-300" },
  holding:   { label: "Holding",   cls: "bg-blue-100 text-blue-800 border-blue-300" },
  watch:     { label: "Watchlist", cls: "bg-slate-100 text-slate-700 border-slate-300" },
  discovery: { label: "Discovery", cls: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300" },
};
function SourceBadge({ source }: { source: CardSource }) {
  const cfg = SOURCE_CFG[source];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Advanced metric row ──────────────────────────────────────────────────────
function AdvRow({
  label,
  value,
  context,
  highlight,
}: {
  label: string;
  value: string;
  context?: string;
  highlight?: "positive" | "negative" | "neutral";
}) {
  const valueColor =
    highlight === "positive" ? "text-emerald-700"
      : highlight === "negative" ? "text-red-600"
        : "text-[var(--ink-strong)]";
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-4 py-1 text-[12px]">
      <div>
        <span className="text-[var(--ink-muted)]">{label}</span>
        {context && <span className="ml-1.5 text-[10px] text-[var(--ink-muted)] opacity-60">{context}</span>}
      </div>
      <span className={`font-semibold tabular-nums ${valueColor}`}>{value}</span>
    </div>
  );
}

function fmt(n: number | null, suffix = "", dec = 1): string {
  if (n === null) return "—";
  return n.toFixed(dec) + suffix;
}
function fmtPrice(n: number | null): string {
  if (n === null) return "—";
  return `৳${n.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

// ─── Score breakdown (5-pillar grouped) ──────────────────────────────────────
function ScoreBreakdown({ pick }: { pick: OraclePickResult }) {
  const b = pick.breakdown;
  const pillars: { label: string; max: number; items: [string, number, number][] }[] = [
    {
      label: "Valuation", max: 30,
      items: [
        ["P/E Ratio", b.peScore, 10],
        ["Graham MoS", b.grahamScore, 12],
        ["Earnings Yield", b.earningsYieldScore, 8],
      ],
    },
    {
      label: "Quality", max: 25,
      items: [
        ["Return on Equity", b.roeScore, 12],
        ["Dividend Yield", b.divYieldScore, 8],
        ["Payout Sustainability", b.divPayoutScore, 5],
      ],
    },
    {
      label: "Safety", max: 20,
      items: [
        ["Market Cap", b.marketCapScore, 6],
        ["Free Float", b.freeFloatScore, 5],
        ["Listing Age", b.listingAgeScore, 5],
        ["DSE Category", b.categoryScore, 4],
      ],
    },
    {
      label: "Technical", max: 25,
      items: [
        ["52W Position", b.position52wScore, 12],
        ["Drawdown Recovery", b.drawdownScore, 8],
        ["Price / Book", b.priceNavScore, 5],
      ],
    },
  ];
  return (
    <div className="mt-2 rounded-lg bg-[var(--bg-canvas)] px-3 py-2 text-[11px]">
      {pillars.map((pillar) => {
        const pillarTotal = pillar.items.reduce((s, [, v]) => s + v, 0);
        return (
          <div key={pillar.label} className="mb-2 last:mb-0">
            <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              <span>{pillar.label}</span>
              <span>{pillarTotal}/{pillar.max}</span>
            </div>
            {pillar.items.map(([lbl, pts, mx]) => (
              <div key={lbl} className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-[var(--ink-muted)]">{lbl}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--line)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent-700)]"
                      style={{ width: `${Math.min(100, (pts / mx) * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-[var(--ink-strong)]">{pts}/{mx}</span>
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <div className="mt-2 flex items-center justify-between border-t border-[var(--line)] pt-1.5">
        <span className="font-semibold text-[var(--ink-strong)]">Total</span>
        <span className="font-bold text-[var(--ink-strong)]">{b.total}/100</span>
      </div>
    </div>
  );
}

// ─── Pick card ────────────────────────────────────────────────────────────────
function PickCard({ pick, source }: { pick: OraclePickResult; source: "pick" | "discovery" }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const convColor =
    pick.conviction === "High Conviction"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : pick.conviction === "Strong Buy"
        ? "bg-teal-100 text-teal-800 border-teal-200"
        : "bg-blue-100 text-blue-800 border-blue-200";

  const adv = pick.advanced;

  // Earnings yield vs risk-free comparison
  const eyHighlight = adv.earningsYield !== null
    ? (adv.earningsYield / 100 >= 0.095 ? "positive" as const : "negative" as const)
    : "neutral" as const;
  const mosHighlight = adv.marginOfSafety !== null
    ? (adv.marginOfSafety > 0 ? "positive" as const : "negative" as const)
    : "neutral" as const;
  const roeHighlight = adv.roe !== null
    ? (adv.roe >= 15 ? "positive" as const : adv.roe >= 8 ? "neutral" as const : "negative" as const)
    : "neutral" as const;
  const ddHighlight = adv.drawdownFromHigh !== null
    ? (adv.drawdownFromHigh >= -20 ? "positive" as const : "negative" as const)
    : "neutral" as const;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3">
        <ScoreBadge score={pick.score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[17px] font-bold text-[var(--ink-strong)]">{pick.symbol}</span>
            <SourceBadge source={source} />
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${convColor}`}>
              {pick.conviction}
            </span>
            <ValuationBadge signal={adv.valuationSignal} />
          </div>
          {pick.sector && <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">{pick.sector}</p>}
          {pick.reasonTags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {pick.reasonTags.map((tag) => (
                <span key={tag} className="rounded-full bg-[var(--bg-surface-soft)] px-2 py-0.5 text-[11px] text-[var(--ink-muted)]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Price snapshot */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11.5px]">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">LTP</p>
          <p className="font-semibold text-[var(--ink-strong)]">{fmtPrice(pick.currentPrice)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">Buy zone</p>
          <p className="font-semibold text-[var(--ink-strong)]">
            {fmtPrice(pick.buyZoneLow)}–{fmtPrice(pick.buyZoneHigh)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">Target / Stop</p>
          <p className="font-semibold text-[var(--ink-strong)]">
            {pick.targetPrice !== null ? fmtPrice(pick.targetPrice) : "—"}
            <span className="ml-1 text-red-600">/ {fmtPrice(pick.stopLoss)}</span>
          </p>
        </div>
      </div>

      {/* Advanced Analytics Panel */}
      <div className="mt-3 rounded-lg bg-[var(--bg-canvas)] px-3 py-2">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
          Advanced Analytics
        </p>
        <AdvRow
          label="Graham Number"
          value={fmtPrice(adv.grahamNumber)}
          context="Intrinsic value ceiling"
        />
        <AdvRow
          label="Margin of Safety"
          value={adv.marginOfSafety !== null ? `${adv.marginOfSafety > 0 ? "+" : ""}${fmt(adv.marginOfSafety, "%")}` : "—"}
          context="vs Graham Number"
          highlight={mosHighlight}
        />
        <AdvRow
          label="Earnings Yield"
          value={fmt(adv.earningsYield, "%")}
          context="BD risk-free ~9.5%"
          highlight={eyHighlight}
        />
        <AdvRow
          label="Return on Equity"
          value={fmt(adv.roe, "%")}
          context="≥15% = strong"
          highlight={roeHighlight}
        />
        <AdvRow
          label="Div Payout Ratio"
          value={fmt(adv.dividendPayoutRatio, "%")}
          context="<75% = sustainable"
          highlight={
            adv.dividendPayoutRatio !== null
              ? adv.dividendPayoutRatio <= 75 ? "positive" : "negative"
              : "neutral"
          }
        />
        <AdvRow
          label="Drawdown from Peak"
          value={adv.drawdownFromHigh !== null ? `${fmt(adv.drawdownFromHigh, "%")}` : "—"}
          context="Entry timing signal"
          highlight={ddHighlight}
        />
        <AdvRow
          label="Recovery from Low"
          value={adv.recoveryFromLow !== null ? `+${fmt(adv.recoveryFromLow, "%")}` : "—"}
          context="Off 52W trough"
          highlight={adv.recoveryFromLow !== null ? "positive" : "neutral"}
        />
      </div>

      {/* Score breakdown toggle */}
      <button
        onClick={() => setShowBreakdown((v) => !v)}
        className="mt-2 text-[11px] text-[var(--accent-700)] hover:underline focus:outline-none"
        type="button"
      >
        {showBreakdown ? "Hide" : "Show"} score breakdown
      </button>

      {showBreakdown && <ScoreBreakdown pick={pick} />}
    </div>
  );
}

// ─── Watchlist entry prediction ──────────────────────────────────────────────
/**
 * BUY  — fundamentals support entering now even though the overall score
 *         is below the picks threshold.
 * WAIT — price or quality conditions aren't favourable yet; keep watching.
 *
 * Scoring (+points):
 *   MoS ≥ 15%   +2  (significantly below Graham intrinsic value)
 *   MoS > 0%    +1  (below Graham, any amount)
 *   EY ≥ 9.5%   +1  (earnings yield beats Bangladesh risk-free)
 *   ROE ≥ 15%   +1  (quality equity returns)
 *   Score ≥ 50  +1  (close to the picks threshold)
 *
 *  ≥ 2 pts → BUY   |   < 2 pts → WAIT
 */
function watchlistPrediction(item: OracleWatchlistItem): "BUY" | "WAIT" {
  const { marginOfSafety, earningsYield, roe } = item.advanced;
  let pts = 0;
  if (marginOfSafety !== null && marginOfSafety >= 15) pts += 2;
  else if (marginOfSafety !== null && marginOfSafety > 0) pts += 1;
  if (earningsYield !== null && earningsYield / 100 >= 0.095) pts += 1;
  if (roe !== null && roe >= 15) pts += 1;
  if (item.score >= 50) pts += 1;
  return pts >= 2 ? "BUY" : "WAIT";
}

// ─── Holding signal config ────────────────────────────────────────────────────
const SIGNAL_CFG: Record<HoldingSignal, { dot: string; label: string; text: string; cls: string }> = {
  "Strong Add": { dot: "bg-emerald-500", label: "Strong Add", text: "text-emerald-700", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  "Add":        { dot: "bg-teal-500",    label: "Add",        text: "text-teal-700",    cls: "bg-teal-100 text-teal-800 border-teal-300" },
  "Hold":       { dot: "bg-amber-500",   label: "Hold",       text: "text-amber-700",   cls: "bg-amber-100 text-amber-800 border-amber-300" },
  "Trim":       { dot: "bg-orange-500",  label: "Trim",       text: "text-orange-700",  cls: "bg-orange-100 text-orange-800 border-orange-300" },
  "Exit":       { dot: "bg-red-500",     label: "Exit",       text: "text-red-700",     cls: "bg-red-100 text-red-800 border-red-300" },
};

// ─── Holding card ─────────────────────────────────────────────────────────────
// Portfolio position with shares, avg cost, P&L and the Oracle signal.
function HoldingCard({ holding }: { holding: OracleHoldingAnalysis }) {
  const cfg = SIGNAL_CFG[holding.signal];
  const adv = holding.advanced;
  const plPositive = (holding.unrealizedPLPct ?? 0) >= 0;

  const mosHighlight = adv.marginOfSafety != null
    ? (adv.marginOfSafety > 0 ? "positive" as const : "negative" as const)
    : "neutral" as const;
  const eyHighlight = adv.earningsYield != null
    ? (adv.earningsYield / 100 >= 0.095 ? "positive" as const : "negative" as const)
    : "neutral" as const;
  const roeHighlight = adv.roe != null
    ? (adv.roe >= 15 ? "positive" as const : adv.roe >= 8 ? "neutral" as const : "negative" as const)
    : "neutral" as const;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <ScoreBadge score={holding.score > 0 ? holding.score : 0} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[17px] font-bold text-[var(--ink-strong)]">{holding.symbol}</span>
            <SourceBadge source="holding" />
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.cls}`}>
              {cfg.label}
            </span>
          </div>
          {holding.sector && <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">{holding.sector}</p>}
          {holding.signal !== "Hold" && holding.signalReason && (
            <p className={`mt-1 text-[11.5px] ${cfg.text}`}>{holding.signalReason}</p>
          )}
        </div>
      </div>

      {/* Position snapshot */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11.5px]">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">LTP / Avg</p>
          <p className="font-semibold text-[var(--ink-strong)]">
            {fmtPrice(holding.currentPrice)}
            <span className="ml-1 text-[var(--ink-muted)]">/ {fmtPrice(holding.avgCost)}</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">Shares</p>
          <p className="font-semibold text-[var(--ink-strong)] tabular-nums">{holding.shares.toLocaleString("en-IN")}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">P/L</p>
          <p className={`font-semibold tabular-nums ${plPositive ? "text-emerald-700" : "text-red-600"}`}>
            {holding.unrealizedPLPct !== null ? `${plPositive ? "+" : ""}${fmt(holding.unrealizedPLPct, "%")}` : "—"}
          </p>
        </div>
      </div>

      {/* Advanced Analytics */}
      <div className="mt-3 rounded-lg bg-[var(--bg-canvas)] px-3 py-2">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
          Advanced Analytics
        </p>
        <AdvRow label="Graham Number" value={fmtPrice(adv.grahamNumber ?? null)} context="Intrinsic value ceiling" />
        <AdvRow
          label="Margin of Safety"
          value={adv.marginOfSafety != null ? `${adv.marginOfSafety > 0 ? "+" : ""}${fmt(adv.marginOfSafety, "%")}` : "—"}
          context="vs Graham Number"
          highlight={mosHighlight}
        />
        <AdvRow label="Earnings Yield" value={fmt(adv.earningsYield ?? null, "%")} context="BD risk-free ~9.5%" highlight={eyHighlight} />
        <AdvRow label="Return on Equity" value={fmt(adv.roe ?? null, "%")} context="≥15% = strong" highlight={roeHighlight} />
      </div>
    </div>
  );
}

// ─── Watch card ───────────────────────────────────────────────────────────────
// Watchlist entry — has a score but did not clear the Oracle pick threshold.
function WatchCard({ item }: { item: OracleWatchlistItem }) {
  const adv = item.advanced;
  const pred = watchlistPrediction(item);

  const mosHighlight = adv.marginOfSafety != null
    ? (adv.marginOfSafety > 0 ? "positive" as const : "negative" as const)
    : "neutral" as const;
  const eyHighlight = adv.earningsYield != null
    ? (adv.earningsYield / 100 >= 0.095 ? "positive" as const : "negative" as const)
    : "neutral" as const;
  const roeHighlight = adv.roe != null
    ? (adv.roe >= 15 ? "positive" as const : adv.roe >= 8 ? "neutral" as const : "negative" as const)
    : "neutral" as const;

  const predCls = pred === "BUY"
    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
    : "bg-amber-100 text-amber-800 border-amber-300";

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <ScoreBadge score={item.score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[17px] font-bold text-[var(--ink-strong)]">{item.symbol}</span>
            <SourceBadge source="watch" />
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${predCls}`}>
              {pred}
            </span>
          </div>
          {item.sector && <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">{item.sector}</p>}
          {item.trigger && <p className="mt-1 text-[11.5px] text-[var(--ink-muted)]">{item.trigger}</p>}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">LTP</p>
          <p className="font-semibold text-[var(--ink-strong)]">{fmtPrice(item.currentPrice)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">Graham #</p>
          <p className="font-semibold text-[var(--ink-strong)]">{fmtPrice(adv.grahamNumber ?? null)}</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-[var(--bg-canvas)] px-3 py-2">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
          Advanced Analytics
        </p>
        <AdvRow
          label="Margin of Safety"
          value={adv.marginOfSafety != null ? `${adv.marginOfSafety > 0 ? "+" : ""}${fmt(adv.marginOfSafety, "%")}` : "—"}
          context="vs Graham Number"
          highlight={mosHighlight}
        />
        <AdvRow label="Earnings Yield" value={fmt(adv.earningsYield ?? null, "%")} context="BD risk-free ~9.5%" highlight={eyHighlight} />
        <AdvRow label="Return on Equity" value={fmt(adv.roe ?? null, "%")} context="≥15% = strong" highlight={roeHighlight} />
      </div>
    </div>
  );
}
// ─── Avoided section ──────────────────────────────────────────────────────────
function AvoidedSection({ items }: { items: OracleGateReject[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <h3 className="mb-3 text-[14px] font-semibold text-[var(--ink-strong)]">Filtered Out</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div key={item.symbol} className="flex items-center gap-1.5 rounded-full bg-[var(--loss-50)] px-2.5 py-1 text-[11px] text-[var(--loss-700)]">
            <span className="font-semibold">{item.symbol}</span>
            <span className="opacity-70">·</span>
            <span>{item.reason}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────
type UnifiedItem =
  | { kind: "pick"; symbol: string; score: number; data: OraclePickResult }
  | { kind: "discovery"; symbol: string; score: number; data: OraclePickResult }
  | { kind: "holding"; symbol: string; score: number; data: OracleHoldingAnalysis }
  | { kind: "watch"; symbol: string; score: number; data: OracleWatchlistItem };

// Priority used when the same symbol appears in multiple buckets — keep the
// most informative card representation.
const KIND_PRIORITY: Record<UnifiedItem["kind"], number> = {
  holding: 4, // own position is most important context
  pick: 3,
  discovery: 2,
  watch: 1,
};

function buildUnifiedItems(data: TradeDeskData): UnifiedItem[] {
  const bySymbol = new Map<string, UnifiedItem>();
  const consider = (next: UnifiedItem) => {
    const prev = bySymbol.get(next.symbol);
    if (!prev || KIND_PRIORITY[next.kind] > KIND_PRIORITY[prev.kind]) {
      bySymbol.set(next.symbol, next);
    }
  };
  for (const p of data.picks)     consider({ kind: "pick",      symbol: p.symbol, score: p.score, data: p });
  for (const h of data.holdings)  consider({ kind: "holding",   symbol: h.symbol, score: h.score, data: h });
  for (const d of data.discovery) consider({ kind: "discovery", symbol: d.symbol, score: d.score, data: d });
  for (const w of data.watchlist) consider({ kind: "watch",     symbol: w.symbol, score: w.score, data: w });
  return [...bySymbol.values()].sort((a, b) => b.score - a.score);
}

const PAGE_SIZE = 12;

export function TradeDeskView({ initialData }: { initialData: TradeDeskData }) {
  const [data, setData] = useState<TradeDeskData>(initialData);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trade-desk", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as TradeDeskData;
        setData(json);
        setPage(1);
      }
    } catch { /* silently ignore */ } finally {
      setLoading(false);
    }
  }, []);

  const items = useMemo(() => buildUnifiedItems(data), [data]);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      {/* Header row: counts + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-[var(--ink-muted)]">
          {items.length} opportunit{items.length === 1 ? "y" : "ies"} ranked by Oracle score
          {items.length > PAGE_SIZE && <> · showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, items.length)}</>}
        </p>
        <button
          onClick={() => void handleRefresh()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink-strong)] shadow-sm hover:bg-[var(--bg-surface-soft)] disabled:opacity-50"
          type="button"
        >
          <RefreshIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Unified card grid */}
      {pageItems.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((item) => {
            if (item.kind === "pick" || item.kind === "discovery") {
              return <PickCard key={`${item.kind}:${item.symbol}`} pick={item.data} source={item.kind} />;
            }
            if (item.kind === "holding") {
              return <HoldingCard key={`holding:${item.symbol}`} holding={item.data} />;
            }
            return <WatchCard key={`watch:${item.symbol}`} item={item.data} />;
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg-surface)] p-6 text-center text-[12.5px] text-[var(--ink-muted)]">
          No scored opportunities right now. Try refreshing in a few minutes.
        </p>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-[12.5px]">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-1 font-medium text-[var(--ink-strong)] hover:bg-[var(--bg-surface-soft)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="tabular-nums text-[var(--ink-muted)]">Page {safePage} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-1 font-medium text-[var(--ink-strong)] hover:bg-[var(--bg-surface-soft)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}

      <AvoidedSection items={data.avoided} />

      <p className="text-[11px] leading-relaxed text-[var(--ink-muted)]">{data.disclaimer}</p>
    </div>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
