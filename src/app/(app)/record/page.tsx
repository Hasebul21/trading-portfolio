import { AppPageHeader } from "@/components/app-page-header";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { RecordForm } from "./record-form";

export default async function RecordPage() {
  const { instruments, error } = await getCachedDseInstruments();

  return (
    <div>
      <AppPageHeader title="Record trade" />
      <div className="mx-auto mt-6 max-w-xl text-left">
        <RecordForm instruments={instruments} instrumentsError={error} />
      </div>
    </div>
  );
}
