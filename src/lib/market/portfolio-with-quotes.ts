import { computeFloorPivot, type FloorPivot } from "@/lib/pivot-floor";
import { fetchUserHoldings } from "@/lib/holdings";
import type { HoldingRow } from "@/lib/portfolio";
import type { DseLspQuote } from "./dse-lsp-quotes";
import { fetchDseLspQuoteMap } from "./dse-lsp-quotes";

export type PortfolioMarketRow = HoldingRow & {
  marketLtp: number | null;
  pivot: FloorPivot | null;
  /** (LTP − avg) × shares when LTP known */
  unrealizedPl: number | null;
};

/** Merge ledger/override holdings with a DSE LSP map (same shape as the portfolio page). */
export function holdingsToMarketRows(
  holdings: HoldingRow[],
  bySymbol: Map<string, DseLspQuote>,
): PortfolioMarketRow[] {
  return holdings.map((h) => {
    const q = bySymbol.get(h.symbol);
    const marketLtp = q?.ltp ?? null;
    const unrealizedPl =
      marketLtp !== null && Number.isFinite(marketLtp)
        ? (marketLtp - h.avgPrice) * h.shares
        : null;
    const pivot = q ? computeFloorPivot(q.dayHigh, q.dayLow, q.closep) : null;
    return {
      ...h,
      marketLtp,
      pivot,
      unrealizedPl,
    };
  });
}

/** Portfolio rows: DSE LSP (LTP + pivot inputs). */
export async function fetchPortfolioWithDseMarket(): Promise<{
  error: string | null;
  holdings: PortfolioMarketRow[];
  marketError: string | null;
  quotedSymbolCount: number;
  totalRealizedBdt: number;
  totalInvestedBdt: number;
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
      totalRealizedBdt: 0,
      totalInvestedBdt: 0,
    };
  }

  const { bySymbol, error: lspError } = lspRes;

  let quoted = 0;
  for (const h of holdingsRes.holdings) {
    if (bySymbol.get(h.symbol)) quoted += 1;
  }

  const holdings = holdingsToMarketRows(holdingsRes.holdings, bySymbol);

  return {
    error: null,
    holdings,
    marketError: lspError,
    quotedSymbolCount: quoted,
    totalRealizedBdt: holdingsRes.totalRealizedBdt,
    totalInvestedBdt: holdingsRes.totalInvestedBdt,
  };
}
