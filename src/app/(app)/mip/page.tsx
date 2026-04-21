import { AppPageHeader } from "@/components/app-page-header";
import { AppPageStack } from "@/components/app-page-stack";
import { MipPlansSection } from "@/components/planning/mip-plans-section";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { createClient } from "@/lib/supabase/server";

export default async function MipPage() {
  const supabase = await createClient();
  const [{ instruments, error: instrumentsError }, listRes] = await Promise.all([
    getCachedDseInstruments(),
    supabase
      .from("mip_plans")
      .select("id, created_at, symbol, total_investment_plan_bdt")
      .order("symbol", { ascending: true }),
  ]);

  const { data: rows, error: listError } = listRes;

  if (listError) {
    const missing =
      /could not find the table|does not exist|schema cache|relation.*mip_plans/i.test(
        listError.message,
      );

    return (
      <AppPageStack gapClass="gap-4 sm:gap-5" className="mx-auto min-w-0 max-w-2xl text-left">
        <AppPageHeader title="MIP" />
        <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {listError.message}
        </p>
        {missing ? (
          <p className="text-[15px] font-normal leading-snug text-zinc-600 dark:text-zinc-400">
            Run{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
              supabase/migrations/20260420120000_mip_plans.sql
            </code>{" "}
            in the Supabase SQL Editor (or merge the block from{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">supabase/schema.sql</code>
            ), then reload.
          </p>
        ) : null}
      </AppPageStack>
    );
  }

  return (
    <AppPageStack gapClass="gap-4 sm:gap-5" className="mx-auto min-w-0 max-w-3xl text-left">
      <AppPageHeader title="MIP" />
      <MipPlansSection
        rows={rows ?? []}
        loadError={null}
        instruments={instruments}
        instrumentsError={instrumentsError}
      />
    </AppPageStack>
  );
}
