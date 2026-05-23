"use client";

import { useCallback, useState } from "react";
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
    "Deep Value":  { cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    "Undervalued": { cls: "bg-teal-100 text-teal-800 border-teal-300" },
    "Fair Value":  { cls: "bg-amber-100 text-amber-800 border-amber-300" },
    "Overvalued":  { cls: "bg-red-100 text-red-800 border-red-300" },
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cfg[signal].cls}`}>
      {signal}
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
function PickCard({ pick, rank }: { pick: OraclePickResult; rank: number }) {
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
            <span className="text-[11px] font-medium text-[var(--ink-muted)]">#{rank}</span>
            <span className="text-[17px] font-bold text-[var(--ink-strong)]">{pick.symbol}</span>
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

// ─── Sort icon ────────────────────────────────────────────────────────────────
function SortIcon({ dir }: { dir: "desc" | "asc" }) {
  return dir === "desc"
    ? <span className="ml-0.5 text-[9px]">▼</span>
    : <span className="ml-0.5 text-[9px]">▲</span>;
}

// ─── Watchlist section ────────────────────────────────────────────────────────
function WatchlistSection({ items, topSectors }: { items: OracleWatchlistItem[]; topSectors: string[] }) {
  const [scoreDir, setScoreDir] = useState<"desc" | "asc">("desc");

  if (items.length === 0) return null;

  const topKeys = new Set(topSectors.map((s) => s.trim().toLowerCase()));
  const isTop = (sector: string | null) => sector ? topKeys.has(sector.trim().toLowerCase()) : false;

  const sorted = [...items].sort((a, b) =>
    scoreDir === "desc" ? b.score - a.score : a.score - b.score,
  );

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <h3 className="mb-3 text-[14px] font-semibold text-[var(--ink-strong)]">Watching — Not Buying Yet</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              <th className="pb-1.5 pr-3">Symbol</th>
              <th className="pb-1.5 pr-3">
                <button
                  type="button"
                  onClick={() => setScoreDir((d) => d === "desc" ? "asc" : "desc")}
                  className="flex items-center text-[var(--accent-700)] hover:opacity-80"
                >
                  Score<SortIcon dir={scoreDir} />
                </button>
              </th>
              <th className="pb-1.5 pr-3">LTP</th>
              <th className="pb-1.5 pr-3">Graham #</th>
              <th className="pb-1.5 pr-3">MoS%</th>
              <th className="pb-1.5 pr-3">EY%</th>
              <th className="pb-1.5">ROE%</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => {
              const adv = item.advanced;
              const mosPositive = adv.marginOfSafety !== null && adv.marginOfSafety > 0;
              const eyGood = adv.earningsYield !== null && adv.earningsYield / 100 >= 0.095;
              return (
                <tr key={item.symbol} className="border-b border-[var(--line)]/40">
                  <td className="py-1.5 pr-3">
                    <span className={`font-semibold ${isTop(item.sector) ? "text-[var(--accent-700)]" : "text-[var(--ink-strong)]"}`}>
                      {item.symbol}
                    </span>
                    {item.sector && (
                      <span className="ml-1.5 text-[10px] text-[var(--ink-muted)]">{item.sector}</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums text-[var(--ink-muted)]">{item.score}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{fmtPrice(item.currentPrice)}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{fmtPrice(adv.grahamNumber ?? null)}</td>
                  <td className={`py-1.5 pr-3 tabular-nums font-medium ${mosPositive ? "text-emerald-700" : "text-[var(--ink-muted)]"}`}>
                    {adv.marginOfSafety !== null ? `${adv.marginOfSafety > 0 ? "+" : ""}${fmt(adv.marginOfSafety, "%")}` : "—"}
                  </td>
                  <td className={`py-1.5 pr-3 tabular-nums font-medium ${eyGood ? "text-emerald-700" : "text-[var(--ink-muted)]"}`}>
                    {fmt(adv.earningsYield, "%")}
                  </td>
                  <td className="py-1.5 tabular-nums text-[var(--ink-muted)]">{fmt(adv.roe, "%")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Holdings analysis section ────────────────────────────────────────────────
const SIGNAL_CFG: Record<HoldingSignal, { dot: string; label: string; text: string }> = {
  "Strong Add": { dot: "bg-emerald-500", label: "Strong Add", text: "text-emerald-700" },
  "Add":        { dot: "bg-teal-500",    label: "Add",        text: "text-teal-700" },
  "Hold":       { dot: "bg-amber-500",   label: "Hold",       text: "text-amber-700" },
  "Trim":       { dot: "bg-orange-500",  label: "Trim",       text: "text-orange-700" },
  "Exit":       { dot: "bg-red-500",     label: "Exit",       text: "text-red-700" },
};

function HoldingsSection({ holdings }: { holdings: OracleHoldingAnalysis[] }) {
  const [scoreDir, setScoreDir] = useState<"desc" | "asc">("desc");

  if (holdings.length === 0) return null;

  const sorted = [...holdings].sort((a, b) =>
    scoreDir === "desc" ? b.score - a.score : a.score - b.score,
  );

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <h3 className="mb-3 text-[14px] font-semibold text-[var(--ink-strong)]">Portfolio Analysis</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              <th className="pb-1.5 pr-3">Symbol</th>
              <th className="pb-1.5 pr-3">
                <button
                  type="button"
                  onClick={() => setScoreDir((d) => d === "desc" ? "asc" : "desc")}
                  className="flex items-center text-[var(--accent-700)] hover:opacity-80"
                >
                  Score<SortIcon dir={scoreDir} />
                </button>
              </th>
              <th className="pb-1.5 pr-3">Signal</th>
              <th className="pb-1.5 pr-3">LTP</th>
              <th className="pb-1.5 pr-3">P/L%</th>
              <th className="pb-1.5 pr-3">Graham #</th>
              <th className="pb-1.5 pr-3">MoS%</th>
              <th className="pb-1.5 pr-3">EY%</th>
              <th className="pb-1.5">ROE%</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => {
              const cfg = SIGNAL_CFG[h.signal];
              const adv = h.advanced as { grahamNumber?: number | null; marginOfSafety?: number | null; earningsYield?: number | null; roe?: number | null };
              const plPositive = (h.unrealizedPLPct ?? 0) >= 0;
              const mosPositive = (adv.marginOfSafety ?? null) !== null && (adv.marginOfSafety ?? 0) > 0;
              return (
                <tr key={h.symbol} className="border-b border-[var(--line)]/40">
                  <td className="py-1.5 pr-3">
                    <span className="font-semibold text-[var(--ink-strong)]">{h.symbol}</span>
                    {h.sector && <span className="ml-1.5 text-[10px] text-[var(--ink-muted)]">{h.sector}</span>}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums text-[var(--ink-muted)]">{h.score > 0 ? h.score : "—"}</td>
                  <td className="py-1.5 pr-3">
                    <span className={`flex items-center gap-1 font-semibold ${cfg.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">{fmtPrice(h.currentPrice)}</td>
                  <td className={`py-1.5 pr-3 tabular-nums font-medium ${plPositive ? "text-emerald-700" : "text-red-600"}`}>
                    {h.unrealizedPLPct !== null ? `${plPositive ? "+" : ""}${fmt(h.unrealizedPLPct, "%")}` : "—"}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">{fmtPrice(adv.grahamNumber ?? null)}</td>
                  <td className={`py-1.5 pr-3 tabular-nums font-medium ${mosPositive ? "text-emerald-700" : "text-[var(--ink-muted)]"}`}>
                    {adv.marginOfSafety !== null && adv.marginOfSafety !== undefined
                      ? `${adv.marginOfSafety > 0 ? "+" : ""}${fmt(adv.marginOfSafety, "%")}`
                      : "—"}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums text-[var(--ink-muted)]">{fmt(adv.earningsYield ?? null, "%")}</td>
                  <td className="py-1.5 tabular-nums text-[var(--ink-muted)]">{fmt(adv.roe ?? null, "%")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Signal explanation for the first holding with a non-Hold signal */}
      {(() => {
        const notable = sorted.find((h) => h.signal !== "Hold" && h.signalReason);
        return notable ? (
          <p className="mt-2 text-[11px] text-[var(--ink-muted)]">
            <span className={`font-medium ${SIGNAL_CFG[notable.signal].text}`}>{notable.symbol} — {notable.signal}:</span>{" "}
            {notable.signalReason}
          </p>
        ) : null;
      })()}
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
export function TradeDeskView({ initialData }: { initialData: TradeDeskData }) {
  const [data, setData] = useState<TradeDeskData>(initialData);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trade-desk", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as TradeDeskData;
        setData(json);
        setLastRefreshed(new Date());
      }
    } catch { /* silently ignore */ } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Refresh button only */}
      <div className="flex justify-end">
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

      {data.picks.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          {data.picks.map((pick, i) => (
            <PickCard key={pick.symbol} pick={pick} rank={i + 1} />
          ))}
        </div>
      )}

      <HoldingsSection holdings={data.holdings} />
      <WatchlistSection items={data.watchlist} topSectors={data.topSectors} />
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
