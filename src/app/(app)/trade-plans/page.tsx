import { AppPageHeader, AppSectionTitle } from "@/components/app-page-header";
import { addTradePlan } from "../planning-actions";
import { SymbolField } from "@/components/symbol-field";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { createClient } from "@/lib/supabase/server";
import { TradePlansTable } from "@/components/planning/trade-plans-table";
import { Button, Card, Typography } from "antd";

export default async function TradePlansPage() {
  const { instruments, error: instrumentsError } = await getCachedDseInstruments();
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("immediate_trade_plans")
    .select("id, created_at, symbol, side, target_price")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div>
        <AppPageHeader title="Trade plans" />
        <Typography.Paragraph type="danger" className="rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/40">
          {error.message}
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" className="mt-2 text-sm">
          Run{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
            supabase/migrations/20260209120000_planning_tables.sql
          </code>{" "}
          if tables are missing.
        </Typography.Paragraph>
      </div>
    );
  }

  const list = rows ?? [];

  return (
    <div className="mx-auto max-w-4xl text-left">
      <AppPageHeader title="Trade plans" />

      <Card title="Add plan" className="mb-8 max-w-lg border-zinc-200 dark:border-zinc-800">
        <form action={addTradePlan} className="flex flex-col gap-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Symbol (DSE trading code)
            <SymbolField
              instruments={instruments}
              loadError={instrumentsError}
              required
              placeholder="e.g. BRACBANK"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Action
            <select
              name="side"
              required
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Target price (BDT)
            <input
              name="target_price"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              required
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <Button type="primary" htmlType="submit" className="w-fit">
            Add plan
          </Button>
        </form>
      </Card>

      <AppSectionTitle>Active plans ({list.length})</AppSectionTitle>
      {list.length === 0 ? (
        <Typography.Paragraph type="secondary" className="mt-2">
          No plans yet.
        </Typography.Paragraph>
      ) : (
        <TradePlansTable rows={list} />
      )}
    </div>
  );
}
