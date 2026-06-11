import { computeFloorPivot, type FloorPivot } from "@/lib/pivot-floor";
import { fetchUserHoldings } from "@/lib/holdings";
import type { HoldingRow } from "@/lib/portfolio";
import { fetchDseCompanyExtrasMap, type DseCompanyExtras } from "./dse-company-52w";
import type { DseLspQuote } from "./dse-lsp-quotes";
import { fetchDseLspQuoteMap } from "./dse-lsp-quotes";
import { computeHoldingAnalysis, type HoldingSignal } from "./oracle-scoring";

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
  /** Oracle holding-analysis signal (Strong Add / Add / Hold / Trim / Exit). */
  signal: HoldingSignal;
  /** One-line rationale for the signal; empty string when no signal context. */
  signalReason: string;
  /** Latest declared dividend yield % from DSE; null when not available. */
  divYieldPct: number | null;
  /** Most recent declared annual cash dividend % of face value; null if none. */
  cashDividendPct: number | null;
  /**
   * Expected annual cash dividend in BDT. Prefers the declared cash dividend:
   * shares × (faceValue × cashDividendPct/100) — price-independent. Falls back
   * to shares × (divYieldPct/100) × LTP when no cash dividend is published.
   */
  expectedAnnualDividendBdt: number | null;
};

/** DSE-listed equities trade at a ৳10 face (par) value; DSE doesn't publish it. */
const FACE_VALUE_BDT = 10;

/** Merge ledger/override holdings with DSE market and company metadata. */
export function holdingsToMarketRows(
  holdings: HoldingRow[],
  bySymbol: Map<string, DseLspQuote>,
  companyExtrasBySymbol: Map<string, DseCompanyExtras>,
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

    // Oracle signal — only meaningful when we have BOTH a live quote and
    // fundamental extras. Otherwise default to a neutral "Hold" with a
    // contextual reason so the UI never lights up a misleading action.
    let signal: HoldingSignal = "Hold";
    let signalReason = "";
    if (q && extras) {
      const analysis = computeHoldingAnalysis(
        {
          symbol: h.symbol,
          shares: h.shares,
          avgPrice: h.avgPrice,
          breakEvenPrice: h.breakEvenPrice,
          totalCost: h.totalCost,
        },
        extras,
        q,
      );
      signal = analysis.signal;
      signalReason = analysis.signalReason;
    } else if (!q) {
      signalReason = "Awaiting live quote";
    } else {
      signalReason = "Missing fundamentals";
    }

    // Expected annual dividend. Most accurate: the actual declared cash dividend
    // per share (face value × cash %), which is what you'll receive regardless
    // of today's price. When a company hasn't published a cash dividend, fall
    // back to the 5y-average yield × LTP estimate (newly listed shares, etc.).
    const cashDividendPct = extras?.cashDividendPct ?? null;
    const divYieldPct =
      extras?.dividendYieldAvg5YPct ?? extras?.dividendYieldPct ?? null;

    let expectedAnnualDividendBdt: number | null = null;
    if (cashDividendPct !== null && cashDividendPct > 0) {
      const dps = (FACE_VALUE_BDT * cashDividendPct) / 100;
      expectedAnnualDividendBdt = Math.round(dps * h.shares * 100) / 100;
    } else if (
      divYieldPct !== null &&
      divYieldPct > 0 &&
      marketLtp !== null &&
      Number.isFinite(marketLtp)
    ) {
      expectedAnnualDividendBdt =
        Math.round((divYieldPct / 100) * marketLtp * h.shares * 100) / 100;
    }

    return {
      ...h,
      sector,
      marketLtp,
      pivot,
      unrealizedPl,
      week52Low: extras?.week52Low ?? null,
      week52High: extras?.week52High ?? null,
      signal,
      signalReason,
      divYieldPct,
      cashDividendPct,
      expectedAnnualDividendBdt,
    };
  });
}

/** Portfolio rows: DSE LSP (LTP + pivot inputs) plus sector metadata. */
export async function fetchPortfolioWithDseMarket(): Promise<{
  error: string | null;
  holdings: PortfolioMarketRow[];
  hiddenSymbols: string[];
  marketError: string | null;
  quotedSymbolCount: number;
  totalRealizedBdt: number;
  totalInvestedBdt: number;
  totalCashAdjustmentsBdt: number;
  totalCashDividendsBdt: number;
}> {
  const [holdingsRes, lspRes] = await Promise.all([
    fetchUserHoldings(),
    fetchDseLspQuoteMap(),
  ]);

  if (holdingsRes.error) {
    return {
      error: holdingsRes.error,
      holdings: [],
      hiddenSymbols: [],
      marketError: lspRes.error,
      quotedSymbolCount: 0,
      totalRealizedBdt: 0,
      totalInvestedBdt: 0,
      totalCashAdjustmentsBdt: 0,
      totalCashDividendsBdt: 0,
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
    hiddenSymbols: holdingsRes.hiddenSymbols,
    marketError: lspError,
    quotedSymbolCount: quoted,
    totalRealizedBdt: holdingsRes.totalRealizedBdt,
    totalInvestedBdt: holdingsRes.totalInvestedBdt,
    totalCashAdjustmentsBdt: holdingsRes.totalCashAdjustmentsBdt,
    totalCashDividendsBdt: holdingsRes.totalCashDividendsBdt,
  };
}
