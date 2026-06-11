import { AppPageStack } from "@/components/app-page-stack";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { DividendForm } from "./dividend-form";

export const metadata = {
  title: "Dividends — Portfolio",
};

export default async function DividendPage() {
  const { instruments, error: instrumentsError } = await getCachedDseInstruments();

  return (
    <AppPageStack
      gapClass="gap-4 sm:gap-5"
      className="mx-auto w-full min-w-0 max-w-2xl text-left text-[var(--ink-strong)]"
    >
      <DividendForm instruments={instruments} instrumentsError={instrumentsError} />
    </AppPageStack>
  );
}
