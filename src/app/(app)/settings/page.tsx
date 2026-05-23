import { AppPageStack } from "@/components/app-page-stack";
import { getUserSettings, listCashAdjustments } from "../settings-actions";
import { getSectorTargets } from "../sector-target-actions";
import { SettingsForm } from "./settings-form";

export const metadata = {
 title: "Settings — Portfolio",
};

export default async function SettingsPage() {
 const [settingsRes, targetsRes, adjustmentsRes] = await Promise.all([
 getUserSettings(),
 getSectorTargets(),
 listCashAdjustments(),
 ]);

 return (
 <AppPageStack gapClass="gap-4 sm:gap-5" className="mx-auto w-full min-w-0 max-w-2xl text-left text-[var(--ink-strong)]">
 <header>
 <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
 Settings
 </p>
 <h1 className="mt-1 text-[26px] leading-tight tracking-tight text-[var(--ink-strong)]">
 Account & preferences
 </h1>
 </header>

 <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface-soft)] px-4 py-4 text-[13.5px] leading-relaxed text-[var(--ink-muted)]">
 <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">
 How Trade Desk scores stocks
 </p>
 <p className="mb-3 text-[var(--ink-default)]">
 Trade Desk screens every stock in your watchlist and portfolio using four pillars — Valuation (30 pts), Quality (25 pts), Safety (20 pts), and Technical (25 pts) — then ranks them out of 100. Any stock below 55 is filtered out; your top picks are the ones that clear the bar.
 </p>
 <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
 {[
 ["Graham #", "Benjamin Graham's intrinsic value ceiling — √(22.5 × EPS × NAV). A price well below this suggests the stock is undervalued on fundamentals alone."],
 ["MoS %", "Margin of Safety — how far the current price sits below the Graham Number, expressed as a percentage. Higher is safer; negative means the price exceeds intrinsic value."],
 ["EY %", "Earnings Yield — EPS ÷ Price × 100. Compared against Bangladesh's ~9.5 % risk-free rate; stocks above that threshold are earning more than a T-bill."],
 ["ROE %", "Return on Equity — EPS ÷ NAV × 100. Measures how efficiently the company turns shareholder equity into profit."],
 ["Free Float", "The percentage of shares freely tradeable by the public (excludes promoter/sponsor holdings). Low free float can make a stock illiquid and volatile."],
 ["Drawdown", "How far the current price has fallen from its 52-week high — a large drawdown can signal distress or a potential entry point, depending on fundamentals."],
 ].map(([term, def]) => (
 <div key={term} className="flex gap-2">
 <dt className="w-24 shrink-0 font-medium text-[var(--ink-strong)]">{term}</dt>
 <dd>{def}</dd>
 </div>
 ))}
 </dl>
 </section>

 {settingsRes.ok ? (
 <SettingsForm
 initialSettings={settingsRes.settings}
 initialSectorTargets={targetsRes.ok ? targetsRes.data.rows : []}
 sectorTargetsError={targetsRes.ok ? null : targetsRes.error}
 initialCashAdjustments={adjustmentsRes.ok ? adjustmentsRes.rows : []}
 initialCashAdjustmentsTotal={adjustmentsRes.ok ? adjustmentsRes.total : 0}
 cashAdjustmentsError={adjustmentsRes.ok ? null : adjustmentsRes.error}
 />
 ) : (
 <div className="rounded-lg border border-[var(--loss-200)] bg-[var(--loss-50)] px-4 py-3 text-[var(--loss-700)]">
 <p className="text-[14px]">{settingsRes.error}</p>
 </div>
 )}
 </AppPageStack>
 );
}
