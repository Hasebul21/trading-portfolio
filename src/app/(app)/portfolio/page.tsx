import { AppPageStack } from "@/components/app-page-stack";
import { fetchPortfolioWithDseMarket } from "@/lib/market/portfolio-with-quotes";
import { siteTextLinkNeutralClass } from "@/lib/site-typography";
import Link from "next/link";
import { Card, Empty } from "antd";
import { PortfolioLiveShell } from "./portfolio-live-shell";

/** Always render with fresh data. */
export const revalidate = 0;

export default async function PortfolioPage() {
 const portfolioRes = await fetchPortfolioWithDseMarket();

 const { error, holdings, marketError, totalRealizedBdt, totalInvestedBdt, totalCashAdjustmentsBdt } = portfolioRes;

 if (error) {
 const missingTable =
 /could not find the table|does not exist|schema cache|relation.*transactions/i.test(
 error,
 );

 return (
 <AppPageStack className="mx-auto min-w-0 max-w-2xl text-left">
 <p className="rounded-lg bg-[var(--loss-50)] px-3 py-2 text-[var(--loss-700)] ">
 {error}
 </p>
 {missingTable ? (
 <div className="max-w-xl text-[15px] font-normal leading-relaxed text-[var(--ink-strong)] ">
 <p className="text-[15px] font-normal text-[var(--accent-700)] ">
 Create the tables in Supabase (one time)
 </p>
 <ol className="mt-3 list-decimal space-y-3 pl-5">
 <li>
 Open{" "}
 <a
 href="https://supabase.com/dashboard"
 className={siteTextLinkNeutralClass}
 target="_blank"
 rel="noopener noreferrer"
 >
 Supabase Dashboard
 </a>{" "}
 → your project → SQL Editor → New query.
 </li>
 <li>
 Copy the full file{" "}
 <code className="rounded bg-[var(--bg-surface-soft)] px-1 ">
 supabase/schema.sql
 </code>{" "}
 from this repo, paste into the editor, click Run.
 </li>
 <li>Reload this page. If it still errors, wait ~30s (schema cache) and refresh again.</li>
 </ol>
 </div>
 ) : (
 <p className="text-[15px] font-normal leading-snug text-[var(--ink-muted)] ">
 Check{" "}
 <code className="rounded bg-[var(--bg-surface-soft)] px-1 ">.env.local</code> points at
 this project and run{" "}
 <code className="rounded bg-[var(--bg-surface-soft)] px-1 ">supabase/schema.sql</code> in
 the SQL Editor if tables are missing.
 </p>
 )}
 </AppPageStack>
 );
 }

 return (
 <AppPageStack gapClass="gap-4 sm:gap-5" className="-mt-2 min-w-0 sm:-mt-4">
 {holdings.length === 0 ? (
 <Card
 variant="outlined"
 className="mx-auto max-w-lg border-2 border-dashed border-[var(--line)] bg-gradient-to-b from-white/90 to-teal-50/40 shadow-inner "
 >
 <Empty
 description={
 <span className="text-[15px] text-[var(--ink-muted)] ">
 No open positions yet.{" "}
 <Link href="/record" className={siteTextLinkNeutralClass}>
 Record a buy
 </Link>{" "}
 to see it here.
 </span>
 }
 />
 </Card>
 ) : (
 <div className="min-w-0 text-left">
 <PortfolioLiveShell
 initialHoldings={holdings}
 initialMarketError={marketError}
 initialTotalRealizedBdt={totalRealizedBdt}
 initialTotalInvestedBdt={totalInvestedBdt}
 initialTotalCashAdjustmentsBdt={totalCashAdjustmentsBdt}
 />
 </div>
 )}
 </AppPageStack>
 );
}
