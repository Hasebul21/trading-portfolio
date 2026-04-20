"use client";

type Tone =
  | "buy"
  | "sell"
  | "wait"
  | "check"
  | "strategy"
  | "avoid"
  | "insight"
  | "rule"
  | "caution";

const TONE: Record<
  Tone,
  string
> = {
  buy: "bg-emerald-500/15 text-emerald-900 ring-1 ring-emerald-500/30 dark:bg-emerald-400/12 dark:text-emerald-100 dark:ring-emerald-400/25",
  sell: "bg-rose-500/15 text-rose-900 ring-1 ring-rose-500/30 dark:bg-rose-400/12 dark:text-rose-100 dark:ring-rose-400/25",
  wait: "bg-amber-500/15 text-amber-950 ring-1 ring-amber-500/30 dark:bg-amber-400/12 dark:text-amber-100 dark:ring-amber-400/25",
  check: "bg-sky-500/15 text-sky-950 ring-1 ring-sky-500/30 dark:bg-sky-400/12 dark:text-sky-100 dark:ring-sky-400/25",
  strategy: "bg-violet-500/15 text-violet-950 ring-1 ring-violet-500/30 dark:bg-violet-400/12 dark:text-violet-100 dark:ring-violet-400/25",
  avoid: "bg-orange-500/15 text-orange-950 ring-1 ring-orange-500/30 dark:bg-orange-400/12 dark:text-orange-100 dark:ring-orange-400/25",
  insight: "bg-indigo-500/15 text-indigo-950 ring-1 ring-indigo-500/30 dark:bg-indigo-400/12 dark:text-indigo-100 dark:ring-indigo-400/25",
  rule: "bg-zinc-500/15 text-zinc-900 ring-1 ring-zinc-500/25 dark:bg-zinc-400/10 dark:text-zinc-100 dark:ring-zinc-500/30",
  caution: "bg-orange-600/15 text-orange-950 ring-1 ring-orange-600/35 dark:bg-orange-500/12 dark:text-orange-100 dark:ring-orange-500/30",
};

function RuleLine({ tone, label, text }: { tone: Tone; label: string; text: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200/60 bg-white/50 p-3.5 sm:flex-row sm:items-start sm:gap-4 dark:border-zinc-700/50 dark:bg-zinc-950/40">
      <span
        className={`shrink-0 self-start rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${TONE[tone]}`}
      >
        {label}
      </span>
      <p className="min-w-0 flex-1 text-left text-[14px] leading-relaxed text-zinc-700 dark:text-zinc-300">
        {text}
      </p>
    </div>
  );
}

function PlaybookSection({
  title,
  subtitle,
  rules,
}: {
  title: string;
  subtitle?: string;
  rules: { tone: Tone; label: string; text: string }[];
}) {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-teal-200/45 bg-gradient-to-b from-white/95 to-teal-50/30 shadow-md shadow-teal-950/[0.04] ring-1 ring-teal-500/[0.07] backdrop-blur-sm dark:border-teal-900/35 dark:from-zinc-900/90 dark:to-teal-950/25 dark:shadow-black/25 dark:ring-teal-500/10">
      <div className="border-b border-teal-200/40 bg-gradient-to-r from-teal-600/10 via-emerald-600/5 to-transparent px-4 py-3.5 dark:border-teal-800/40 dark:from-teal-500/10">
        <h3 className="text-left text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-1 text-left text-xs font-medium text-teal-800/80 dark:text-teal-200/80">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {rules.map((r) => (
          <RuleLine key={r.label} tone={r.tone} label={r.label} text={r.text} />
        ))}
      </div>
    </section>
  );
}

export function PortfolioTradingPlaybook() {
  return (
    <div className="grid gap-6 sm:gap-8 md:grid-cols-2">
        <PlaybookSection
          title="Last price (DSE)"
          subtitle="Live last traded price from the exchange snapshot"
          rules={[
            {
              tone: "buy",
              label: "Buy",
              text: "When the last price is moving up with strength — especially above the session midpoint or breaking upside targets with conviction.",
            },
            {
              tone: "sell",
              label: "Sell",
              text: "When price drops below key levels you care about, or you have reached your target profit and want to lock it in.",
            },
            {
              tone: "check",
              label: "Check",
              text: "Always compare with your average cost before acting so you know if you are green, red, or adding risk.",
            },
          ]}
        />

        <PlaybookSection
          title="Session midpoint (pivot)"
          subtitle="Intraday balance level from the same DSE row"
          rules={[
            {
              tone: "buy",
              label: "Buy",
              text: "If price stays above the pivot and holds — the session is often showing relative strength.",
            },
            {
              tone: "sell",
              label: "Sell · avoid buys",
              text: "If price stays below the pivot — weakness tends to dominate; be careful chasing longs.",
            },
            {
              tone: "wait",
              label: "Wait",
              text: "If price chops around the pivot — direction is unclear; let the market pick a side first.",
            },
          ]}
        />

        <PlaybookSection
          title="Downside targets (support)"
          subtitle="First & second downside targets in the table"
          rules={[
            {
              tone: "buy",
              label: "Buy",
              text: "Near support only if price shows signs of bouncing — not only because the number is there.",
            },
            {
              tone: "sell",
              label: "Sell · cut loss",
              text: "If support breaks strongly — more downside is likely; protect capital per your rules.",
            },
            {
              tone: "strategy",
              label: "Strategy",
              text: "First target often marks a shallow reaction; the second can be a deeper bounce zone if buyers return.",
            },
          ]}
        />

        <PlaybookSection
          title="Upside targets (resistance)"
          subtitle="First & second upside targets in the table"
          rules={[
            {
              tone: "sell",
              label: "Sell · take profit",
              text: "Near resistance zones is a natural place to trim or take profit if your plan says so.",
            },
            {
              tone: "buy",
              label: "Buy",
              text: "Only if price breaks resistance with strong momentum — continuation setups, not guesses.",
            },
            {
              tone: "avoid",
              label: "Avoid",
              text: "Buying just below resistance is often poor risk-reward unless you have a clear breakout plan.",
            },
          ]}
        />

        <PlaybookSection
          title="52-week high / low"
          subtitle="Context from the yearly range (not shown as columns here)"
          rules={[
            {
              tone: "buy",
              label: "Buy",
              text: "Near yearly lows only if real recovery signs show up — never blindly because it looks cheap.",
            },
            {
              tone: "caution",
              label: "Sell · caution",
              text: "Near yearly highs, if momentum slows, be cautious about new buys — pullback risk rises.",
            },
            {
              tone: "insight",
              label: "Insight",
              text: "Highs often mean strength plus elevated risk; lows can mean weakness plus potential opportunity — context only.",
            },
          ]}
        />

        <PlaybookSection
          title="Average cost per share"
          subtitle="Includes commission you logged on buys"
          rules={[
            {
              tone: "buy",
              label: "Buy more",
              text: "If price is near support and below your average, averaging down can make sense only if you size it carefully and accept the risk.",
            },
            {
              tone: "sell",
              label: "Sell",
              text: "When price is above your average and near resistance, taking some profit can match a disciplined exit plan.",
            },
            {
              tone: "rule",
              label: "Rule",
              text: "Always know your average cost before any decision — it is your anchor for P/L and sizing.",
            },
          ]}
        />
    </div>
  );
}
