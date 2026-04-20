import { AppPageStack } from "@/components/app-page-stack";
import { ChartsEmbed } from "./charts-embed";

export default function ChartsPage() {
  return (
    <AppPageStack gapClass="gap-4 sm:gap-5" className="mx-auto w-full max-w-6xl text-left">
      <div>
        <h1 className="text-xl font-normal tracking-tight text-zinc-900 dark:text-zinc-50">Charts</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Long-term price context for a DSE symbol (embedded TradingView widget).
        </p>
      </div>
      <ChartsEmbed />
    </AppPageStack>
  );
}
