import { AppPageHeader } from "@/components/app-page-header";
import { AppPageStack } from "@/components/app-page-stack";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { RecordForm } from "./record-form";

export default async function RecordPage() {
  const { instruments, error } = await getCachedDseInstruments();

  return (
    <AppPageStack>
      <AppPageHeader title="Record trade" />
      <div className="mx-auto max-w-xl text-left">
        <RecordForm instruments={instruments} instrumentsError={error} />
      </div>
    </AppPageStack>
  );
}
