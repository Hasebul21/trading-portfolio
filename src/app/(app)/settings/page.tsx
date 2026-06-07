import { AppPageStack } from "@/components/app-page-stack";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { getUserSettings, listCashAdjustments } from "../settings-actions";
import { getSectorTargets } from "../sector-target-actions";
import { getSectorMonthlyInvestments } from "../sector-investment-actions";
import { getSellPlans } from "../sell-plan-actions";
import { SettingsForm } from "./settings-form";

export const metadata = {
    title: "Settings — Portfolio",
};

export default async function SettingsPage() {
    const [settingsRes, targetsRes, investmentsRes, sellPlansRes, instrumentsRes, adjustmentsRes] =
        await Promise.all([
            getUserSettings(),
            getSectorTargets(),
            getSectorMonthlyInvestments(),
            getSellPlans(),
            getCachedDseInstruments(),
            listCashAdjustments(),
        ]);

    return (
        <AppPageStack gapClass="gap-4 sm:gap-5" className="mx-auto w-full min-w-0 max-w-2xl text-left text-[var(--ink-strong)]">
            {settingsRes.ok ? (
                <SettingsForm
                    initialSettings={settingsRes.settings}
                    initialSectorTargets={targetsRes.ok ? targetsRes.data.rows : []}
                    sectorTargetsError={targetsRes.ok ? null : targetsRes.error}
                    initialSectorInvestments={investmentsRes.ok ? investmentsRes.data.rows : []}
                    sectorInvestmentsError={investmentsRes.ok ? null : investmentsRes.error}
                    initialSellPlans={sellPlansRes.ok ? sellPlansRes.data.rows : []}
                    sellPlansError={sellPlansRes.ok ? null : sellPlansRes.error}
                    sellPlanInstruments={instrumentsRes.instruments}
                    sellPlanInstrumentsError={instrumentsRes.error}
                    initialCashAdjustments={adjustmentsRes.ok ? adjustmentsRes.rows : []}
                    initialCashAdjustmentsTotal={adjustmentsRes.ok ? adjustmentsRes.total : 0}
                    cashAdjustmentsError={adjustmentsRes.ok ? null : adjustmentsRes.error}
                />
            ) : (
                <div className="rounded-lg border border-[var(--loss-200)] bg-[var(--loss-50)] px-4 py-3 text-[var(--loss-700)]">
                    <p className="text-[14px]">{settingsRes.error}</p>
                </div>
            )}
        </AppPageStack>
    );
}
