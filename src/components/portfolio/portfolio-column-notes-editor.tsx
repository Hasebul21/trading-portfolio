"use client";

import { Button, Input, Typography } from "antd";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "trading_portfolio_column_notes_v1";

export const PORTFOLIO_COLUMN_NOTES_DEFAULT = `Last price (DSE) — The exchange’s latest traded price for this symbol. Use it to see where the market is versus your average cost and to size unrealized profit or loss.

Session midpoint (pivot) — A single “balance” level for the day. Price often reacts around it: holding above can favour strength; holding below can favour weakness. It helps you frame the day as above or below “fair” for that session.

First downside target / Second downside target — Zones where dips may slow or bounce. They help you plan where to watch for support if price falls, or where partial exits / adds might make sense in your own rules.

First upside target / Second upside target — Zones where rallies may slow or stall. They help you plan profit-taking or resistance for new buys, again according to your own plan.

52-week high / low — The stock’s range over about a year. It helps you see whether today’s price is near historic highs (often more risk / volatility) or lows (often more “beaten down” context), not a buy or sell signal by itself.

Average cost / share — Your loaded cost per share after buys, including commissions you entered on each buy. Unrealized P/L uses this number.`;

export function PortfolioColumnNotesEditor() {
  const [value, setValue] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      setValue(saved ?? PORTFOLIO_COLUMN_NOTES_DEFAULT);
    } catch {
      setValue(PORTFOLIO_COLUMN_NOTES_DEFAULT);
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: string) => {
    setValue(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode / quota */
    }
  }, []);

  const reset = useCallback(() => {
    persist(PORTFOLIO_COLUMN_NOTES_DEFAULT);
  }, [persist]);

  if (!hydrated) {
    return (
      <div className="min-h-[180px] rounded-lg border border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40" />
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Typography.Text className="text-base font-medium text-zinc-900 dark:text-zinc-100">
          Your notes on these columns
        </Typography.Text>
        <Button size="small" type="link" onClick={reset} className="text-zinc-600 dark:text-zinc-400">
          Reset to defaults
        </Button>
      </div>
      <Typography.Paragraph type="secondary" className="mb-3 text-center text-sm">
        Edit below — saved automatically in this browser.
      </Typography.Paragraph>
      <div className="text-left">
        <Input.TextArea
          value={value}
          onChange={(e) => persist(e.target.value)}
          autoSize={{ minRows: 10, maxRows: 22 }}
          className="text-[15px] leading-relaxed"
          placeholder="Write what each column means for you…"
        />
      </div>
    </div>
  );
}
