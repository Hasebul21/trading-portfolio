import { fetchUserHoldings } from "@/lib/holdings";
import type { HoldingRow } from "@/lib/portfolio";
import { fetchAmarstockMoversLtpMap } from "./amarstock-move";

export type PortfolioMarketRow = HoldingRow & {
  marketLtp: number | null;
  dayChange: number | null;
  dayChangePct: number | null;
  /** (LTP − avg) × shares when LTP known */
  unrealizedPl: number | null;
};

export async function fetchPortfolioWithAmarQuotes(): Promise<{
  error: string | null;
  holdings: PortfolioMarketRow[];
  marketError: string | null;
  quotedSymbolCount: number;
}> {
  const [holdingsRes, marketRes] = await Promise.all([
    fetchUserHoldings(),
    fetchAmarstockMoversLtpMap(),
  ]);

  if (holdingsRes.error) {
    return {
      error: holdingsRes.error,
      holdings: [],
      marketError: marketRes.error,
      quotedSymbolCount: 0,
    };
  }

  const { bySymbol, error: marketError } = marketRes;
  let quoted = 0;

  const holdings: PortfolioMarketRow[] = holdingsRes.holdings.map((h) => {
    const q = bySymbol.get(h.symbol);
    if (q) quoted += 1;

    const marketLtp = q?.ltp ?? null;
    const unrealizedPl =
      marketLtp !== null && Number.isFinite(marketLtp)
        ? (marketLtp - h.avgPrice) * h.shares
        : null;

    return {
      ...h,
      marketLtp,
      dayChange: q?.change ?? null,
      dayChangePct: q?.changePer ?? null,
      unrealizedPl,
    };
  });

  return {
    error: null,
    holdings,
    marketError,
    quotedSymbolCount: quoted,
  };
}
