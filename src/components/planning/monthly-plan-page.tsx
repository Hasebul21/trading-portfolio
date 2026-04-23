import { AppPageHeader } from "@/components/app-page-header";
import { AppPageStack } from "@/components/app-page-stack";
import {
    MipMonthlyModule,
    type MipMonthlyHeaderDTO,
    type MipMonthlyRowDTO,
} from "@/components/planning/mip-monthly-module";
import {
    addDraftMipMonthlyRow,
    addMipMonthlyRow,
    deleteDraftMipMonthlyRow,
    lockDraftMipMonthlyRow,
    lockMipMonthlyRow,
    resetDraftMipMonthlySetup,
    resetMipMonthlySetup,
    submitDraftMipMonthlySetup,
    submitMipMonthlySetup,
} from "@/app/(app)/planning-actions";
import { getMonthlyPlanSectionConfig, type MonthlyPlanSectionKey } from "@/lib/monthly-plan-sections";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { isTodayDhakaInSubmissionWindowForYm, yearMonthDhaka } from "@/lib/mip-monthly";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
    searchParams: Promise<{ ym?: string }>;
    sectionKey: MonthlyPlanSectionKey;
};

const ACTIONS = {
    mip: {
        submitSetupAction: submitMipMonthlySetup,
        addRowAction: addMipMonthlyRow,
        deleteRowAction: undefined,
        lockRowAction: lockMipMonthlyRow,
        resetSetupAction: resetMipMonthlySetup,
    },
    draftMip: {
        submitSetupAction: submitDraftMipMonthlySetup,
        addRowAction: addDraftMipMonthlyRow,
        deleteRowAction: deleteDraftMipMonthlyRow,
        lockRowAction: lockDraftMipMonthlyRow,
        resetSetupAction: resetDraftMipMonthlySetup,
    },
} as const;

export async function MonthlyPlanPage({ searchParams, sectionKey }: PageProps) {
    const config = getMonthlyPlanSectionConfig(sectionKey);
    const actions = ACTIONS[sectionKey];

    const sp = await searchParams;
    const currentYmDhaka = yearMonthDhaka(new Date());
    const ymParam = typeof sp.ym === "string" && /^\d{4}-\d{2}$/.test(sp.ym) ? sp.ym : null;
    const viewYm = ymParam ?? currentYmDhaka;

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    const { instruments, error: instrumentsError } = await getCachedDseInstruments();

    const needCurrentSeparately = user && viewYm !== currentYmDhaka;

    const [headerRes, currentHeaderRes, allHeadersRes, allLockedRowsRes] = await Promise.all([
        user
            ? supabase
                .from(config.headerTable)
                .select("id, year_month, plan_date, base_amount_bdt, carried_forward_bdt, locked_at")
                .eq("user_id", user.id)
                .eq("year_month", viewYm)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        needCurrentSeparately
            ? supabase
                .from(config.headerTable)
                .select("id, year_month, plan_date, base_amount_bdt, carried_forward_bdt, locked_at")
                .eq("user_id", user!.id)
                .eq("year_month", currentYmDhaka)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        user
            ? supabase.from(config.headerTable).select("base_amount_bdt").eq("user_id", user.id)
            : Promise.resolve({ data: null, error: null }),
        user
            ? supabase
                .from(config.rowTable)
                .select(`calculated_amount_bdt, ${config.headerTable}!inner(user_id)`)
                .eq("locked", true)
                .eq(`${config.headerTable}.user_id`, user.id)
            : Promise.resolve({ data: null, error: null }),
    ]);

    const { data: headerRow, error: headerErr } = headerRes;

    if (headerErr) {
        const missing = config.tableRegex.test(headerErr.message);

        return (
            <AppPageStack gapClass="gap-4 sm:gap-5" className="mx-auto min-w-0 max-w-2xl text-left">
                <AppPageHeader title={config.title} />
                <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800 dark:bg-red-950/40 dark:text-red-200">
                    {headerErr.message}
                </p>
                {missing ? (
                    <p className="text-[15px] font-normal leading-snug text-zinc-600 dark:text-zinc-400">
                        Run <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">{config.migrationPath}</code> in the
                        Supabase SQL Editor (or merge from <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">supabase/schema.sql</code>), then reload.
                    </p>
                ) : null}
            </AppPageStack>
        );
    }

    const header = headerRow as MipMonthlyHeaderDTO | null;
    const currentHeader = needCurrentSeparately ? (currentHeaderRes.data as MipMonthlyHeaderDTO | null) : header;

    let rows: MipMonthlyRowDTO[] = [];
    if (header) {
        const { data: rowData, error: rowErr } = await supabase
            .from(config.rowTable)
            .select("id, header_id, sort_order, symbol, percentage, note, calculated_amount_bdt, locked")
            .eq("header_id", header.id)
            .order("sort_order", { ascending: true });

        if (!rowErr && rowData) {
            rows = rowData as MipMonthlyRowDTO[];
        }
    }

    let currentRows: MipMonthlyRowDTO[] = [];
    if (needCurrentSeparately && currentHeader) {
        const { data: rowData } = await supabase
            .from(config.rowTable)
            .select("id, header_id, sort_order, symbol, percentage, note, calculated_amount_bdt, locked")
            .eq("header_id", currentHeader.id)
            .order("sort_order", { ascending: true });
        if (rowData) currentRows = rowData as MipMonthlyRowDTO[];
    } else {
        currentRows = rows;
    }

    const totalHeaderRows = (allHeadersRes.data ?? []) as Array<{ base_amount_bdt: unknown }>;
    const totalLockedRows = (allLockedRowsRes.data ?? []) as unknown as Array<{ calculated_amount_bdt: unknown }>;

    const totalInvestedBdt = totalHeaderRows.reduce(
        (sum, item) => sum + Number(item.base_amount_bdt ?? 0),
        0,
    );
    const totalAllocatedBdt = totalLockedRows.reduce(
        (sum, item) => sum + Number(item.calculated_amount_bdt ?? 0),
        0,
    );
    const totalBalanceBdt = Math.round((totalInvestedBdt - totalAllocatedBdt) * 100) / 100;

    const canSubmitThisMonth =
        !header && viewYm === currentYmDhaka && isTodayDhakaInSubmissionWindowForYm(viewYm);
    const canResetThisMonth =
        !!header && viewYm === currentYmDhaka && isTodayDhakaInSubmissionWindowForYm(viewYm);

    return (
        <AppPageStack gapClass="gap-4 sm:gap-5" className="mx-auto min-w-0 max-w-4xl text-left">
            <AppPageHeader title={config.title} />
            <MipMonthlyModule
                key={`${config.routePath}:${viewYm}`}
                sectionTitle={config.title}
                routePath={config.routePath}
                viewYm={viewYm}
                currentYmDhaka={currentYmDhaka}
                header={header}
                rows={rows}
                currentHeader={currentHeader}
                currentRows={currentRows}
                totalBalanceBdt={totalBalanceBdt}
                instruments={instruments}
                instrumentsError={instrumentsError}
                canSubmitThisMonth={canSubmitThisMonth}
                canResetThisMonth={canResetThisMonth}
                submitSetupAction={actions.submitSetupAction}
                addRowAction={actions.addRowAction}
                deleteRowAction={actions.deleteRowAction}
                lockRowAction={actions.lockRowAction}
                resetSetupAction={actions.resetSetupAction}
            />
        </AppPageStack>
    );
}