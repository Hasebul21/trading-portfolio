import { AppPageStack } from "@/components/app-page-stack";
import {
    getUserSettings,
    listBrokerageAccounts,
    listCashAdjustments,
} from "../settings-actions";
import { getSectorTargets } from "../sector-target-actions";
import { listDividends } from "../dividend-actions";
import { SettingsForm } from "./settings-form";

export const metadata = {
    title: "Settings — Portfolio",
};

export default async function SettingsPage() {
    const [settingsRes, targetsRes, adjustmentsRes, dividendsRes, brokeragesRes] = await Promise.all([
        getUserSettings(),
        getSectorTargets(),
        listCashAdjustments(),
        listDividends(),
        listBrokerageAccounts(),
    ]);

    return (
        <AppPageStack gapClass="gap-4 sm:gap-5" className="mx-auto w-full min-w-0 max-w-[1400px] text-left text-[var(--ink-strong)]">
            {settingsRes.ok ? (
                <SettingsForm
                    initialSettings={settingsRes.settings}
                    initialSectorTargets={targetsRes.ok ? targetsRes.data.rows : []}
                    sectorTargetsError={targetsRes.ok ? null : targetsRes.error}
                    initialCashAdjustments={adjustmentsRes.ok ? adjustmentsRes.rows : []}
                    initialCashAdjustmentsTotal={adjustmentsRes.ok ? adjustmentsRes.total : 0}
                    cashAdjustmentsError={adjustmentsRes.ok ? null : adjustmentsRes.error}
                    initialDividends={dividendsRes.ok ? dividendsRes.rows : []}
                    initialDividendTotalCash={dividendsRes.ok ? dividendsRes.totalCash : 0}
                    initialDividendTotalStockShares={dividendsRes.ok ? dividendsRes.totalStockShares : 0}
                    dividendsError={dividendsRes.ok ? null : dividendsRes.error}
                    initialBrokerageAccounts={brokeragesRes.ok ? brokeragesRes.rows : []}
                    brokerageAccountsError={brokeragesRes.ok ? null : brokeragesRes.error}
                />
            ) : (
                <div className="rounded-lg border border-[var(--loss-200)] bg-[var(--loss-50)] px-4 py-3 text-[var(--loss-700)]">
                    <p className="text-[14px]">{settingsRes.error}</p>
                </div>
            )}
        </AppPageStack>
    );
}
