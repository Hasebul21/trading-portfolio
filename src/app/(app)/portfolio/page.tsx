import { fetchPortfolioWithAmarQuotes } from "@/lib/market/portfolio-with-quotes";
import Link from "next/link";
import { Alert } from "antd";
import { PortfolioHoldingsTable } from "./portfolio-holdings-table";

/** Refresh portfolio + AmarStock movers cache (seconds). */
export const revalidate = 60;

export default async function PortfolioPage() {
  const { error, holdings, marketError, quotedSymbolCount } =
    await fetchPortfolioWithAmarQuotes();

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <p
          className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Confirm you ran <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">supabase/schema.sql</code>{" "}
          and set environment variables.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Portfolio
      </h1>
      <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
        Rows are built from{" "}
        <Link href="/record" className="font-medium text-zinc-900 underline dark:text-zinc-100">
          Record
        </Link>
        . Market LTP is pulled from the AmarStock movers JSON feed
        (top gainers/losers by index impact)—not the full DSE list—so only symbols
        appearing in that snapshot show a live price. Data may be delayed; the feed
        can change without notice.
      </p>

      {holdings.length > 0 ? (
        marketError ? (
          <Alert
            className="mt-4"
            type="warning"
            showIcon
            message="Could not load AmarStock prices"
            description={marketError}
          />
        ) : (
          <Alert
            className="mt-4"
            type="info"
            showIcon
            message="DSE market prices (AmarStock)"
            description={`Live LTP matched for ${quotedSymbolCount} of ${holdings.length} holding(s) from the movers feed. Others show “—” until that symbol appears in the feed.`}
          />
        )
      ) : null}

      {holdings.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
          No open positions yet. Record a buy for any symbol—it will show here with
          full details.{" "}
          <Link href="/record" className="font-medium text-zinc-900 underline dark:text-zinc-100">
            Go to Record
          </Link>
        </p>
      ) : (
        <div className="mt-6">
          <PortfolioHoldingsTable holdings={holdings} />
        </div>
      )}
    </div>
  );
}
