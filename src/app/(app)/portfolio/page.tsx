import { AppPageStack } from "@/components/app-page-stack";
import { fetchPortfolioWithDseMarket } from "@/lib/market/portfolio-with-quotes";
import Link from "next/link";
import { Card, Empty } from "antd";
import { PortfolioLiveShell } from "./portfolio-live-shell";

/** Refresh portfolio + DSE market fetch cache (seconds). */
export const revalidate = 60;

export default async function PortfolioPage() {
  const { error, holdings, marketError } = await fetchPortfolioWithDseMarket();

  if (error) {
    const missingTable =
      /could not find the table|does not exist|schema cache|relation.*transactions/i.test(
        error,
      );

    return (
      <AppPageStack className="mx-auto max-w-2xl text-left">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
        {missingTable ? (
          <div className="max-w-xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              Create the tables in Supabase (one time)
            </p>
            <ol className="mt-3 list-decimal space-y-3 pl-5">
              <li>
                Open{" "}
                <a
                  href="https://supabase.com/dashboard"
                  className="font-medium text-zinc-900 underline dark:text-zinc-100"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Supabase Dashboard
                </a>{" "}
                → your project → SQL Editor → New query.
              </li>
              <li>
                Copy the full file{" "}
                <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
                  supabase/schema.sql
                </code>{" "}
                from this repo, paste into the editor, click Run.
              </li>
              <li>Reload this page. If it still errors, wait ~30s (schema cache) and refresh again.</li>
            </ol>
          </div>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Check{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">.env.local</code> points at
            this project and run{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">supabase/schema.sql</code> in
            the SQL Editor if tables are missing.
          </p>
        )}
      </AppPageStack>
    );
  }

  return (
    <AppPageStack gapClass="gap-4 sm:gap-5" className="-mt-2 sm:-mt-4">
      {holdings.length === 0 ? (
        <Card
          variant="outlined"
          className="mx-auto max-w-lg border-2 border-dashed border-teal-300/70 bg-gradient-to-b from-white/90 to-teal-50/40 shadow-inner dark:border-teal-700/50 dark:from-zinc-900/90 dark:to-teal-950/20"
        >
          <Empty
            description={
              <span className="text-base text-zinc-600 dark:text-zinc-400">
                No open positions yet.{" "}
                <Link
                  href="/record"
                  className="font-medium text-zinc-900 underline dark:text-zinc-100"
                >
                  Record a buy
                </Link>{" "}
                to see it here.
              </span>
            }
          />
        </Card>
      ) : (
        <div className="text-left">
          <PortfolioLiveShell
            initialHoldings={holdings}
            initialMarketError={marketError}
          />
        </div>
      )}
    </AppPageStack>
  );
}
