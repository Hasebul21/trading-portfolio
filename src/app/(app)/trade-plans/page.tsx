import { AppPageHeader, AppSectionTitle } from "@/components/app-page-header";
import { AppPageStack } from "@/components/app-page-stack";
import { addTradePlan } from "../planning-actions";
import { SymbolField } from "@/components/symbol-field";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { createClient } from "@/lib/supabase/server";
import { TradePlansTable } from "@/components/planning/trade-plans-table";
import { Button, Card } from "antd";

export default async function TradePlansPage() {
  const { instruments, error: instrumentsError } = await getCachedDseInstruments();
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("immediate_trade_plans")
    .select("id, created_at, symbol, side, target_price")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <AppPageStack className="mx-auto max-w-4xl text-left">
        <AppPageHeader title="Price targets" />
        <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error.message}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
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
    <AppPageStack className="mx-auto max-w-4xl text-left">
      <AppPageHeader title="Price targets" />

      <Card
        size="small"
        className="max-w-xl rounded-xl border-teal-200/50 bg-white/85 shadow-sm dark:border-teal-900/35 dark:bg-zinc-900/70"
        styles={{ body: { padding: "12px 14px" } }}
      >
        <form action={addTradePlan} className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-3 sm:items-end">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Symbol
              <SymbolField
                instruments={instruments}
                loadError={instrumentsError}
                required
                placeholder="BRACBANK"
                size="sm"
              />
            </label>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Side
              <select
                name="side"
                required
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none focus:ring-1 focus:ring-teal-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </label>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Target
              <input
                name="target_price"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                required
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none focus:ring-1 focus:ring-teal-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
          </div>
          <Button type="primary" htmlType="submit" size="small" className="text-xs">
            Add
          </Button>
        </form>
      </Card>

      <AppSectionTitle>Active targets ({list.length})</AppSectionTitle>
      <TradePlansTable rows={list} />
    </AppPageStack>
  );
}
