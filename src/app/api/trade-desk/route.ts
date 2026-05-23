import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchDseLspQuoteMapFresh } from "@/lib/market/dse-lsp-quotes";
import { fetchDseCompanyExtrasMap } from "@/lib/market/dse-company-52w";
import {
  computeOracleScore,
  rankAndSelect,
  computeSentiment,
  ORACLE_DISCLAIMER,
  type OracleGateReject,
} from "@/lib/market/oracle-scoring";
import type { TradeDeskData } from "@/components/trade-desk/trade-desk-view";

export const dynamic = "force-dynamic";

const MAX_UNIVERSE = 250;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lspRes = await fetchDseLspQuoteMapFresh();

  if (lspRes.bySymbol.size === 0) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      sentiment: "Neutral",
      sentimentReason: lspRes.error ?? "No DSE price data available",
      picks: [],
      watchlist: [],
      avoided: [],
      disclaimer: ORACLE_DISCLAIMER,
      totalSymbols: 0,
      gatedOut: 0,
    } satisfies TradeDeskData);
  }

  const symbols = [...lspRes.bySymbol.keys()].sort().slice(0, MAX_UNIVERSE);
  const extrasMap = await fetchDseCompanyExtrasMap(symbols);

  const scored: Parameters<typeof rankAndSelect>[0] = [];
  const gateRejects: OracleGateReject[] = [];

  for (const sym of symbols) {
    const extras = extrasMap.get(sym);
    const quote = lspRes.bySymbol.get(sym) ?? null;
    if (!extras || !quote) continue;

    const result = computeOracleScore(sym, extras, quote);
    if (result.type === "gate") {
      gateRejects.push({ symbol: sym, reason: result.reason });
    } else if (result.type === "pick") {
      scored.push({
        symbol: sym,
        score: result.result.score,
        sector: result.result.sector,
        result: result.result,
      });
    }
  }

  const { picks, watchlist } = rankAndSelect(scored);
  const avgScore =
    picks.length > 0 ? picks.reduce((s, p) => s + p.score, 0) / picks.length : 0;
  const { sentiment, reason: sentimentReason } = computeSentiment(picks.length, avgScore);

  const payload: TradeDeskData = {
    generatedAt: new Date().toISOString(),
    sentiment,
    sentimentReason,
    picks,
    watchlist,
    avoided: gateRejects,
    disclaimer: ORACLE_DISCLAIMER,
    totalSymbols: symbols.length,
    gatedOut: gateRejects.length,
  };

  return NextResponse.json(payload);
}
