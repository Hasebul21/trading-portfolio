import { AppPageStack } from "@/components/app-page-stack";
import { FundamentalsCompact } from "@/components/knowledge/fundamentals-compact";
import { TradingPlaybookCompact } from "@/components/knowledge/trading-playbook-compact";

export default function KnowledgePage() {
  return (
    <AppPageStack gapClass="gap-4 sm:gap-5" className="mx-auto max-w-6xl text-left">
      <h1 className="sr-only">Knowledge</h1>

      <section>
        <h2 className="mb-2 text-[15px] font-normal tracking-normal text-teal-800 dark:text-teal-200">
          DSE table playbook
        </h2>
        <TradingPlaybookCompact />
      </section>

      <section>
        <h2 className="mb-2 text-[15px] font-normal tracking-normal text-teal-800 dark:text-teal-200">
          Fundamentals
        </h2>
        <p className="mb-3 max-w-3xl text-[15px] font-normal leading-relaxed text-zinc-600 dark:text-zinc-400">
          Plain-language notes on common company metrics. Numbers in examples are illustrative only.
        </p>
        <FundamentalsCompact />
      </section>

      <p className="rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-center text-[15px] font-normal leading-snug text-zinc-600 dark:border-zinc-700/60 dark:bg-zinc-900/50 dark:text-zinc-400">
        Personal use only — not financial advice.
      </p>
    </AppPageStack>
  );
}
