export type MonthlyPlanSectionKey = "mip";

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
};

export function getMonthlyPlanSectionConfig(key: MonthlyPlanSectionKey): MonthlyPlanSectionConfig {
    return MONTHLY_PLAN_SECTIONS[key];
}
