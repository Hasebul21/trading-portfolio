"use server";

import { fetchDseCompanyExtras } from "@/lib/market/dse-company-52w";
import { fetchDseLspQuoteMapFresh } from "@/lib/market/dse-lsp-quotes";
import {
  computeAdvancedMetrics,
  type AdvancedMetrics,
} from "@/lib/market/oracle-scoring";

export type ShareAnalytics = {
  symbol: string;
  sector: string | null;
  category: string | null;
  currentPrice: number | null;
  divYieldPct: number | null;
  annualDividendPerShare: number | null;
  advanced: AdvancedMetrics | null;
  error: string | null;
};

export async function fetchShareAnalytics(rawSymbol: string): Promise<ShareAnalytics> {
  const symbol = rawSymbol.trim().toUpperCase();
  const empty: ShareAnalytics = {
    symbol,
    sector: null,
    category: null,
    currentPrice: null,
    divYieldPct: null,
    annualDividendPerShare: null,
    advanced: null,
    error: null,
  };
  if (!symbol) return { ...empty, error: "Choose a trading code" };

  const [extras, lspRes] = await Promise.all([
    fetchDseCompanyExtras(symbol),
    fetchDseLspQuoteMapFresh(),
  ]);
  const quote = lspRes.bySymbol.get(symbol) ?? null;

  if (!quote) {
    return {
      ...empty,
      sector: extras.sector,
      category: extras.category,
      error: lspRes.error ?? `No live price published for ${symbol}`,
    };
  }

  const ltp = quote.ltp;
  const advanced = computeAdvancedMetrics(extras, ltp);
  const annualDps =
    extras.dividendYieldPct !== null && extras.dividendYieldPct > 0
      ? Math.round((extras.dividendYieldPct / 100) * ltp * 100) / 100
      : null;

  return {
    symbol,
    sector: extras.sector,
    category: extras.category,
    currentPrice: ltp,
    divYieldPct: extras.dividendYieldPct,
    annualDividendPerShare: annualDps,
    advanced,
    error: null,
  };
}
