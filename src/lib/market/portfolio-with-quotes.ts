import { computeFloorPivot, type FloorPivot } from "@/lib/pivot-floor";
import { fetchUserHoldings } from "@/lib/holdings";
import type { HoldingRow } from "@/lib/portfolio";
import { fetchDseLspQuoteMap } from "./dse-lsp-quotes";

export type PortfolioMarketRow = HoldingRow & {
  marketLtp: number | null;
  pivot: FloorPivot | null;
  /** (LTP − avg) × shares when LTP known */
  unrealizedPl: number | null;
};

/** Portfolio rows: DSE LSP (LTP + pivot inputs). */
export async function fetchPortfolioWithDseMarket(): Promise<{
  error: string | null;
  holdings: PortfolioMarketRow[];
  marketError: string | null;
  quotedSymbolCount: number;
}> {
  const [holdingsRes, lspRes] = await Promise.all([
    fetchUserHoldings(),
    fetchDseLspQuoteMap(),
  ]);

  if (holdingsRes.error) {
    return {
      error: holdingsRes.error,
      holdings: [],
      marketError: lspRes.error,
      quotedSymbolCount: 0,
    };
  }

  const { bySymbol, error: lspError } = lspRes;

  let quoted = 0;

  const holdings: PortfolioMarketRow[] = holdingsRes.holdings.map((h) => {
    const q = bySymbol.get(h.symbol);
    if (q) quoted += 1;

    const marketLtp = q?.ltp ?? null;
    const unrealizedPl =
      marketLtp !== null && Number.isFinite(marketLtp)
        ? (marketLtp - h.avgPrice) * h.shares
        : null;

    const pivot = q
      ? computeFloorPivot(q.dayHigh, q.dayLow, q.closep)
      : null;

    return {
      ...h,
      marketLtp,
      pivot,
      unrealizedPl,
    };
  });

  return {
    error: null,
    holdings,
    marketError: lspError,
    quotedSymbolCount: quoted,
  };
}
