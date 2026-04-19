import { AppPageHeader } from "@/components/app-page-header";
import { fetchPortfolioWithDseMarket } from "@/lib/market/portfolio-with-quotes";
import Link from "next/link";
import { Card, Empty, Typography } from "antd";
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
      <div className="mx-auto max-w-2xl text-left">
        <AppPageHeader title="Portfolio" />
        <Typography.Paragraph type="danger" className="rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/40">
          {error}
        </Typography.Paragraph>
        {missingTable ? (
          <div className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              Create the tables in Supabase (one time)
            </p>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
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
          <Typography.Paragraph type="secondary" className="mt-2 text-sm">
            Check{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">.env.local</code> points at
            this project and run{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">supabase/schema.sql</code> in
            the SQL Editor if tables are missing.
          </Typography.Paragraph>
        )}
      </div>
    );
  }

  return (
    <div>
      <AppPageHeader title="Portfolio" />

      {holdings.length === 0 ? (
        <Card className="border-dashed border-zinc-300 dark:border-zinc-700">
          <Empty
            description={
              <Typography.Text type="secondary" className="text-base">
                No open positions yet.{" "}
                <Link
                  href="/record"
                  className="font-medium text-zinc-900 underline dark:text-zinc-100"
                >
                  Record a buy
                </Link>{" "}
                to see it here.
              </Typography.Text>
            }
          />
        </Card>
      ) : (
        <div className="mt-2 text-left">
          <PortfolioLiveShell
            initialHoldings={holdings}
            initialMarketError={marketError}
          />
        </div>
      )}
    </div>
  );
}
