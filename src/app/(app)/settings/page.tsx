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
 <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface-soft)] px-4 py-4 text-[13.5px] leading-relaxed text-[var(--ink-muted)]">
 <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">
 Knowledge — Advanced metrics explained
 </p>
 <p className="mb-3 text-[var(--ink-default)]">
 Each pick card on Trade Desk shows these advanced fundamentals. They&apos;re
 computed from DSE-published EPS, NAV, and 52-week price data — values most
 retail screeners don&apos;t expose directly.
 </p>
 <dl className="space-y-2.5">
 {[
 [
 "Graham Number",
 "Intrinsic value ceiling",
 "Benjamin Graham's formula for the maximum price a defensive investor should pay: √(22.5 × EPS × NAV). If the live price is well below this number, the stock is statistically undervalued on fundamentals alone.",
 ],
 [
 "Margin of Safety",
 "vs Graham Number",
 "How far below the Graham Number the price currently sits, as a percentage: (Graham − Price) ÷ Graham × 100. Positive = undervalued cushion; +30 % is meaningful, +50 % is deep value. Negative means the market price exceeds Graham's ceiling.",
 ],
 [
 "Earnings Yield",
 "BD risk-free ~9.5 %",
 "EPS ÷ Price × 100 — the inverse of P/E expressed as a yield. Compare against Bangladesh's ~9.5 % 10-year T-bill: stocks earning more than the risk-free rate are paying you to take equity risk.",
 ],
 [
 "Return on Equity",
 "≥15 % = strong",
 "EPS ÷ NAV × 100. How efficiently the company turns one taka of shareholder equity into profit. Sustained ROE ≥ 15 % is the hallmark of a quality compounder; < 10 % is mediocre.",
 ],
 [
 "Dividend Payout Ratio",
 "< 75 % = sustainable",
 "Dividend per share ÷ EPS × 100. Below 75 % means the company comfortably covers its dividend from earnings; above 100 % means it's paying out more than it earns (drawing from reserves — not sustainable).",
 ],
 [
 "Drawdown from Peak",
 "Entry timing signal",
 "(Price − 52-week High) ÷ 52-week High × 100 — always ≤ 0. A 15–25 % pullback on a quality stock is often a healthy buy zone. > 40 % may signal genuine distress.",
 ],
 [
 "Recovery from Low",
 "Off 52-week trough",
 "(Price − 52-week Low) ÷ 52-week Low × 100. Tells you how much the stock has already bounced. Low recovery + high quality score = early in the turnaround; high recovery may mean you're late.",
 ],
 [
 "Conviction tier",
 "Score band",
 "Trade Desk classifies each pick: 75+ is High Conviction (long-term, 1Y+ horizon), 62–74 is Strong Buy (medium, 3–12 M), 55–61 is Buy (short, 1–3 M). Below 55 stays out of picks.",
 ],
 ].map(([term, hint, def]) => (
 <div key={term}>
 <div className="flex flex-wrap items-baseline gap-x-2">
 <dt className="font-medium text-[var(--ink-strong)]">{term}</dt>
 <span className="text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">{hint}</span>
 </div>
 <dd className="mt-0.5 text-[var(--ink-default)]">{def}</dd>
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
