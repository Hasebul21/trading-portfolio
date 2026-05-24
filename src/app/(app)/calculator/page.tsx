import { AppPageStack } from "@/components/app-page-stack";
import { CalculatorView } from "@/components/calculator/calculator-view";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";

export default async function CalculatorPage() {
  const { instruments, error } = await getCachedDseInstruments();
  return (
    <AppPageStack gapClass="gap-3 sm:gap-4" className="mx-auto w-full min-w-0 max-w-4xl text-left">
      <CalculatorView instruments={instruments} instrumentsError={error} />
    </AppPageStack>
  );
}
