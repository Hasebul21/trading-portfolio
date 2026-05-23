import { AppPageStack } from "@/components/app-page-stack";
import { TradeDeskView, type TradeDeskData } from "@/components/trade-desk/trade-desk-view";
import { fetchDseLspQuoteMap } from "@/lib/market/dse-lsp-quotes";
import { fetchDseCompanyExtrasMap } from "@/lib/market/dse-company-52w";
import {
  computeOracleScore,
  rankAndSelect,
  computeSentiment,
  ORACLE_DISCLAIMER,
  type OracleGateReject,
} from "@/lib/market/oracle-scoring";

export const revalidate = 0;

/** Cap universe to avoid overwhelming DSE on first load (24h cache means repeat loads are instant). */
const MAX_UNIVERSE = 250;

export default async function TradeDeskPage() {
  const lspRes = await fetchDseLspQuoteMap();

  if (lspRes.error && lspRes.bySymbol.size === 0) {
    return (
      <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto w-full min-w-0 max-w-7xl text-left">
        <div className="rounded-lg bg-[var(--warn-50)] border border-[var(--warn-200)] px-4 py-3 text-[14px] text-amber-900">
          Could not load DSE price data — {lspRes.error}. Try refreshing in a moment.
        </div>
      </AppPageStack>
    );
  }

  // Universe: all symbols that have live prices from DSE, capped to avoid first-load slowness.
  // Alphabetical order so the cap is deterministic. 24h Next.js cache means subsequent loads are instant.
  const allLspSymbols = [...lspRes.bySymbol.keys()].sort();
  const symbols = allLspSymbols.slice(0, MAX_UNIVERSE);

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
    picks.length > 0
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
