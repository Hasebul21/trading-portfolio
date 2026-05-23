import { computeFloorPivot, type FloorPivot } from "@/lib/pivot-floor";
import { fetchUserHoldings } from "@/lib/holdings";
import type { HoldingRow } from "@/lib/portfolio";
import { fetchDseCompanyExtrasMap } from "./dse-company-52w";
import type { DseLspQuote } from "./dse-lsp-quotes";
import { fetchDseLspQuoteMap } from "./dse-lsp-quotes";

export type PortfolioMarketRow = HoldingRow & {
  sector: string | null;
  marketLtp: number | null;
  pivot: FloorPivot | null;
  /** (LTP − breakEvenPrice) × shares when LTP known. Includes round-trip fees. */
  unrealizedPl: number | null;
  /** 52-week low from the DSE company page; null when not available. */
  week52Low: number | null;
  /** 52-week high from the DSE company page; null when not available. */
  week52High: number | null;
};

/** Merge ledger/override holdings with DSE market and company metadata. */
export function holdingsToMarketRows(
  holdings: HoldingRow[],
  bySymbol: Map<string, DseLspQuote>,
  companyExtrasBySymbol: Map<
    string,
    { sector: string | null; week52Low?: number | null; week52High?: number | null }
  >,
): PortfolioMarketRow[] {
  return holdings.map((h) => {
    const q = bySymbol.get(h.symbol);
    const marketLtp = q?.ltp ?? null;
    // Use breakEvenPrice to calculate unrealized P/L (includes buy+sell fees)
    const unrealizedPl =
      marketLtp !== null && Number.isFinite(marketLtp)
        ? (marketLtp - h.breakEvenPrice) * h.shares
        : null;
    const pivot = q ? computeFloorPivot(q.dayHigh, q.dayLow, q.closep) : null;
    const extras = companyExtrasBySymbol.get(h.symbol);
    const sector = extras?.sector ?? h.category ?? null;
    return {
      ...h,
      sector,
      marketLtp,
      pivot,
      unrealizedPl,
      week52Low: extras?.week52Low ?? null,
      week52High: extras?.week52High ?? null,
    };
  });
}

/** Portfolio rows: DSE LSP (LTP + pivot inputs) plus sector metadata. */
export async function fetchPortfolioWithDseMarket(): Promise<{
  error: string | null;
  holdings: PortfolioMarketRow[];
  marketError: string | null;
  quotedSymbolCount: number;
  totalRealizedBdt: number;
  totalInvestedBdt: number;
  totalCashAdjustmentsBdt: number;
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
      totalCashAdjustmentsBdt: 0,
    };
  }

  const companyExtrasBySymbol = await fetchDseCompanyExtrasMap(
    holdingsRes.holdings.map((holding) => holding.symbol),
  );
  const { bySymbol, error: lspError } = lspRes;

  let quoted = 0;
  for (const h of holdingsRes.holdings) {
    if (bySymbol.get(h.symbol)) quoted += 1;
  }

  const holdings = holdingsToMarketRows(holdingsRes.holdings, bySymbol, companyExtrasBySymbol);

  return {
    error: null,
    holdings,
    marketError: lspError,
    quotedSymbolCount: quoted,
    totalRealizedBdt: holdingsRes.totalRealizedBdt,
    totalInvestedBdt: holdingsRes.totalInvestedBdt,
    totalCashAdjustmentsBdt: holdingsRes.totalCashAdjustmentsBdt,
  };
}
