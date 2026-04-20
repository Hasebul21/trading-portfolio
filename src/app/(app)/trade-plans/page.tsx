import { AppPageStack } from "@/components/app-page-stack";
import { addTradePlan } from "../planning-actions";
import { SymbolField } from "@/components/symbol-field";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { createClient } from "@/lib/supabase/server";
import { TradePlansTable } from "@/components/planning/trade-plans-table";
import { Button } from "antd";

const toolbarShell =
  "rounded-md border border-teal-200/60 bg-white/92 px-2 py-1 shadow-sm ring-1 ring-teal-500/5 dark:border-teal-900/45 dark:bg-zinc-900/85 dark:ring-teal-900/20";

export default async function TradePlansPage() {
  const { instruments, error: instrumentsError } = await getCachedDseInstruments();
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("immediate_trade_plans")
    .select("id, created_at, symbol, side, target_price")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto max-w-4xl text-left">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error.message}
        </p>
        <p className="text-[15px] font-normal leading-snug text-zinc-600 dark:text-zinc-400">
          Run{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
            supabase/migrations/20260209120000_planning_tables.sql
          </code>{" "}
          if tables are missing.
        </p>
      </AppPageStack>
    );
  }

  const list = rows ?? [];

  return (
    <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto max-w-4xl text-left">
      <div className={toolbarShell}>
        <form action={addTradePlan} className="flex flex-wrap items-center gap-1.5">
          <div className="min-w-0 flex-1 basis-[7.5rem] sm:basis-[9.5rem]">
            <SymbolField
              instruments={instruments}
              loadError={instrumentsError}
              required
              aria-label="Symbol (DSE code)"
              placeholder="Symbol"
              size="sm"
              className="box-border h-9 w-full rounded border border-zinc-300/90 bg-white px-2 font-mono text-[15px] font-normal leading-none text-zinc-900 outline-none ring-teal-500/30 focus:ring-1 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>
          <select
            name="side"
            required
            aria-label="Buy or sell"
            className="box-border h-9 w-[4.25rem] shrink-0 rounded border border-zinc-300/90 bg-white px-1 text-[15px] font-normal text-zinc-900 outline-none focus:ring-1 focus:ring-teal-500/40 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
          <input
            name="target_price"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            required
            aria-label="Target price"
            placeholder="Target"
            className="box-border h-9 w-[5.25rem] shrink-0 rounded border border-zinc-300/90 bg-white px-1.5 text-[15px] font-normal text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-1 focus:ring-teal-500/40 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
          />
          <Button type="primary" htmlType="submit" size="middle" className="h-9 shrink-0 px-3 text-[15px] font-normal leading-none">
            Add
          </Button>
        </form>
      </div>

      <TradePlansTable rows={list} />
    </AppPageStack>
  );
}
