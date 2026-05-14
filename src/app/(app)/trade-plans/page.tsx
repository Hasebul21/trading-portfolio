import { AppPageStack } from "@/components/app-page-stack";
import { addTradePlan } from "../planning-actions";
import { SymbolField } from "@/components/symbol-field";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { createClient } from "@/lib/supabase/server";
import { TradePlansTable } from "@/components/planning/trade-plans-table";
import { Button } from "antd";

const toolbarShell =
 "rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-2 py-1 shadow-sm ring-1 ring-teal-500/5 ";

export default async function TradePlansPage() {
 const { instruments, error: instrumentsError } = await getCachedDseInstruments();
 const supabase = await createClient();
 const { data: rows, error } = await supabase
 .from("immediate_trade_plans")
 .select("id, created_at, symbol, side, target_price, planned_budget_bdt, notes")
 .order("created_at", { ascending: false });

 if (error) {
 return (
 <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto min-w-0 max-w-4xl text-left">
 <p className="rounded-lg bg-[var(--loss-50)] px-3 py-2 text-[var(--loss-700)] ">
 {error.message}
 </p>
 <p className="text-[15px] font-normal leading-snug text-[var(--ink-muted)] ">
 Run{" "}
 <code className="rounded bg-[var(--bg-surface-soft)] px-1 ">
 supabase/migrations/20260209120000_planning_tables.sql
 </code>{" "}
 if tables are missing.
 </p>
 </AppPageStack>
 );
 }

 const list = rows ?? [];

 return (
 <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto min-w-0 max-w-4xl text-left">
 <div className={toolbarShell}>
 <form
 action={addTradePlan}
 className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1.5"
 >
 <div className="min-w-0 w-full sm:flex-1 sm:basis-[9.5rem]">
 <SymbolField
 instruments={instruments}
 loadError={instrumentsError}
 required
 aria-label="Symbol (DSE code)"
 placeholder="Symbol"
 size="sm"
 className="box-border h-9 w-full rounded border border-[var(--line-strong)] bg-[var(--bg-surface)] px-2 font-mono text-[15px] font-normal leading-none text-[var(--ink-strong)] outline-none ring-teal-500/30 focus:ring-1 "
 />
 </div>
 <select
 name="side"
 required
 aria-label="Buy or sell"
 className="box-border h-9 w-full shrink-0 rounded border border-[var(--line-strong)] bg-[var(--bg-surface)] px-2 text-[15px] font-normal text-[var(--ink-strong)] outline-none focus:ring-1 focus:ring-teal-500/40 sm:w-[4.25rem] sm:px-1 "
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
 className="box-border h-9 w-full min-w-0 shrink-0 rounded border border-[var(--line-strong)] bg-[var(--bg-surface)] px-2 text-[15px] font-normal text-[var(--ink-strong)] outline-none placeholder:text-[var(--ink-muted)] focus:ring-1 focus:ring-teal-500/40 sm:w-[5.25rem] sm:px-1.5 "
 />
 <input
 name="planned_budget_bdt"
 type="number"
 inputMode="decimal"
 min="0"
 step="any"
 aria-label="Planned budget"
 placeholder="Planned budget"
 className="box-border h-9 w-full min-w-0 shrink-0 rounded border border-[var(--line-strong)] bg-[var(--bg-surface)] px-2 text-[15px] font-normal text-[var(--ink-strong)] outline-none placeholder:text-[var(--ink-muted)] focus:ring-1 focus:ring-teal-500/40 sm:w-[8.5rem] sm:px-1.5 "
 />
 <input
 name="notes"
 type="text"
 aria-label="Note"
 placeholder="Note"
 className="box-border h-9 w-full min-w-0 rounded border border-[var(--line-strong)] bg-[var(--bg-surface)] px-2 text-[15px] font-normal text-[var(--ink-strong)] outline-none placeholder:text-[var(--ink-muted)] focus:ring-1 focus:ring-teal-500/40 sm:flex-1 sm:basis-[10rem] "
 />
 <Button
 type="primary"
 htmlType="submit"
 size="middle"
 className="h-9 w-full shrink-0 px-3 text-[15px] font-normal leading-none sm:w-auto"
 >
 Add
 </Button>
 </form>
 </div>

 <TradePlansTable rows={list} />
 </AppPageStack>
 );
}
