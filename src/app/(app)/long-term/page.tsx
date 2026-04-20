import { addLongTermHolding } from "../planning-actions";
import { AppPageStack } from "@/components/app-page-stack";
import { SymbolField } from "@/components/symbol-field";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { fetchUserHoldings } from "@/lib/holdings";
import { createClient } from "@/lib/supabase/server";
import {
  LongTermHoldingsTable,
  type LongTermHoldingRow,
} from "@/components/planning/long-term-holdings-table";
import { Button } from "antd";

const toolbarShell =
  "rounded-md border border-teal-200/60 bg-white/92 px-2 py-1 shadow-sm ring-1 ring-teal-500/5 dark:border-teal-900/45 dark:bg-zinc-900/85 dark:ring-teal-900/20";

const compactNum =
  "box-border h-7 w-[4.75rem] shrink-0 rounded border border-zinc-300/90 bg-white px-1.5 text-[11px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-1 focus:ring-teal-500/40 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

/** Idempotent patch when `long_term_holdings` predates newer columns. */
const LONG_TERM_SCHEMA_PATCH = `alter table public.long_term_holdings
  add column if not exists buy_point_bdt numeric,
  add column if not exists sell_point_bdt numeric,
  add column if not exists manual_avg_cost_bdt numeric,
  add column if not exists manual_total_invested_bdt numeric;`;

export default async function LongTermPage() {
  const supabase = await createClient();
  const [{ instruments, error: instrumentsError }, holdingsRes, listRes] =
    await Promise.all([
      getCachedDseInstruments(),
      fetchUserHoldings(),
      supabase
        .from("long_term_holdings")
        .select(
          "id, created_at, symbol, buy_point_bdt, sell_point_bdt, manual_avg_cost_bdt, manual_total_invested_bdt",
        )
        .order("symbol", { ascending: true }),
    ]);

  const { data: rows, error } = listRes;

  if (error) {
    const missingLtColumns =
      /buy_point_bdt|sell_point_bdt|manual_avg_cost_bdt|manual_total_invested_bdt|column .* does not exist/i.test(
        error.message,
      );

    return (
      <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto max-w-4xl text-left">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error.message}
        </p>
        {missingLtColumns ? (
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/95 p-3 text-sm text-amber-950 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-100">
            <p className="font-medium">Add the missing columns (safe to re-run)</p>
            <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-200/90">
              Supabase Dashboard → SQL Editor → New query → paste → Run. Then reload this page.
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-900 p-3 font-mono text-[11px] leading-relaxed text-zinc-100">
              {LONG_TERM_SCHEMA_PATCH}
            </pre>
            <p className="mt-2 text-xs text-amber-900/85 dark:text-amber-200/80">
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
              ).
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
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

  const list: LongTermHoldingRow[] = (rows ?? []).map((row) => {
    const sym = String(row.symbol).trim().toUpperCase();
    const h = bySymbol.get(sym);
    return {
      id: row.id,
      created_at: row.created_at,
      symbol: row.symbol,
      buy_point_bdt: row.buy_point_bdt,
      sell_point_bdt: row.sell_point_bdt,
      manual_avg_cost_bdt: row.manual_avg_cost_bdt,
      manual_total_invested_bdt: row.manual_total_invested_bdt,
      portfolio_avg_cost_bdt: h ? h.avgPrice : null,
      portfolio_total_invested_bdt: h ? h.totalCost : null,
    };
  });

  return (
    <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto max-w-4xl text-left">
      <div className={toolbarShell}>
        <form action={addLongTermHolding} className="flex flex-wrap items-center gap-1.5">
          <div className="min-w-0 flex-1 basis-[7.5rem] sm:max-w-xs">
            <SymbolField
              instruments={instruments}
              loadError={instrumentsError}
              required
              aria-label="Symbol (DSE code)"
              placeholder="Symbol"
              size="sm"
              className="box-border h-7 w-full rounded border border-zinc-300/90 bg-white px-2 font-mono text-[11px] leading-none text-zinc-900 outline-none ring-teal-500/30 focus:ring-1 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>
          <input
            name="buy_point_bdt"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            aria-label="Buy point (optional)"
            placeholder="Buy pt"
            className={compactNum}
          />
          <input
            name="sell_point_bdt"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            aria-label="Sell point (optional)"
            placeholder="Sell pt"
            className={compactNum}
          />
          <Button type="primary" htmlType="submit" size="small" className="h-7 shrink-0 px-2.5 text-[11px] leading-none">
            Add
          </Button>
        </form>
      </div>

      <LongTermHoldingsTable rows={list} />
    </AppPageStack>
  );
}
