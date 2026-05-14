import { addCapitalContribution } from "../planning-actions";
import { AppSectionTitle } from "@/components/app-page-header";
import { AppPageStack } from "@/components/app-page-stack";
import { createClient } from "@/lib/supabase/server";
import { formatBdt } from "@/lib/format-bdt";
import { InvestedContributionsTable } from "@/components/planning/invested-contributions-table";
import { Button } from "antd";

const toolbarShell =
 "rounded-lg border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2.5 shadow-sm ring-1 ring-teal-500/5 ";

export default async function InvestedPage() {
 const supabase = await createClient();
 const { data: rows, error } = await supabase
 .from("capital_contributions")
 .select("id, created_at, amount_bdt, note")
 .order("created_at", { ascending: false });

 if (error) {
 return (
 <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto max-w-2xl text-left">
 <p className="rounded-lg bg-[var(--loss-50)] px-3 py-2 text-[var(--loss-700)] ">
 {error.message}
 </p>
 <p className="text-[15px] font-normal leading-snug text-[var(--ink-muted)] ">
 Run the latest SQL in{" "}
 <code className="rounded bg-[var(--bg-surface-soft)] px-1 ">supabase/schema.sql</code> or{" "}
 <code className="rounded bg-[var(--bg-surface-soft)] px-1 ">
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
 <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto min-w-0 max-w-2xl text-left">
 <div className={toolbarShell}>
 <form
 action={addCapitalContribution}
 className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1.5"
 >
 <input
 name="amount_bdt"
 type="number"
 inputMode="decimal"
 min="0"
 step="any"
 required
 aria-label="Amount"
 placeholder="0"
 className="box-border h-9 w-full shrink-0 rounded-md border border-[var(--line-strong)] bg-[var(--bg-surface)] px-2.5 text-[15px] font-normal text-[var(--ink-strong)] outline-none placeholder:text-[var(--ink-muted)] focus:ring-2 focus:ring-teal-500/30 sm:w-[6.5rem] "
 />
 <input
 name="note"
 aria-label="Note (optional)"
 placeholder="Note"
 className="box-border h-9 min-w-0 w-full flex-1 rounded-md border border-[var(--line-strong)] bg-[var(--bg-surface)] px-3 text-[15px] font-normal text-[var(--ink-strong)] outline-none placeholder:text-[var(--ink-muted)] focus:ring-2 focus:ring-teal-500/30 sm:basis-[8rem] "
 />
 <Button
 type="primary"
 htmlType="submit"
 className="h-9 w-full shrink-0 px-4 text-[15px] font-normal sm:w-auto"
 >
 Add
 </Button>
 </form>
 <p className="mt-3 border-t border-[var(--line)] pt-3 text-[15px] font-normal tabular-nums leading-snug text-[var(--ink-muted)] ">
 Total{" "}
 <span className="tracking-normal text-[var(--accent-700)] ">
 {formatBdt(total)}
 </span>
 <span className="mx-1.5 text-[var(--ink-muted)] ">·</span>
 <span className="text-[var(--ink-strong)] ">
 {list.length} contribution{list.length === 1 ? "" : "s"}
 </span>
 </p>
 </div>

 <AppSectionTitle>History</AppSectionTitle>
 <InvestedContributionsTable rows={list} />
 </AppPageStack>
 );
}
