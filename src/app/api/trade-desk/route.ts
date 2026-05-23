import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchDseLspQuoteMapFresh } from "@/lib/market/dse-lsp-quotes";
import { fetchDseCompanyExtrasMap } from "@/lib/market/dse-company-52w";
import { scoreDseUniverse } from "@/lib/market/discovery";
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

const TOP_RANKED_LIMIT = 40;

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

  // Score full DSE universe and take the true top-N.
  const { scored: universeScored } = await scoreDseUniverse({
    bySymbol: lspRes.bySymbol,
  });

  // Gate rejects across the user's own lists only — keeps the "Filtered
  // Out" strip readable instead of dumping every gated DSE name.
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

  const topRanked = universeScored.slice(0, TOP_RANKED_LIMIT);

  // Partition top-N → picks / watchlist / discovery; track which holdings
  // fell in top-N for the holding-analysis pass below.
  const picks: OraclePickResult[] = [];
  const watchlist: OracleWatchlistItem[] = [];
  const discovery: OraclePickResult[] = [];
  const topRankedHoldingSymbols = new Set<string>();

  for (const item of topRanked) {
    if (portfolioSet.has(item.symbol)) {
      topRankedHoldingSymbols.add(item.symbol);
    } else if (watchlistSet.has(item.symbol)) {
      if (item.score >= ORACLE_THRESHOLD) {
        picks.push({ ...item.result, allocationPct: 0 });
      } else {
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
      discovery.push({ ...item.result, allocationPct: 0 });
    }
  }

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

  const highConvictionInTop = topRanked.filter((s) => s.score >= ORACLE_THRESHOLD);
  const avgScore = highConvictionInTop.length > 0
    ? highConvictionInTop.reduce((s, p) => s + p.score, 0) / highConvictionInTop.length
    : 0;
  const { sentiment, reason: sentimentReason } = computeSentiment(
    highConvictionInTop.length,
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
    discovery,
    disclaimer: ORACLE_DISCLAIMER,
    totalSymbols: universeScored.length,
    gatedOut: gateRejects.length,
    topSectors,
  } satisfies TradeDeskData);
}
