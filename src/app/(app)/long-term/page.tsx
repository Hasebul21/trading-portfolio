import { addLongTermHolding } from "../planning-actions";
import { AppPageHeader, AppSectionTitle } from "@/components/app-page-header";
import { AppPageStack } from "@/components/app-page-stack";
import { SymbolField } from "@/components/symbol-field";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { createClient } from "@/lib/supabase/server";
import { LongTermHoldingsTable } from "@/components/planning/long-term-holdings-table";
import { Button, Card } from "antd";

export default async function LongTermPage() {
  const { instruments, error: instrumentsError } = await getCachedDseInstruments();
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("long_term_holdings")
    .select("id, created_at, symbol")
    .order("symbol", { ascending: true });

  if (error) {
    return (
      <AppPageStack className="mx-auto max-w-4xl text-left">
        <AppPageHeader title="Watchlist" />
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
      <AppPageHeader title="Watchlist" />

      <Card
        size="small"
        className="max-w-md rounded-xl border-teal-200/50 bg-white/85 shadow-sm dark:border-teal-900/35 dark:bg-zinc-900/70"
        styles={{ body: { padding: "12px 14px" } }}
      >
        <form
          action={addLongTermHolding}
          className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <label className="min-w-0 flex-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Symbol
            <SymbolField
              instruments={instruments}
              loadError={instrumentsError}
              required
              placeholder="GP"
              size="sm"
            />
          </label>
          <Button type="primary" htmlType="submit" size="small" className="text-xs sm:mb-0.5">
            Add
          </Button>
        </form>
      </Card>

      <AppSectionTitle>Your list ({list.length})</AppSectionTitle>
      <LongTermHoldingsTable rows={list} />
    </AppPageStack>
  );
}
