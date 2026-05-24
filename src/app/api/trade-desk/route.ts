import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchDseLspQuoteMapFresh } from "@/lib/market/dse-lsp-quotes";
import { fetchDseCompanyExtrasMap } from "@/lib/market/dse-company-52w";
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

  const watchlistSet = new Set(
    (ltRes.data ?? []).map((r) => String(r.symbol).trim().toUpperCase()).filter(Boolean),
  );
  const portfolioSet = new Set(
    holdingsRes.holdings.map((h) => h.symbol.trim().toUpperCase()).filter(Boolean),
  );

  if (lspRes.bySymbol.size === 0) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      sentiment: "Neutral",
      sentimentReason: lspRes.error ?? "No DSE price data",
      picks: [],
      watchlist: [],
      avoided: [],
      holdings: [],
      discovery: [],
      disclaimer: ORACLE_DISCLAIMER,
      totalSymbols: 0,
      gatedOut: 0,
      topSectors,
    } satisfies TradeDeskData);
  }

  // Trade Desk is scoped to the user's curated set: watchlist ∪ portfolio.
  const curatedSymbols = [...new Set([...watchlistSet, ...portfolioSet])];
  const curatedExtras = await fetchDseCompanyExtrasMap(curatedSymbols);

  const picks: OraclePickResult[] = [];
  const watchlist: OracleWatchlistItem[] = [];
  const gateRejects: OracleGateReject[] = [];
  const scoredHoldingSymbols = new Set<string>();
  const highConvictionScores: number[] = [];

  for (const sym of curatedSymbols) {
    const extras = curatedExtras.get(sym);
    const quote = lspRes.bySymbol.get(sym) ?? null;
    if (!extras || !quote) continue;

    const r = computeOracleScore(sym, extras, quote);
    if (r.type === "gate") {
      gateRejects.push({ symbol: sym, reason: r.reason });
      continue;
    }
    if (r.type !== "pick") continue;

    const score = r.result.score;
    if (score >= ORACLE_THRESHOLD) highConvictionScores.push(score);

    if (portfolioSet.has(sym)) {
      scoredHoldingSymbols.add(sym);
      continue;
    }
    if (watchlistSet.has(sym)) {
      if (score >= ORACLE_THRESHOLD) {
        picks.push({ ...r.result, allocationPct: 0 });
      } else {
        watchlist.push({
          symbol: sym,
          sector: r.result.sector,
          score,
          currentPrice: r.result.currentPrice,
          divYieldPct: r.result.divYieldPct,
          trigger: `Score ${score}/100 · below ${ORACLE_THRESHOLD} threshold`,
          advanced: {
            grahamNumber: r.result.advanced.grahamNumber,
            marginOfSafety: r.result.advanced.marginOfSafety,
            earningsYield: r.result.advanced.earningsYield,
            roe: r.result.advanced.roe,
          },
        });
      }
    }
  }

  picks.sort((a, b) => b.score - a.score);
  watchlist.sort((a, b) => b.score - a.score);

  const holdingAnalyses: OracleHoldingAnalysis[] = holdingsRes.holdings
    .filter((h) => h.shares > 0)
    .map((h) => ({ h, sym: h.symbol.trim().toUpperCase() }))
    .filter(({ sym }) => scoredHoldingSymbols.has(sym))
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

  const avgScore = highConvictionScores.length > 0
    ? highConvictionScores.reduce((s, n) => s + n, 0) / highConvictionScores.length
    : 0;
  const { sentiment, reason: sentimentReason } = computeSentiment(
    highConvictionScores.length,
    avgScore,
  );

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    sentiment,
    sentimentReason,
    picks,
    watchlist,
    avoided: gateRejects,
    holdings: holdingAnalyses,
    discovery: [],
    disclaimer: ORACLE_DISCLAIMER,
    totalSymbols: curatedSymbols.length,
    gatedOut: gateRejects.length,
    topSectors,
  } satisfies TradeDeskData);
}
