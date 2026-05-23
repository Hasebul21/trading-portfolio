import { AppPageStack } from "@/components/app-page-stack";
import { TradeDeskView, type TradeDeskData } from "@/components/trade-desk/trade-desk-view";
import { fetchDseLspQuoteMap } from "@/lib/market/dse-lsp-quotes";
import { fetchDseCompanyExtrasMap } from "@/lib/market/dse-company-52w";
import { fetchUserHoldings } from "@/lib/holdings";
import { createClient } from "@/lib/supabase/server";
import {
  computeOracleScore,
  rankAndSelect,
  computeSentiment,
  ORACLE_DISCLAIMER,
  type OracleGateReject,
} from "@/lib/market/oracle-scoring";

export const revalidate = 0;

export default async function TradeDeskPage() {
  const supabase = await createClient();

  const [holdingsRes, lspRes, ltRes] = await Promise.all([
    fetchUserHoldings(),
    fetchDseLspQuoteMap(),
    supabase
      .from("long_term_holdings")
      .select("symbol")
      .order("symbol", { ascending: true }),
  ]);

  // Union of watchlist + portfolio symbols
  const symbolSet = new Set<string>();
  for (const h of holdingsRes.holdings) {
    symbolSet.add(h.symbol.trim().toUpperCase());
  }
  for (const row of ltRes.data ?? []) {
    symbolSet.add(String(row.symbol).trim().toUpperCase());
  }

  const symbols = [...symbolSet];

  if (symbols.length === 0) {
    return (
      <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto w-full min-w-0 max-w-7xl text-left">
        <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg-surface)] px-6 py-10 text-center text-[14px] text-[var(--ink-muted)]">
          No symbols found. Add stocks to your Portfolio or Watchlist first.
        </div>
      </AppPageStack>
    );
  }

  const extrasMap = await fetchDseCompanyExtrasMap(symbols);

  // Score each symbol
  const scored: Parameters<typeof rankAndSelect>[0] = [];
  const gateRejects: OracleGateReject[] = [];

  for (const sym of symbols) {
    const extras = extrasMap.get(sym);
    const quote = lspRes.bySymbol.get(sym) ?? null;
    if (!extras) continue;

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
    // noPrice → silently skip
  }

  const { picks, watchlist } = rankAndSelect(scored);

  const avgScore = picks.length > 0
    ? picks.reduce((s, p) => s + p.score, 0) / picks.length
    : 0;
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

  return (
    <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto w-full min-w-0 max-w-7xl text-left">
      <TradeDeskView initialData={payload} />
    </AppPageStack>
  );
}
