"use client";

const TOPICS: {
  n: string;
  title: string;
  simple: string;
  affects: string;
}[] = [
    {
      n: "1",
      title: "ROE (Return on Equity)",
      simple:
        "This measures how much profit a company generates with the money shareholders have invested. If you give a company $100 and they make $20 in profit, the ROE is 20%.",
      affects:
        'A high ROE means the management is "money-smart." They are efficient at turning your investment into more profit without needing to borrow massive amounts of debt.',
    },
    {
      n: "2",
      title: "NAVPS (Net Asset Value Per Share)",
      simple:
        "Imagine the company closed down today, sold every desk, building, and computer, paid off all its debts, and divided the leftover cash among shareholders. That leftover cash per share is the NAVPS.",
      affects:
        "It acts as a safety floor. If a stock's market price is much lower than its NAVPS, it might be a bargain because the company is selling for less than the value of its physical parts.",
    },
    {
      n: "3",
      title: "EPS (Earnings Per Share)",
      simple:
        "This is the portion of a company's profit allocated to each individual share of stock. If a company makes $1,000 profit and has 1,000 shares, the EPS is $1.",
      affects:
        'This is the most watched number in the stock market. Generally, when EPS goes up, the stock price eventually follows. It tells you exactly how much "earning power" your single share holds.',
    },
    {
      n: "4",
      title: "P/E Ratio (Price-to-Earnings)",
      simple:
        "This tells you how much investors are willing to pay today for $1 of the company's earnings. If the P/E is 15, you are paying $15 for every $1 the company earns.",
      affects:
        'It tells you if a stock is "expensive" or "cheap." High P/E: investors expect massive growth in the future, so they pay a premium now. Low P/E: the stock might be undervalued, or investors are worried about the company\'s future.',
    },
    {
      n: "5",
      title: "Dividend Yield",
      simple:
        "Think of this like the interest rate on a savings account, but for a stock. It is the percentage of the stock price the company pays back to you in cash every year.",
      affects:
        'This is your "passive income." If a stock costs $100 and has a 5% yield, you get $5 in cash per year just for owning it, regardless of whether the stock price goes up or down.',
    },
  ];

export function FundamentalsCompact() {
  return (
    <div className="space-y-3">
      {TOPICS.map((t) => (
        <article
          key={t.n}
          className="rounded-xl border border-zinc-200/80 bg-white/80 px-3 py-3 shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900/55 sm:px-4"
        >
          <h3 className="text-[15px] font-normal leading-snug text-teal-800 dark:text-teal-200">
            {t.n}. {t.title}
          </h3>
          <p className="mt-2 text-[15px] font-normal leading-relaxed text-zinc-50">
            <span className="text-teal-800 dark:text-teal-200">The simple version: </span>
            {t.simple}
          </p>
          <p className="mt-2 text-[15px] font-normal leading-relaxed text-zinc-50">
            <span className="text-teal-800 dark:text-teal-200">How it affects you: </span>
            {t.affects}
          </p>
        </article>
      ))}
    </div>
  );
}
