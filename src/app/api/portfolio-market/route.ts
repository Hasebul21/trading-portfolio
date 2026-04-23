import { fetchUserHoldings } from "@/lib/holdings";
import { fetchDseCompanyExtrasMap } from "@/lib/market/dse-company-52w";
import { fetchDseLspQuoteMapFresh } from "@/lib/market/dse-lsp-quotes";
import { holdingsToMarketRows } from "@/lib/market/portfolio-with-quotes";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

  const [lspRes, companyExtrasBySymbol] = await Promise.all([
    fetchDseLspQuoteMapFresh(),
    fetchDseCompanyExtrasMap(holdingsRes.holdings.map((holding) => holding.symbol)),
  ]);
  const holdings = holdingsToMarketRows(
    holdingsRes.holdings,
    lspRes.bySymbol,
    companyExtrasBySymbol,
  );

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    lspError: lspRes.error,
    holdings,
    totalRealizedBdt: holdingsRes.totalRealizedBdt,
    totalInvestedBdt: holdingsRes.totalInvestedBdt,
  });
}
