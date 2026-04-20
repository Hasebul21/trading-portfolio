import { addCapitalContribution } from "../planning-actions";
import { AppSectionTitle } from "@/components/app-page-header";
import { AppPageStack } from "@/components/app-page-stack";
import { createClient } from "@/lib/supabase/server";
import { formatBdt } from "@/lib/format-bdt";
import { InvestedContributionsTable } from "@/components/planning/invested-contributions-table";
import { Button } from "antd";

const toolbarShell =
  "rounded-lg border border-teal-200/60 bg-white/92 px-3 py-2.5 shadow-sm ring-1 ring-teal-500/5 dark:border-teal-900/45 dark:bg-zinc-900/85 dark:ring-teal-900/20";

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
        <p className="text-[15px] font-normal leading-snug text-zinc-600 dark:text-zinc-400">
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
            aria-label="Amount"
            placeholder="0"
            className="box-border h-9 w-[6.5rem] shrink-0 rounded-md border border-zinc-300/90 bg-white px-2.5 text-[15px] font-normal text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
          />
          <input
            name="note"
            aria-label="Note (optional)"
            placeholder="Note"
            className="box-border h-9 min-w-0 flex-1 basis-[8rem] rounded-md border border-zinc-300/90 bg-white px-3 text-[15px] font-normal text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
          />
          <Button type="primary" htmlType="submit" className="h-9 shrink-0 px-4 text-[15px] font-normal">
            Add
          </Button>
        </form>
        <p className="mt-3 border-t border-zinc-200/70 pt-3 text-[15px] font-normal tabular-nums leading-snug text-zinc-600 dark:border-zinc-700/50 dark:text-zinc-300">
          Total{" "}
          <span className="tracking-normal text-teal-800 dark:text-teal-200">
            {formatBdt(total)}
          </span>
          <span className="mx-1.5 text-zinc-400 dark:text-zinc-500">·</span>
          <span className="text-zinc-800 dark:text-zinc-100">
            {list.length} contribution{list.length === 1 ? "" : "s"}
          </span>
        </p>
      </div>

      <AppSectionTitle>History</AppSectionTitle>
      <InvestedContributionsTable rows={list} />
    </AppPageStack>
  );
}
