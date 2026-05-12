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
    <AppPageStack gapClass="gap-4 sm:gap-5" className="mx-auto w-full min-w-0 max-w-2xl text-left">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Settings</h1>
        <p className="mt-1 text-[15px] font-normal text-zinc-600 dark:text-zinc-400">
          Manage your portfolio preferences and sector targets
        </p>
      </div>

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
        <div className="rounded-lg bg-red-50 px-4 py-3 text-red-800 dark:bg-red-950/40 dark:text-red-200">
          <p className="text-[15px] font-normal">{settingsRes.error}</p>
        </div>
      )}
    </AppPageStack>
  );
}
