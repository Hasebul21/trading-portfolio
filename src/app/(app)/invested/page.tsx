import {
  addCapitalContribution,
  deleteCapitalContribution,
} from "../planning-actions";
import { AppPageHeader, AppSectionTitle } from "@/components/app-page-header";
import { createClient } from "@/lib/supabase/server";
import { formatBdt } from "@/lib/format-bdt";
import { Button, Card, Typography } from "antd";

export default async function InvestedPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("capital_contributions")
    .select("id, created_at, amount_bdt, note")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div>
        <AppPageHeader title="Invested capital" />
        <Typography.Paragraph type="danger" className="rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/40">
          {error.message}
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" className="mt-2 text-sm">
          Run the latest SQL in{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">supabase/schema.sql</code> or{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
            supabase/migrations/20260209120000_planning_tables.sql
          </code>
          .
        </Typography.Paragraph>
      </div>
    );
  }

  const list = rows ?? [];
  const total = list.reduce((s, r) => s + Number(r.amount_bdt), 0);

  return (
    <div className="mx-auto max-w-2xl text-left">
      <AppPageHeader title="Invested capital" />

      <Card className="mb-8 max-w-xl border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40">
        <Typography.Text type="secondary" className="text-sm font-medium uppercase tracking-wide">
          Total invested
        </Typography.Text>
        <Typography.Title level={2} className="!mb-1 !mt-2 tabular-nums" style={{ margin: 0 }}>
          {formatBdt(total)}
        </Typography.Title>
        <Typography.Text type="secondary" className="text-xs">
          {list.length} contribution{list.length === 1 ? "" : "s"}
        </Typography.Text>
      </Card>

      <Card title="Add contribution" className="mb-8 max-w-lg border-zinc-200 dark:border-zinc-800">
        <form action={addCapitalContribution} className="flex flex-col gap-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Amount (BDT)
            <input
              name="amount_bdt"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              required
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Note <span className="font-normal text-zinc-500">(optional)</span>
            <input
              name="note"
              placeholder="e.g. Jan deposit, bonus"
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <Button type="primary" htmlType="submit" className="w-fit">
            Save
          </Button>
        </form>
      </Card>

      <AppSectionTitle>History</AppSectionTitle>
      {list.length === 0 ? (
        <Typography.Paragraph type="secondary" className="mt-2">
          No entries yet.
        </Typography.Paragraph>
      ) : (
        <ul className="mt-4 max-w-2xl divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {list.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3.5 text-left dark:bg-zinc-950"
            >
              <div>
                <p className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
                  {formatBdt(Number(r.amount_bdt))}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {new Date(r.created_at).toLocaleString()}
                  {r.note ? ` · ${r.note}` : ""}
                </p>
              </div>
              <form action={deleteCapitalContribution}>
                <input type="hidden" name="id" value={r.id} />
                <Button type="link" danger size="small" htmlType="submit">
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
