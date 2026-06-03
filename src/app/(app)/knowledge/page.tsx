import { AppPageStack } from "@/components/app-page-stack";

export const metadata = {
    title: "Knowledge — Portfolio",
};

type MetricEntry = {
    term: string;
    hint: string;
    def: string;
    formula: string;
    verdicts: { tone: "buy" | "hold" | "exit"; label: string; detail: string }[];
};

const METRICS: MetricEntry[] = [
    {
        term: "Graham Number",
        hint: "Intrinsic value ceiling",
        def: "Benjamin Graham's formula for the maximum price a defensive investor should pay. If the live price is well below this number, the stock is statistically undervalued on fundamentals alone.",
        formula: "√(22.5 × EPS × NAV)",
        verdicts: [
            {
                tone: "buy",
                label: "BUY · SQURPHARMA",
                detail: "EPS ৳27.04 · NAV ৳157.88 → Graham ≈ ৳310. LTP ৳210 sits ৳100 below the ceiling — textbook value setup.",
            },
            {
                tone: "hold",
                label: "HOLD · RENATA",
                detail: "EPS ৳50 · NAV ৳350 → Graham ≈ ৳629. LTP ৳900 trades above Graham; quality earns the premium, but no margin for error.",
            },
            {
                tone: "exit",
                label: "TRIM · WALTONHIL",
                detail: "EPS ৳35 · NAV ৳420 → Graham ≈ ৳575. If LTP runs to ৳1,200 you're paying 2× the defensive ceiling — lock gains.",
            },
        ],
    },
    {
        term: "Margin of Safety",
        hint: "vs Graham Number",
        def: "How far below the Graham Number the price currently sits, as a percentage. Positive = undervalued cushion; +30 % is meaningful, +50 % is deep value. Negative means the market price exceeds Graham's ceiling.",
        formula: "(Graham − Price) ÷ Graham × 100",
        verdicts: [
            {
                tone: "buy",
                label: "BUY · BRACBANK",
                detail: "Graham ৳65 · LTP ৳38 → +42 % MoS. Sector tailwind + deep cushion = high-conviction add.",
            },
            {
                tone: "hold",
                label: "HOLD · SQURPHARMA",
                detail: "Graham ৳310 · LTP ৳280 → +10 % MoS. Cushion exists but thin — wait for ৳260 (≥ +16 %) before adding.",
            },
            {
                tone: "exit",
                label: "EXIT · BEXIMCO",
                detail: "Graham ৳80 · LTP ৳95 → −19 % MoS. Price already above Graham on weak fundamentals — Oracle gates this out.",
            },
        ],
    },
    {
        term: "Earnings Yield",
        hint: "BD risk-free ~9.5 %",
        def: "The inverse of P/E expressed as a yield. Compare against Bangladesh's ~9.5 % 10-year T-bill: stocks earning more than the risk-free rate are paying you to take equity risk.",
        formula: "EPS ÷ Price × 100",
        verdicts: [
            {
                tone: "buy",
                label: "BUY · SQURPHARMA",
                detail: "EPS ৳27 · LTP ৳210 → 12.9 % EY. ~3.4 ppt above the T-bill — equity premium is real.",
            },
            {
                tone: "hold",
                label: "HOLD · GP",
                detail: "EPS ৳24 · LTP ৳300 → 8.0 % EY. Below T-bill but rescued by ~7 % dividend — keep for income, don't add for value.",
            },
            {
                tone: "exit",
                label: "TRIM · UNILEVERCL",
                detail: "EPS ৳60 · LTP ৳2,700 → 2.2 % EY. Paying defensive multiples — better yields exist elsewhere.",
            },
        ],
    },
    {
        term: "Return on Equity",
        hint: "≥ 15 % = strong",
        def: "How efficiently the company turns one taka of shareholder equity into profit. Sustained ROE ≥ 15 % is the hallmark of a quality compounder; < 10 % is mediocre.",
        formula: "EPS ÷ NAV × 100",
        verdicts: [
            {
                tone: "buy",
                label: "BUY · BATBC",
                detail: "EPS ৳25 · NAV ৳80 → 31 % ROE. Capital-light compounder — even at a P/E of 18 the long-term math works.",
            },
            {
                tone: "hold",
                label: "HOLD · SQURPHARMA",
                detail: "EPS ৳27 · NAV ৳158 → 17 % ROE. Solidly above the 15 % bar — keep accumulating on dips.",
            },
            {
                tone: "exit",
                label: "AVOID · BEXIMCO",
                detail: "EPS ৳3 · NAV ৳85 → 3.5 % ROE. Capital trapped at sub-bond returns — Oracle filters this out.",
            },
        ],
    },
    {
        term: "Dividend Payout Ratio",
        hint: "< 75 % = sustainable",
        def: "Below 75 % means the company comfortably covers its dividend from earnings; above 100 % means it's paying out more than it earns (drawing from reserves — not sustainable).",
        formula: "DPS ÷ EPS × 100",
        verdicts: [
            {
                tone: "buy",
                label: "BUY · SQURPHARMA",
                detail: "DPS ৳5 · EPS ৳27 → 19 % payout. Massive reinvestment runway — dividend can only grow.",
            },
            {
                tone: "hold",
                label: "HOLD · BATBC",
                detail: "DPS ৳18 · EPS ৳25 → 72 % payout. Right at the sustainable edge — fine if EPS keeps growing.",
            },
            {
                tone: "exit",
                label: "TRIM · GP",
                detail: "DPS ৳28 · EPS ৳24 → 117 % payout. Borrowing from reserves to keep the yield — a cut is a question of when, not if.",
            },
        ],
    },
    {
        term: "Drawdown from Peak",
        hint: "Entry timing signal",
        def: "Always ≤ 0. A 15–25 % pullback on a quality stock is often a healthy buy zone. > 40 % may signal genuine distress, not opportunity.",
        formula: "(Price − 52W High) ÷ 52W High × 100",
        verdicts: [
            {
                tone: "buy",
                label: "BUY · RENATA",
                detail: "High ৳1,200 · LTP ৳900 → −25 %. Quality compounder on textbook pullback — staggered entry zone.",
            },
            {
                tone: "hold",
                label: "WAIT · SQURPHARMA",
                detail: "High ৳240 · LTP ৳210 → −12.5 %. Mild dip only — wait for −20 % (~৳192) for a meatier entry.",
            },
            {
                tone: "exit",
                label: "AVOID · BEXIMCO",
                detail: "High ৳270 · LTP ৳90 → −67 %. Falling-knife territory — distress, not discount.",
            },
        ],
    },
    {
        term: "Recovery from Low",
        hint: "Off 52-week trough",
        def: "Tells you how much the stock has already bounced. Low recovery + high quality score = early in the turnaround; high recovery may mean you're late.",
        formula: "(Price − 52W Low) ÷ 52W Low × 100",
        verdicts: [
            {
                tone: "buy",
                label: "BUY · BRACBANK",
                detail: "Low ৳35 · LTP ৳38 → +8 %. High Oracle score plus only modest bounce — early-innings turnaround.",
            },
            {
                tone: "hold",
                label: "HOLD · LHBL",
                detail: "Low ৳60 · LTP ৳78 → +30 %. Already off the floor — fine to hold, riskier to chase.",
            },
            {
                tone: "exit",
                label: "WAIT · UNILEVERCL",
                detail: "Low ৳2,000 · LTP ৳2,700 → +35 %. Most of the rebound is behind you — wait for a pullback before fresh buys.",
            },
        ],
    },
];

