import { addCapitalContribution } from "../planning-actions";
import { AppPageHeader, AppSectionTitle } from "@/components/app-page-header";
import { AppPageStack } from "@/components/app-page-stack";
import { createClient } from "@/lib/supabase/server";
import { formatBdt } from "@/lib/format-bdt";
import { InvestedContributionsTable } from "@/components/planning/invested-contributions-table";
import { Button, Card } from "antd";

export default async function InvestedPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("capital_contributions")
    .select("id, created_at, amount_bdt, note")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <AppPageStack className="mx-auto max-w-2xl text-left">
        <AppPageHeader title="Invested capital" />
        <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error.message}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Run the latest SQL in{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">supabase/schema.sql</code> or{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
            supabase/migrations/20260209120000_planning_tables.sql
          </code>
          .
        </p>
      </AppPageStack>
    );
  }

  const list = rows ?? [];
  const total = list.reduce((s, r) => s + Number(r.amount_bdt), 0);

  return (
    <AppPageStack className="mx-auto max-w-2xl text-left">
      <AppPageHeader title="Invested capital" />

      <Card className="max-w-xl rounded-2xl border-teal-200/50 bg-white/85 shadow-lg shadow-teal-950/5 backdrop-blur-sm dark:border-teal-900/35 dark:bg-zinc-900/70 dark:shadow-black/30">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Total invested
        </p>
        <h2 className="mb-1 mt-2 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
          {formatBdt(total)}
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {list.length} contribution{list.length === 1 ? "" : "s"}
        </p>
      </Card>

      <Card
        size="small"
        className="max-w-sm rounded-xl border-teal-200/50 bg-white/85 shadow-sm dark:border-teal-900/35 dark:bg-zinc-900/70"
        styles={{ body: { padding: "12px 14px" } }}
      >
        <form action={addCapitalContribution} className="flex flex-col gap-2.5">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            BDT
            <input
              name="amount_bdt"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              required
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none focus:ring-1 focus:ring-teal-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Note
            <input
              name="note"
              placeholder="optional"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none focus:ring-1 focus:ring-teal-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <Button type="primary" htmlType="submit" size="small" className="w-fit text-xs">
            Add
          </Button>
        </form>
      </Card>

      <AppSectionTitle>History</AppSectionTitle>
      <InvestedContributionsTable rows={list} />
    </AppPageStack>
  );
}
