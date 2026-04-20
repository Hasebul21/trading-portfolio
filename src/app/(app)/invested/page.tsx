import { addCapitalContribution } from "../planning-actions";
import { AppSectionTitle } from "@/components/app-page-header";
import { AppPageStack } from "@/components/app-page-stack";
import { createClient } from "@/lib/supabase/server";
import { formatBdt } from "@/lib/format-bdt";
import { InvestedContributionsTable } from "@/components/planning/invested-contributions-table";
import { Button } from "antd";

const toolbarShell =
  "rounded-md border border-teal-200/60 bg-white/92 px-2 py-1 shadow-sm ring-1 ring-teal-500/5 dark:border-teal-900/45 dark:bg-zinc-900/85 dark:ring-teal-900/20";

export default async function InvestedPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("capital_contributions")
    .select("id, created_at, amount_bdt, note")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto max-w-2xl text-left">
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
    <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto max-w-2xl text-left">
      <div className={toolbarShell}>
        <form action={addCapitalContribution} className="flex flex-wrap items-center gap-1.5">
          <input
            name="amount_bdt"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            required
            aria-label="Amount in BDT"
            placeholder="BDT"
            className="box-border h-7 w-[5.5rem] shrink-0 rounded border border-zinc-300/90 bg-white px-2 text-[11px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-1 focus:ring-teal-500/40 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
          />
          <input
            name="note"
            aria-label="Note (optional)"
            placeholder="Note"
            className="box-border h-7 min-w-0 flex-1 basis-[6rem] rounded border border-zinc-300/90 bg-white px-2 text-[11px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-1 focus:ring-teal-500/40 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
          />
          <Button type="primary" htmlType="submit" size="small" className="h-7 shrink-0 px-2.5 text-[11px] leading-none">
            Add
          </Button>
        </form>
        <p className="mt-1 border-t border-zinc-200/60 pt-1 text-[10px] tabular-nums text-zinc-500 dark:border-zinc-700/50 dark:text-zinc-400">
          Total <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatBdt(total)}</span>
          <span className="text-zinc-400 dark:text-zinc-500"> · </span>
          {list.length} contribution{list.length === 1 ? "" : "s"}
        </p>
      </div>

      <AppSectionTitle>History</AppSectionTitle>
      <InvestedContributionsTable rows={list} />
    </AppPageStack>
  );
}
