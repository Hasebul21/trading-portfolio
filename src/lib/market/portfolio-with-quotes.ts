import { computeFloorPivot, type FloorPivot } from "@/lib/pivot-floor";
import { fetchUserHoldings } from "@/lib/holdings";
import type { HoldingRow } from "@/lib/portfolio";
import { fetchDseCompanyExtras } from "./dse-company-52w";
import { fetchDseLspQuoteMap } from "./dse-lsp-quotes";

export type PortfolioMarketRow = HoldingRow & {
  marketLtp: number | null;
  week52High: number | null;
  week52Low: number | null;
  pivot: FloorPivot | null;
  /** (LTP − avg) × shares when LTP known */
  unrealizedPl: number | null;
};

async function mapInBatches<T, R>(
  items: readonly T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    out.push(...(await Promise.all(chunk.map(fn))));
  }
  return out;
}

/** Portfolio rows: DSE LSP (LTP + pivot inputs), company page (52w range). */
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
  const symbols = [...new Set(holdingsRes.holdings.map((h) => h.symbol))];

  const extrasEntries = await mapInBatches(symbols, 5, async (sym) => {
    const ex = await fetchDseCompanyExtras(sym);
    return [sym, ex] as const;
  });
  const extrasBySymbol = new Map(extrasEntries);

  let quoted = 0;

  const holdings: PortfolioMarketRow[] = holdingsRes.holdings.map((h) => {
    const q = bySymbol.get(h.symbol);
    if (q) quoted += 1;

    const marketLtp = q?.ltp ?? null;
    const unrealizedPl =
      marketLtp !== null && Number.isFinite(marketLtp)
        ? (marketLtp - h.avgPrice) * h.shares
        : null;

    const extras = extrasBySymbol.get(h.symbol);
    const pivot = q
      ? computeFloorPivot(q.dayHigh, q.dayLow, q.closep)
      : null;

    return {
      ...h,
      marketLtp,
      week52High: extras?.week52High ?? null,
      week52Low: extras?.week52Low ?? null,
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
