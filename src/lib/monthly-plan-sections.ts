export type MonthlyPlanSectionKey = "mip" | "draftMip";

export type MonthlyPlanSectionConfig = {
    key: MonthlyPlanSectionKey;
    title: string;
    routePath: string;
    headerTable: string;
    rowTable: string;
    migrationPath: string;
    tableRegex: RegExp;
};

export const MONTHLY_PLAN_SECTIONS: Record<MonthlyPlanSectionKey, MonthlyPlanSectionConfig> = {
    mip: {
        key: "mip",
        title: "MIP",
        routePath: "/mip",
        headerTable: "mip_monthly_headers",
        rowTable: "mip_monthly_rows",
        migrationPath: "supabase/migrations/20260421120000_mip_monthly_module.sql",
        tableRegex: /relation.*mip_monthly|could not find the table|does not exist|schema cache/i,
    },
    draftMip: {
        key: "draftMip",
        title: "Draft MIP",
        routePath: "/draft-mip",
        headerTable: "draft_mip_monthly_headers",
        rowTable: "draft_mip_monthly_rows",
        migrationPath: "supabase/migrations/20260423140000_draft_mip_monthly_module.sql",
        tableRegex: /relation.*draft_mip_monthly|could not find the table|does not exist|schema cache/i,
    },
};

export function getMonthlyPlanSectionConfig(key: MonthlyPlanSectionKey): MonthlyPlanSectionConfig {
    return MONTHLY_PLAN_SECTIONS[key];
}