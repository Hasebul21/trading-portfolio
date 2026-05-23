import type { OraclePickResult } from "@/lib/market/oracle-scoring";

function fmt(n: number | null, suffix = "", dec = 1): string {
  if (n === null) return "—";
  return n.toFixed(dec) + suffix;
}
function fmtPrice(n: number | null): string {
  if (n === null) return "—";
  return `৳${n.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

/**
 * Compact table of high-scoring DSE names outside the user's
 * watchlist/portfolio. Pure server component — rendered inside a Suspense
 * boundary so the slow universe scan never blocks the main Trade Desk view.
 */
export function DiscoverySection({
  items,
  topSectors,
}: {
  items: OraclePickResult[];
  topSectors: string[];
}) {
  if (items.length === 0) return null;

  const topKeys = new Set(topSectors.map((s) => s.trim().toLowerCase()));
  const isTop = (sector: string | null) =>
    sector ? topKeys.has(sector.trim().toLowerCase()) : false;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-semibold text-[var(--ink-strong)]">Discovery — Off Your Radar</h3>
        <span className="text-[11px] text-[var(--ink-muted)]">scored from the wider DSE universe</span>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-[var(--ink-muted)]">
        These names cleared the Oracle gates and scored ≥60 but aren&apos;t in your Watchlist or Portfolio.
        One per sector, max {items.length}. Add to Watchlist if you want them tracked.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              <th className="pb-1.5 pr-3">Symbol</th>
              <th className="pb-1.5 pr-3">Score</th>
              <th className="pb-1.5 pr-3">LTP</th>
              <th className="pb-1.5 pr-3">Buy Zone</th>
              <th className="pb-1.5 pr-3">Graham #</th>
              <th className="pb-1.5 pr-3">MoS%</th>
              <th className="pb-1.5 pr-3">EY%</th>
              <th className="pb-1.5">ROE%</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => {
              const adv = p.advanced;
              const mosPositive = adv.marginOfSafety !== null && adv.marginOfSafety > 0;
              const eyGood = adv.earningsYield !== null && adv.earningsYield / 100 >= 0.095;
              return (
                <tr key={p.symbol} className="border-b border-[var(--line)]/40">
                  <td className="py-1.5 pr-3">
                    <span className={`font-semibold ${isTop(p.sector) ? "text-[var(--accent-700)]" : "text-[var(--ink-strong)]"}`}>
                      {p.symbol}
                    </span>
                    {p.sector && (
                      <span className="ml-1.5 text-[10px] text-[var(--ink-muted)]">{p.sector}</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums font-semibold text-[var(--ink-strong)]">{p.score}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{fmtPrice(p.currentPrice)}</td>
                  <td className="py-1.5 pr-3 tabular-nums text-[var(--ink-muted)]">
                    {fmtPrice(p.buyZoneLow)}–{fmtPrice(p.buyZoneHigh)}
                  </td>
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

/** Lightweight skeleton shown while the universe scan is in flight. */
export function DiscoverySkeleton() {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-semibold text-[var(--ink-strong)]">Discovery — Off Your Radar</h3>
        <span className="text-[11px] text-[var(--ink-muted)]">scanning DSE universe…</span>
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-6 w-full animate-pulse rounded bg-[var(--bg-surface-soft)]" />
        ))}
      </div>
    </div>
  );
}
