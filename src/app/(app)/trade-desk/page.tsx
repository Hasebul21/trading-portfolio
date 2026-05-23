import { Suspense } from "react";
import { AppPageStack } from "@/components/app-page-stack";
import { TradeDeskView, type TradeDeskData } from "@/components/trade-desk/trade-desk-view";
import { DiscoveryAsync } from "@/components/trade-desk/discovery-async";
import { DiscoverySkeleton } from "@/components/trade-desk/discovery-section";
import { fetchDseLspQuoteMap } from "@/lib/market/dse-lsp-quotes";
import { fetchDseCompanyExtrasMap } from "@/lib/market/dse-company-52w";
import { createClient } from "@/lib/supabase/server";
import { fetchUserHoldings } from "@/lib/holdings";
import {
  computeOracleScore,
  computeHoldingAnalysis,
  rankAndSelect,
  computeSentiment,
  ORACLE_DISCLAIMER,
  ORACLE_THRESHOLD,
  type OracleGateReject,
  type OracleHoldingAnalysis,
} from "@/lib/market/oracle-scoring";

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

  const watchlistSymbols = [
    ...new Set((ltRes.data ?? []).map((r) => String(r.symbol).trim().toUpperCase())),
  ].filter(Boolean);

  const portfolioSymbols = holdingsRes.holdings.map((h) => h.symbol.trim().toUpperCase());
  const allSymbols = [...new Set([...watchlistSymbols, ...portfolioSymbols])].filter(Boolean);

  if (watchlistSymbols.length === 0) {
    return (
      <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto w-full min-w-0 max-w-7xl text-left">
        <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg-surface)] px-6 py-10 text-center text-[14px] text-[var(--ink-muted)]">
          No symbols in your Watchlist. Add stocks there first.
        </div>
      </AppPageStack>
    );
  }

  const extrasMap = await fetchDseCompanyExtrasMap(allSymbols);

  const scored: Parameters<typeof rankAndSelect>[0] = [];
  const gateRejects: OracleGateReject[] = [];

  for (const sym of watchlistSymbols) {
    const extras = extrasMap.get(sym);
    const quote = lspRes.bySymbol.get(sym) ?? null;
    if (!extras || !quote) continue;

    const result = computeOracleScore(sym, extras, quote);
    if (result.type === "gate") {
      gateRejects.push({ symbol: sym, reason: result.reason });
    } else if (result.type === "pick") {
      scored.push({ symbol: sym, score: result.result.score, sector: result.result.sector, result: result.result });
    }
  }

  const { picks, watchlist } = rankAndSelect(scored);
  const avgScore = picks.length > 0 ? picks.reduce((s, p) => s + p.score, 0) / picks.length : 0;
  const { sentiment, reason: sentimentReason } = computeSentiment(picks.length, avgScore);

  // Portfolio holdings analysis
  const holdingAnalyses: OracleHoldingAnalysis[] = holdingsRes.holdings
    .filter((h) => h.shares > 0)
    .map((h) => {
      const sym = h.symbol.trim().toUpperCase();
      const extras = extrasMap.get(sym);
      const quote = lspRes.bySymbol.get(sym) ?? null;
      if (!extras) {
        return {
          symbol: sym, sector: null, score: 0, currentPrice: quote?.ltp ?? null,
          avgCost: h.avgPrice, breakEven: h.breakEvenPrice, shares: h.shares,
          currentValue: quote ? Math.round(quote.ltp * h.shares * 100) / 100 : null,
          unrealizedPL: null, unrealizedPLPct: null, distanceFromBreakEven: null,
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

  const payload: TradeDeskData = {
    generatedAt: new Date().toISOString(),
    sentiment,
    sentimentReason,
    picks,
    watchlist,
    avoided: gateRejects,
    holdings: holdingAnalyses,
    disclaimer: ORACLE_DISCLAIMER,
    totalSymbols: watchlistSymbols.length,
    gatedOut: gateRejects.length,
    topSectors,
  };

  void ORACLE_THRESHOLD; // imported for threshold display in view

  return (
    <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto w-full min-w-0 max-w-7xl text-left">
      <TradeDeskView initialData={payload} />
      {/* Wider DSE scan streams in independently so it never blocks the main
          view. Per-symbol fundamentals are cached 24h via "use cache". */}
      <Suspense fallback={<DiscoverySkeleton />}>
        <DiscoveryAsync
          bySymbol={lspRes.bySymbol}
          excludeSymbols={allSymbols}
          topSectors={topSectors}
        />
      </Suspense>
    </AppPageStack>
  );
}