export default function KnowledgePage() {
    return (
        <AppPageStack gapClass="gap-4 sm:gap-5" className="mx-auto w-full min-w-0 max-w-3xl text-left text-[var(--ink-strong)]">
            <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface-soft)] px-4 py-4 sm:px-5 sm:py-5">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">
                    Knowledge — Advanced metrics explained
                </p>
                <p className="mb-1 text-[14px] leading-relaxed text-[var(--ink-default)]">
                    These advanced fundamentals are computed from DSE-published EPS, NAV, and
                    52-week price data — values most retail screeners don&apos;t expose directly.
                </p>
                <p className="text-[12px] leading-relaxed text-[var(--ink-muted)]">
                    Examples below use illustrative DSE tickers and round numbers to anchor the
                    thresholds. Always verify with the latest filings before acting.
                </p>
            </section>

            <div className="flex flex-col gap-3 sm:gap-4">
                {METRICS.map((m) => (
                    <article
                        key={m.term}
                        className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] px-4 py-4 shadow-sm sm:px-5 sm:py-5"
                    >
                        <header className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <h2 className="text-[15px] font-semibold text-[var(--ink-strong)]">{m.term}</h2>
                            <span className="text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">{m.hint}</span>
                            <span className="ml-auto rounded-md border border-[var(--line)] bg-[var(--bg-surface-soft)] px-2 py-0.5 font-mono text-[11px] text-[var(--ink-muted)]">
                                {m.formula}
                            </span>
                        </header>
                        <p className="mb-3 text-[13.5px] leading-relaxed text-[var(--ink-default)]">{m.def}</p>
                        <ul className="flex flex-col gap-2">
                            {m.verdicts.map((v) => {
                                const cfg =
                                    v.tone === "buy"
                                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                        : v.tone === "hold"
                                            ? "border-amber-300 bg-amber-50 text-amber-800"
                                            : "border-red-300 bg-red-50 text-red-800";
                                return (
                                    <li
                                        key={v.label}
                                        className="rounded-lg border border-[var(--line)] bg-[var(--bg-surface-soft)] px-3 py-2"
                                    >
                                        <div className="mb-1 flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg}`}>
                                                {v.label}
                                            </span>
                                        </div>
                                        <p className="text-[12.5px] leading-relaxed text-[var(--ink-default)]">{v.detail}</p>
                                    </li>
                                );
                            })}
                        </ul>
                    </article>
                ))}
            </div>

            <p className="text-[11px] leading-relaxed text-[var(--ink-muted)]">
                Illustrative only — figures above are rounded for teaching purposes and
                may not match current EPS/NAV filings. Not investment advice.
            </p>
        </AppPageStack>
    );
}
