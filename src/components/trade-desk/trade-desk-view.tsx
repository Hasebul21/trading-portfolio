"use client";

import { useCallback, useState } from "react";
import type {
  OracleResult,
  OraclePickResult,
  OracleWatchlistItem,
  OracleGateReject,
  OracleSentiment,
} from "@/lib/market/oracle-scoring";

// ─── Types mirrored for client (serialised from server) ──────────────────────
export type TradeDeskData = OracleResult & {
  totalSymbols: number;
  gatedOut: number;
  topSectors: string[];
};

// ─── Sentiment badge ──────────────────────────────────────────────────────────
function SentimentBadge({ sentiment, reason }: { sentiment: OracleSentiment; reason: string }) {
  const colors: Record<OracleSentiment, string> = {
    Bullish: "bg-emerald-50 border-emerald-200 text-emerald-800",
    Neutral: "bg-amber-50 border-amber-200 text-amber-800",
    Cautious: "bg-red-50 border-red-200 text-red-800",
  };
  const dots: Record<OracleSentiment, string> = {
    Bullish: "bg-emerald-500",
    Neutral: "bg-amber-500",
    Cautious: "bg-red-500",
  };
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ${colors[sentiment]}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${dots[sentiment]}`} />
      <span>
        <span className="font-semibold">{sentiment}</span>
        {" — "}
        {reason}
      </span>
    </div>
  );
}

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreBadge({ score, conviction }: { score: number; conviction: string }) {
  const color =
    score >= 85
      ? "text-emerald-700 border-emerald-300 bg-emerald-50"
      : score >= 75
      ? "text-teal-700 border-teal-300 bg-teal-50"
      : "text-amber-700 border-amber-300 bg-amber-50";
  return (
    <div className={`flex flex-col items-center justify-center rounded-full border-2 h-14 w-14 shrink-0 ${color}`}>
      <span className="text-[17px] font-bold leading-none">{score}</span>
      <span className="text-[9px] leading-none opacity-70">/ 100</span>
    </div>
  );
}

// ─── Metric row ───────────────────────────────────────────────────────────────
function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5 text-[12px]">
      <span className="text-[var(--ink-muted)]">{label}</span>
      <span className="font-medium text-[var(--ink-strong)] tabular-nums">{value}</span>
    </div>
  );
}

function fmt(n: number | null, suffix = "", decimals = 1): string {
  if (n === null) return "—";
  return n.toFixed(decimals) + suffix;
}

function fmtPrice(n: number | null): string {
  if (n === null) return "—";
  return `৳${n.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
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

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] p-4 shadow-sm">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <ScoreBadge score={pick.score} conviction={pick.conviction} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-[var(--ink-muted)]">#{rank}</span>
            <span className="text-[17px] font-bold text-[var(--ink-strong)]">{pick.symbol}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${convColor}`}>
              {pick.conviction}
            </span>
          </div>
          {pick.sector && (
            <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">{pick.sector}</p>
          )}
          {/* Reason tags */}
          {pick.reasonTags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {pick.reasonTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[var(--bg-surface-soft)] px-2 py-0.5 text-[11px] text-[var(--ink-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-0 rounded-lg bg-[var(--bg-canvas)] px-3 py-2 sm:grid-cols-3">
        <MetricRow label="LTP" value={fmtPrice(pick.currentPrice)} />
        <MetricRow label="Buy Zone" value={`${fmtPrice(pick.buyZoneLow)}–${fmtPrice(pick.buyZoneHigh)}`} />
        <MetricRow label="Target" value={pick.targetPrice !== null ? `${fmtPrice(pick.targetPrice)} (${fmt(pick.upsidePct, "%", 1)})` : "—"} />
        <MetricRow label="Stop Loss" value={`${fmtPrice(pick.stopLoss)} (−${fmt(pick.downsidePct, "%", 1)})`} />
        <MetricRow label="Horizon" value={pick.horizon} />
        <MetricRow label="Allocation" value={`${pick.allocationPct}%`} />
        <MetricRow label="P/E" value={fmt(pick.pe, "×")} />
        <MetricRow label="Price / NAV" value={fmt(pick.priceNav, "×")} />
        <MetricRow label="Div Yield" value={fmt(pick.divYieldPct, "%")} />
        <MetricRow label="52W Position" value={fmt(pick.position52wPct, "%", 0)} />
        <MetricRow label="Beta" value={fmt(pick.beta)} />
      </div>

      {/* Score breakdown toggle */}
      <button
        onClick={() => setShowBreakdown((v) => !v)}
        className="mt-2 text-[11px] text-[var(--accent-700)] hover:underline focus:outline-none"
        type="button"
      >
        {showBreakdown ? "Hide" : "Show"} score breakdown
      </button>

      {showBreakdown && (
        <div className="mt-2 rounded-lg bg-[var(--bg-canvas)] px-3 py-2 text-[11px]">
          {(
            [
              ["P/E", pick.breakdown.pe],
              ["Price/NAV", pick.breakdown.priceNav],
              ["Div Yield", pick.breakdown.divYield],
              ["52W Position", pick.breakdown.position52w],
              ["Div Consistency", pick.breakdown.divConsistency],
              ["Listing Age", pick.breakdown.listingAge],
              ["Beta", pick.breakdown.beta],
              ["Category", pick.breakdown.category],
            ] as [string, number][]
          ).map(([label, pts]) => (
            <div key={label} className="flex items-center justify-between gap-2 py-0.5">
              <span className="text-[var(--ink-muted)]">{label}</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--line)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent-700)]"
                    style={{ width: `${Math.min(100, (pts / 20) * 100)}%` }}
                  />
                </div>
                <span className="w-6 text-right font-mono text-[var(--ink-strong)]">{pts}</span>
              </div>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between border-t border-[var(--line)] pt-1">
            <span className="font-semibold text-[var(--ink-strong)]">Total</span>
            <span className="font-bold text-[var(--ink-strong)]">{pick.breakdown.total}/100</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Allocation summary ───────────────────────────────────────────────────────
// ─── Watchlist section ────────────────────────────────────────────────────────
function WatchlistSection({ items, topSectors }: { items: OracleWatchlistItem[]; topSectors: string[] }) {
  if (items.length === 0) return null;

  const topKeys = new Set(topSectors.map((s) => s.trim().toLowerCase()));
  const isTop = (sector: string | null) =>
    sector ? topKeys.has(sector.trim().toLowerCase()) : false;

  const sorted = topKeys.size === 0 ? items : [
    ...items.filter((i) => isTop(i.sector)),
    ...items.filter((i) => !isTop(i.sector)),
  ];

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <h3 className="mb-3 text-[14px] font-semibold text-[var(--ink-strong)]">
        Watching — Not Buying Yet
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-[var(--ink-muted)]">
              <th className="pb-1.5 pr-4 font-medium">Symbol</th>
              <th className="pb-1.5 pr-4 font-medium">Sector</th>
              <th className="pb-1.5 pr-4 font-medium">Score</th>
              <th className="pb-1.5 pr-4 font-medium">LTP</th>
              <th className="pb-1.5 font-medium">Trigger</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={item.symbol} className="border-b border-[var(--line)]/40">
                <td className="py-1.5 pr-4 font-semibold text-[var(--ink-strong)]">{item.symbol}</td>
                <td className="py-1.5 pr-4 text-[var(--ink-muted)]">
                  {item.sector ? (
                    <span className={isTop(item.sector) ? "font-medium text-[var(--accent-700)]" : ""}>
                      {item.sector}
                    </span>
                  ) : "—"}
                </td>
                <td className="py-1.5 pr-4 tabular-nums text-[var(--ink-muted)]">{item.score}/100</td>
                <td className="py-1.5 pr-4 tabular-nums">{fmtPrice(item.currentPrice)}</td>
                <td className="py-1.5 text-[var(--ink-muted)]">{item.trigger}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Avoided section ─────────────────────────────────────────────────────────
function AvoidedSection({ items }: { items: OracleGateReject[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <h3 className="mb-3 text-[14px] font-semibold text-[var(--ink-strong)]">
        Avoided This Refresh
      </h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div
            key={item.symbol}
            className="flex items-center gap-1.5 rounded-full bg-[var(--loss-50)] px-2.5 py-1 text-[11px] text-[var(--loss-700)]"
          >
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
export function TradeDeskView({
  initialData,
}: {
  initialData: TradeDeskData;
}) {
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
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const genAt = new Date(data.generatedAt);

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--ink-strong)]">Oracle Trade Desk</h2>
          <p className="text-[12px] text-[var(--ink-muted)]">
            {data.totalSymbols} symbols screened · {data.picks.length} picks · {data.gatedOut} filtered out
            {" · "}
            {lastRefreshed
              ? `Refreshed ${lastRefreshed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : `Generated ${genAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`}
          </p>
        </div>
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

      <SentimentBadge sentiment={data.sentiment} reason={data.sentimentReason} />

      {data.picks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg-surface)] px-6 py-8 text-center text-[14px] text-[var(--ink-muted)]">
          No stocks reached the conviction threshold of 65/100 this refresh.
          <br />
          Check the watchlist or try again when market data updates.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
            {data.picks.map((pick, i) => (
              <PickCard key={pick.symbol} pick={pick} rank={i + 1} />
            ))}
          </div>
        </>
      )}

      <WatchlistSection items={data.watchlist} topSectors={data.topSectors} />
      <AvoidedSection items={data.avoided} />

      <p className="text-[11px] leading-relaxed text-[var(--ink-muted)]">
        {data.disclaimer}
      </p>
    </div>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
