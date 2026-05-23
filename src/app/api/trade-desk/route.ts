import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchDseLspQuoteMapFresh } from "@/lib/market/dse-lsp-quotes";
import { fetchDseCompanyExtrasMap } from "@/lib/market/dse-company-52w";
import { computeDiscoveryPicks } from "@/lib/market/discovery";
import { fetchUserHoldings } from "@/lib/holdings";
import {
  computeOracleScore,
  computeHoldingAnalysis,
  rankAndSelect,
  computeSentiment,
  ORACLE_DISCLAIMER,
  type OracleGateReject,
  type OracleHoldingAnalysis,
} from "@/lib/market/oracle-scoring";
import type { TradeDeskData } from "@/components/trade-desk/trade-desk-view";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [lspRes, ltRes, settingsRes, holdingsRes] = await Promise.all([
    fetchDseLspQuoteMapFresh(),
    supabase.from("long_term_holdings").select("symbol").order("symbol", { ascending: true }),
    supabase.from("user_settings").select("top_sectors").maybeSingle(),
    fetchUserHoldings(),
  ]);

  const rawTopSectors = (settingsRes.data as { top_sectors?: unknown } | null)?.top_sectors;
  const topSectors: string[] = Array.isArray(rawTopSectors)
    ? rawTopSectors.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];

  const watchlistSymbols = [
    ...new Set((ltRes.data ?? []).map((r) => String(r.symbol).trim().toUpperCase())),
  ].filter(Boolean);

  const portfolioSymbols = holdingsRes.holdings.map((h) => h.symbol.trim().toUpperCase());
  const allSymbols = [...new Set([...watchlistSymbols, ...portfolioSymbols])].filter(Boolean);

  if (watchlistSymbols.length === 0 || lspRes.bySymbol.size === 0) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      sentiment: "Neutral",
      sentimentReason: watchlistSymbols.length === 0 ? "No symbols in Watchlist" : (lspRes.error ?? "No DSE price data"),
      picks: [],
      watchlist: [],
      avoided: [],
      holdings: [],
      discovery: [],
      disclaimer: ORACLE_DISCLAIMER,
      totalSymbols: watchlistSymbols.length,
      gatedOut: 0,
      topSectors,
    } satisfies TradeDeskData);
  }

  const extrasMap = await fetchDseCompanyExtrasMap(allSymbols);

  const scored: Parameters<typeof rankAndSelect>[0] = [];
  const gateRejects: OracleGateReject[] = [];

  for (const sym of watchlistSymbols) {
    const extras = extrasMap.get(sym);
    const quote  = lspRes.bySymbol.get(sym) ?? null;
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

  const holdingAnalyses: OracleHoldingAnalysis[] = holdingsRes.holdings
    .filter((h) => h.shares > 0)
    .map((h) => {
      const sym    = h.symbol.trim().toUpperCase();
      const extras = extrasMap.get(sym);
      const quote  = lspRes.bySymbol.get(sym) ?? null;
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

  const { picks: discovery } = await computeDiscoveryPicks({
    bySymbol: lspRes.bySymbol,
    excludeSymbols: allSymbols,
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    sentiment,
    sentimentReason,
    picks,
    watchlist,
    avoided: gateRejects,
    holdings: holdingAnalyses,
    discovery,
    disclaimer: ORACLE_DISCLAIMER,
    totalSymbols: watchlistSymbols.length,
    gatedOut: gateRejects.length,
    topSectors,
  } satisfies TradeDeskData);
}
