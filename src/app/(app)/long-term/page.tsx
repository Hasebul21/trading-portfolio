import { addLongTermHolding } from "../planning-actions";
import { AppPageHeader, AppSectionTitle } from "@/components/app-page-header";
import { SymbolField } from "@/components/symbol-field";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { createClient } from "@/lib/supabase/server";
import { LongTermHoldingsTable } from "@/components/planning/long-term-holdings-table";
import { Button, Card, Typography } from "antd";

export default async function LongTermPage() {
  const { instruments, error: instrumentsError } = await getCachedDseInstruments();
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("long_term_holdings")
    .select("id, created_at, symbol")
    .order("symbol", { ascending: true });

  if (error) {
    return (
      <div>
        <AppPageHeader title="Long-term" />
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
      <AppPageHeader title="Long-term" />

      <Card title="Add symbol" className="mb-8 max-w-lg border-zinc-200 dark:border-zinc-800">
        <form action={addLongTermHolding} className="flex flex-col gap-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Symbol (DSE trading code)
            <SymbolField
              instruments={instruments}
              loadError={instrumentsError}
              required
              placeholder="e.g. GP"
            />
          </label>
          <Button type="primary" htmlType="submit" className="w-fit">
            Add to list
          </Button>
        </form>
      </Card>

      <AppSectionTitle>Your list ({list.length})</AppSectionTitle>
      {list.length === 0 ? (
        <Typography.Paragraph type="secondary" className="mt-2">
          No symbols yet.
        </Typography.Paragraph>
      ) : (
        <LongTermHoldingsTable rows={list} />
      )}
    </div>
  );
}
