import { AppPageStack } from "@/components/app-page-stack";
import { AddLongTermForm } from "@/components/planning/add-long-term-form";
import {
    LongTermHoldingsTable,
    type LongTermHoldingRow,
} from "@/components/planning/long-term-holdings-table";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { fetchDseLspQuoteMap } from "@/lib/market/dse-lsp-quotes";
import { fetchDseCompanyExtrasMap } from "@/lib/market/dse-company-52w";
import { zoneLevelsFromLspQuote } from "@/lib/market/dse-zone-levels";
import { fetchUserHoldings } from "@/lib/holdings";
import { createClient } from "@/lib/supabase/server";

const toolbarShell =
    "rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-2 py-1 shadow-sm ring-1 ring-teal-500/5 ";

/** Idempotent patch when `long_term_holdings` predates newer columns. */
const LONG_TERM_SCHEMA_PATCH = `alter table public.long_term_holdings
 add column if not exists buy_point_bdt numeric,
 add column if not exists sell_point_bdt numeric,
 add column if not exists manual_avg_cost_bdt numeric,
 add column if not exists manual_total_invested_bdt numeric;`;

export default async function LongTermPage() {
    const supabase = await createClient();
    const [{ instruments, error: instrumentsError }, holdingsRes, listRes, lspRes] =
        await Promise.all([
            getCachedDseInstruments(),
            fetchUserHoldings(),
            supabase
                .from("long_term_holdings")
                .select(
                    "id, created_at, symbol, buy_point_bdt, sell_point_bdt, manual_avg_cost_bdt, manual_total_invested_bdt",
                )
                .order("symbol", { ascending: true }),
            fetchDseLspQuoteMap(),
        ]);

    const { data: rows, error } = listRes;

    if (error) {
        const missingLtColumns =
            /buy_point_bdt|sell_point_bdt|manual_avg_cost_bdt|manual_total_invested_bdt|column .* does not exist/i.test(
                error.message,
            );

        return (
            <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto w-full min-w-0 max-w-7xl text-left">
                <p className="rounded-lg bg-[var(--loss-50)] px-3 py-2 text-[var(--loss-700)] ">
                    {error.message}
                </p>
                {missingLtColumns ? (
                    <div className="rounded-lg border border-[var(--warn-200)] bg-[var(--warn-50)] p-3 text-[15px] font-normal leading-snug text-amber-950 shadow-sm ">
                        <p>Add the missing columns (safe to re-run)</p>
                        <p className="mt-1 text-[15px] font-normal text-[var(--warn-700)]/90 ">
                            Supabase Dashboard → SQL Editor → New query → paste → Run. Then reload this page.
                        </p>
                        <pre className="mt-2 overflow-x-auto rounded-md bg-[var(--bg-surface)] p-3 font-mono text-[15px] font-normal leading-relaxed text-[var(--ink-strong)]">
                            {LONG_TERM_SCHEMA_PATCH}
                        </pre>
                        <p className="mt-2 text-[15px] font-normal text-[var(--warn-700)]/85 ">
                            Same block is at the bottom of{" "}
                            <code className="rounded bg-[var(--warn-200)] px-1 ">
                                supabase/schema.sql
                            </code>{" "}
                            (and split across{" "}
                            <code className="rounded bg-[var(--warn-200)] px-1 ">
                                20260420120000_long_term_buy_sell_points.sql
                            </code>
                            ,{" "}
                            <code className="rounded bg-[var(--warn-200)] px-1 ">
                                20260420200000_long_term_manual_costs.sql
                            </code>
                            ).
                        </p>
                    </div>
                ) : (
                    <p className="text-[15px] font-normal leading-snug text-[var(--ink-muted)] ">
                        Run{" "}
                        <code className="rounded bg-[var(--bg-surface-soft)] px-1 ">
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
            ltp: quote?.ltp ?? null,
            week52Low: extras?.week52Low ?? null,
            week52High: extras?.week52High ?? null,
            breakEvenPrice: h ? h.breakEvenPrice : null,
            buy_point_bdt: row.buy_point_bdt,
            sell_point_bdt: row.sell_point_bdt,
            manual_avg_cost_bdt: row.manual_avg_cost_bdt,
            manual_total_invested_bdt: row.manual_total_invested_bdt,
            portfolio_avg_cost_bdt: h ? h.avgPrice : null,
            portfolio_total_invested_bdt: h ? h.totalCost : null,
            liveZones,
        };
    });

    return (
        <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto w-full min-w-0 max-w-7xl text-left">
            <AddLongTermForm
                instruments={instruments}
                instrumentsError={instrumentsError}
            />
            <LongTermHoldingsTable rows={list} />
        </AppPageStack>
    );
}
