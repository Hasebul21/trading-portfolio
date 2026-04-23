import { AppPageStack } from "@/components/app-page-stack";
import { AddLongTermForm } from "@/components/planning/add-long-term-form";
import {
  LongTermHoldingsTable,
  type LongTermHoldingRow,
} from "@/components/planning/long-term-holdings-table";
import { WatchlistSectorChart, type PortfolioHoldingForChart } from "@/components/planning/watchlist-sector-chart";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { fetchDseLspQuoteMap } from "@/lib/market/dse-lsp-quotes";
import { fetchDseCompanyExtrasMap } from "@/lib/market/dse-company-52w";
import { zoneLevelsFromLspQuote } from "@/lib/market/dse-zone-levels";
import { fetchUserHoldings } from "@/lib/holdings";
import { normalizeWatchlistClassification } from "@/lib/watchlist-classification";
import { createClient } from "@/lib/supabase/server";

const toolbarShell =
  "rounded-md border border-teal-200/60 bg-white/92 px-2 py-1 shadow-sm ring-1 ring-teal-500/5 dark:border-teal-900/45 dark:bg-zinc-900/85 dark:ring-teal-900/20";

/** Idempotent patch when `long_term_holdings` predates newer columns. */
const LONG_TERM_SCHEMA_PATCH = `alter table public.long_term_holdings
  add column if not exists buy_point_bdt numeric,
  add column if not exists sell_point_bdt numeric,
  add column if not exists manual_avg_cost_bdt numeric,
  add column if not exists manual_total_invested_bdt numeric,
  add column if not exists classification text;

alter table public.long_term_holdings
  drop constraint if exists long_term_holdings_classification_check;

alter table public.long_term_holdings
  add constraint long_term_holdings_classification_check
  check (classification is null or classification in ('BLUE', 'GREEN'));`;

export default async function LongTermPage() {
  const supabase = await createClient();
  const [{ instruments, error: instrumentsError }, holdingsRes, listRes, lspRes] =
    await Promise.all([
      getCachedDseInstruments(),
      fetchUserHoldings(),
      supabase
        .from("long_term_holdings")
        .select(
          "id, created_at, symbol, buy_point_bdt, sell_point_bdt, manual_avg_cost_bdt, manual_total_invested_bdt, classification",
        )
        .order("symbol", { ascending: true }),
      fetchDseLspQuoteMap(),
    ]);

  const { data: rows, error } = listRes;

  if (error) {
    const missingLtColumns =
      /buy_point_bdt|sell_point_bdt|manual_avg_cost_bdt|manual_total_invested_bdt|classification|column .* does not exist/i.test(
        error.message,
      );

    return (
      <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto w-full min-w-0 max-w-7xl text-left">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error.message}
        </p>
        {missingLtColumns ? (
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/95 p-3 text-[15px] font-normal leading-snug text-amber-950 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-100">
            <p>Add the missing columns (safe to re-run)</p>
            <p className="mt-1 text-[15px] font-normal text-amber-900/90 dark:text-amber-200/90">
              Supabase Dashboard → SQL Editor → New query → paste → Run. Then reload this page.
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-900 p-3 font-mono text-[15px] font-normal leading-relaxed text-zinc-100">
              {LONG_TERM_SCHEMA_PATCH}
            </pre>
            <p className="mt-2 text-[15px] font-normal text-amber-900/85 dark:text-amber-200/80">
              Same block is at the bottom of{" "}
              <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">
                supabase/schema.sql
              </code>{" "}
              (and split across{" "}
              <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">
                20260420120000_long_term_buy_sell_points.sql
              </code>
              ,{" "}
              <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">
                20260420200000_long_term_manual_costs.sql
              </code>
              ,{" "}
              <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">
                20260422130000_watchlist_classification.sql
              </code>
              ).
            </p>
          </div>
        ) : (
          <p className="text-[15px] font-normal leading-snug text-zinc-600 dark:text-zinc-400">
            Run{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
              supabase/migrations/20260209120000_planning_tables.sql
            </code>{" "}
            if tables are missing.
          </p>
        )}
      </AppPageStack>
    );
  }

  const bySymbol = new Map(
    holdingsRes.holdings.map((h) => [h.symbol.toUpperCase(), h]),
  );

  const companyExtrasMapBySymbol = await fetchDseCompanyExtrasMap(
    (rows ?? []).map((r) => String(r.symbol).trim()),
  );

  // Also fetch company extras for all portfolio holdings
  const allPortfolioCompanyExtras = await fetchDseCompanyExtrasMap(
    holdingsRes.holdings.map((h) => h.symbol),
  );

  const list: LongTermHoldingRow[] = (rows ?? []).map((row) => {
    const sym = String(row.symbol).trim().toUpperCase();
    const h = bySymbol.get(sym);
    const quote = lspRes.bySymbol.get(sym);
    const liveZones = quote ? zoneLevelsFromLspQuote(quote) : null;
    const extras = companyExtrasMapBySymbol.get(sym);
    const sector = extras?.sector ?? h?.category ?? null;
    return {
      id: row.id,
      created_at: row.created_at,
      symbol: row.symbol,
      sector,
      buy_point_bdt: row.buy_point_bdt,
      sell_point_bdt: row.sell_point_bdt,
      manual_avg_cost_bdt: row.manual_avg_cost_bdt,
      manual_total_invested_bdt: row.manual_total_invested_bdt,
      portfolio_avg_cost_bdt: h ? h.avgPrice : null,
      portfolio_total_invested_bdt: h ? h.totalCost : null,
      liveZones,
      classification: normalizeWatchlistClassification(row.classification),
    };
  });

  // Build sector chart data from all portfolio holdings
  const portfolioHoldingsForChart: PortfolioHoldingForChart[] = holdingsRes.holdings.map((h) => {
    const sym = h.symbol.toUpperCase();
    const extras = allPortfolioCompanyExtras.get(sym);
    const sector = extras?.sector ?? h.category ?? null;
    return {
      symbol: h.symbol,
      sector,
      totalCost: h.totalCost,
    };
  });

  return (
    <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto w-full min-w-0 max-w-7xl text-left">
      <WatchlistSectorChart holdings={portfolioHoldingsForChart} />
      <AddLongTermForm
        instruments={instruments}
        instrumentsError={instrumentsError}
        toolbarShell={toolbarShell}
      />
      <LongTermHoldingsTable rows={list} />
    </AppPageStack>
  );
}
