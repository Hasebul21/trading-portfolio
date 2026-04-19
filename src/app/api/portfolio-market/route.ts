import { fetchUserHoldings } from "@/lib/holdings";
import { fetchDseLspQuoteMapFresh } from "@/lib/market/dse-lsp-quotes";
import { computeFloorPivot, type FloorPivot } from "@/lib/pivot-floor";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type PortfolioMarketQuote = {
  marketLtp: number | null;
  pivot: FloorPivot | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const holdingsRes = await fetchUserHoldings();
  if (holdingsRes.error) {
    return NextResponse.json({ error: holdingsRes.error }, { status: 500 });
  }

  const symbols = [...new Set(holdingsRes.holdings.map((h) => h.symbol))];
  const lspRes = await fetchDseLspQuoteMapFresh();

  const quotes: Record<string, PortfolioMarketQuote> = {};
  for (const sym of symbols) {
    const q = lspRes.bySymbol.get(sym);
    if (!q) {
      quotes[sym] = { marketLtp: null, pivot: null };
      continue;
    }
    quotes[sym] = {
      marketLtp: q.ltp,
      pivot: computeFloorPivot(q.dayHigh, q.dayLow, q.closep),
    };
  }

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    lspError: lspRes.error,
    quotes,
  });
}
