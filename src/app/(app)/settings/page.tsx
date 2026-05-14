import { AppPageStack } from "@/components/app-page-stack";
import { getUserSettings, listCashAdjustments } from "../settings-actions";
import { getSectorTargets } from "../sector-target-actions";
import { SettingsForm } from "./settings-form";

export const metadata = {
 title: "Settings — Portfolio",
};

export default async function SettingsPage() {
 const [settingsRes, targetsRes, adjustmentsRes] = await Promise.all([
 getUserSettings(),
 getSectorTargets(),
 listCashAdjustments(),
 ]);

 return (
 <AppPageStack gapClass="gap-4 sm:gap-5" className="mx-auto w-full min-w-0 max-w-2xl text-left text-[var(--ink-strong)]">
 <header>
 <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
 Settings
 </p>
 <h1 className="mt-1 text-[26px] leading-tight tracking-tight text-[var(--ink-strong)]">
 Account & preferences
 </h1>
 <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
 Manage your profile, sector targets, cash adjustments, and reports.
 </p>
 </header>

 {settingsRes.ok ? (
 <SettingsForm
 initialSettings={settingsRes.settings}
 initialSectorTargets={targetsRes.ok ? targetsRes.data.rows : []}
 sectorTargetsError={targetsRes.ok ? null : targetsRes.error}
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
