import { AppPageStack } from "@/components/app-page-stack";
import { TradeDeskView, type TradeDeskData } from "@/components/trade-desk/trade-desk-view";
import { fetchDseLspQuoteMap } from "@/lib/market/dse-lsp-quotes";
import { fetchDseCompanyExtrasMap } from "@/lib/market/dse-company-52w";
import { scoreDseUniverse } from "@/lib/market/discovery";
import { createClient } from "@/lib/supabase/server";
import { fetchUserHoldings } from "@/lib/holdings";
import {
  computeOracleScore,
  computeHoldingAnalysis,
  computeSentiment,
  ORACLE_DISCLAIMER,
  ORACLE_THRESHOLD,
  type OracleGateReject,
  type OracleHoldingAnalysis,
  type OraclePickResult,
  type OracleWatchlistItem,
} from "@/lib/market/oracle-scoring";

/** Number of top-ranked DSE stocks surfaced as cards on the Trade Desk. */
const TOP_RANKED_LIMIT = 40;

export default async function TradeDeskPage() {
  const supabase = await createClient();
  const [lspRes, ltRes, settingsRes, holdingsRes] = await Promise.all([
    fetchDseLspQuoteMap(),
    supabase.from("long_term_holdings").select("symbol").order("symbol", { ascending: true }),
    supabase.from("user_settings").select("top_sectors").maybeSingle(),
    fetchUserHoldings(),
  ]);

  const rawTopSectors = (settingsRes.data as { top_sectors?: unknown } | null)?.top_sectors;
  const topSectors: string[] = Array.isArray(rawTopSectors)
    ? rawTopSectors.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];

  if (lspRes.error && lspRes.bySymbol.size === 0) {
    return (
      <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto w-full min-w-0 max-w-7xl text-left">
        <div className="rounded-lg bg-[var(--warn-50)] border border-[var(--warn-200)] px-4 py-3 text-[14px] text-amber-900">
          Could not load DSE price data — {lspRes.error}. Try refreshing in a moment.
        </div>
      </AppPageStack>
    );
  }

  const watchlistSet = new Set(
    (ltRes.data ?? []).map((r) => String(r.symbol).trim().toUpperCase()).filter(Boolean),
  );
  const portfolioSet = new Set(
    holdingsRes.holdings.map((h) => h.symbol.trim().toUpperCase()).filter(Boolean),
  );

  // ── 1. Score the entire DSE universe with the Oracle engine ──────────────
  //    `scoreDseUniverse` returns ALL successfully-scored symbols sorted by
  //    score desc — no caps, no min score. From this we slice the top N.
  const { scored: universeScored } = await scoreDseUniverse({
    bySymbol: lspRes.bySymbol,
  });

  // ── 2. Gate rejects across the user's curated lists ──────────────────────
  //    (Watchlist + portfolio symbols that failed an Oracle hard gate.) We
  //    only surface the user's own names here to keep the "Filtered Out"
  //    chip strip useful instead of a wall of 500 DSE names.
  const curatedSymbols = [...new Set([...watchlistSet, ...portfolioSet])];
  const curatedExtras = await fetchDseCompanyExtrasMap(curatedSymbols);
  const gateRejects: OracleGateReject[] = [];
  for (const sym of curatedSymbols) {
    const extras = curatedExtras.get(sym);
    const quote = lspRes.bySymbol.get(sym) ?? null;
    if (!extras || !quote) continue;
    const r = computeOracleScore(sym, extras, quote);
    if (r.type === "gate") gateRejects.push({ symbol: sym, reason: r.reason });
  }

  // ── 3. Take the true top-N from the DSE-wide ranking ─────────────────────
  const topRanked = universeScored.slice(0, TOP_RANKED_LIMIT);
  const topRankedSet = new Set(topRanked.map((s) => s.symbol));

  // ── 4. Partition top-N into the existing payload buckets so each card
  //       still picks up the right "source" badge (Holding / Pick / Watch /
  //       Discovery) in the view. Buckets are disjoint by symbol.
  const picks: OraclePickResult[] = [];
  const watchlist: OracleWatchlistItem[] = [];
  const discovery: OraclePickResult[] = [];
  const topRankedHoldingSymbols = new Set<string>();

  for (const item of topRanked) {
    if (portfolioSet.has(item.symbol)) {
      // Rendered via the holding card; analysis attached below.
      topRankedHoldingSymbols.add(item.symbol);
    } else if (watchlistSet.has(item.symbol)) {
      if (item.score >= ORACLE_THRESHOLD) {
        // High-conviction & in the user's watchlist → Pick card.
        picks.push({ ...item.result, allocationPct: 0 });
      } else {
        // Sub-threshold but in the user's watchlist → Watch card.
        watchlist.push({
          symbol: item.symbol,
          sector: item.sector,
          score: item.score,
          currentPrice: item.result.currentPrice,
          divYieldPct: item.result.divYieldPct,
          trigger: `Score ${item.score}/100 · top ${TOP_RANKED_LIMIT} DSE-wide`,
          advanced: {
            grahamNumber: item.result.advanced.grahamNumber,
            marginOfSafety: item.result.advanced.marginOfSafety,
            earningsYield: item.result.advanced.earningsYield,
            roe: item.result.advanced.roe,
          },
        });
      }
    } else {
      // Not owned, not watched → Discovery card.
      discovery.push({ ...item.result, allocationPct: 0 });
    }
  }

  // ── 5. Holding analyses — ONLY for holdings that are inside the top-N.
  //       Holdings outside top-N are intentionally excluded so the view
  //       shows exactly the DSE top-N as cards (no surprise extras).
  const holdingAnalyses: OracleHoldingAnalysis[] = holdingsRes.holdings
    .filter((h) => h.shares > 0)
    .map((h) => ({ h, sym: h.symbol.trim().toUpperCase() }))
    .filter(({ sym }) => topRankedHoldingSymbols.has(sym))
    .map(({ h, sym }) => {
      const extras = curatedExtras.get(sym);
      const quote = lspRes.bySymbol.get(sym) ?? null;
      if (!extras) {
        return {
          symbol: sym, sector: null, score: 0, currentPrice: quote?.ltp ?? null,
          avgCost: h.avgPrice, breakEven: h.breakEvenPrice, shares: h.shares,
          currentValue: quote ? Math.round(quote.ltp * h.shares * 100) / 100 : null,
          unrealizedPL: null, unrealizedPLPct: null, distanceFromBreakEven: null,
          divYieldPct: null,
          signal: "Hold" as const, signalReason: "No fundamental data available",
          advanced: {},
        };
      }
      return computeHoldingAnalysis(
        { symbol: sym, shares: h.shares, avgPrice: h.avgPrice, breakEvenPrice: h.breakEvenPrice, totalCost: h.totalCost },
        extras,
        quote,
      );
    });

  // ── 6. Sentiment — derived from the top picks band (score ≥ threshold)
  //       inside top-N, which is a more honest "market mood" read than
  //       just the user's watchlist would give.
  const highConvictionInTop = topRanked.filter((s) => s.score >= ORACLE_THRESHOLD);
  const avgScore = highConvictionInTop.length > 0
    ? highConvictionInTop.reduce((s, p) => s + p.score, 0) / highConvictionInTop.length
    : 0;
  const { sentiment, reason: sentimentReason } = computeSentiment(
    highConvictionInTop.length,
    avgScore,
  );

  void topRankedSet; // exported logically; kept for clarity

  const payload: TradeDeskData = {
    generatedAt: new Date().toISOString(),
    sentiment,
    sentimentReason,
    picks,
    watchlist,
    avoided: gateRejects,
    holdings: holdingAnalyses,
    discovery,
    disclaimer: ORACLE_DISCLAIMER,
    totalSymbols: universeScored.length,
    gatedOut: gateRejects.length,
    topSectors,
  };

  return (
    <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto w-full min-w-0 max-w-7xl text-left">
      <TradeDeskView initialData={payload} />
    </AppPageStack>
  );
}
