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
    <AppPageStack gapClass="gap-4 sm:gap-5" className="mx-auto w-full min-w-0 max-w-2xl text-left text-zinc-900">
      <header>
        <p className="text-[12px] uppercase tracking-[0.14em] text-zinc-500">
          Settings
        </p>
        <h1 className="mt-1 text-[26px] leading-tight tracking-tight text-zinc-900">
          Account & preferences
        </h1>
        <p className="mt-1 text-[13px] text-zinc-500">
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
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <p className="text-[14px]">{settingsRes.error}</p>
        </div>
      )}
    </AppPageStack>
  );
}
