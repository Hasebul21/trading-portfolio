"use client";

import { siteTextLinkTealClass } from "@/lib/site-typography";
import { Button, Input } from "antd";
import { useCallback, useId, useMemo, useState } from "react";

/** TradingView DSE listing prefix (Dhaka Stock Exchange on TradingView). */
function tradingViewSymbol(dseCode: string): string {
  const raw = dseCode.trim().toUpperCase().replace(/[()\s]/g, "");
  if (!raw) return "DSEBD:GP";
  return `DSEBD:${raw}`;
}

/**
 * Iframe embed (no script injection) — avoids React Strict Mode / CSP / parser issues
 * that break the advanced-chart script widget. `tvwidgetsymbol` is the supported way
 * to set the symbol for this embed (see TradingView widget docs).
 */
function widgetEmbedSrc(tvSymbol: string, frameElementId: string): string {
  const q = new URLSearchParams({
    frameElementId,
    tvwidgetsymbol: tvSymbol,
    symbol: tvSymbol,
    interval: "W",
    locale: "en",
    symboledit: "1",
    hideideas: "1",
    style: "1",
    timezone: "Asia/Dhaka",
    toolbarbg: "f1f3f6",
  });
  return `https://www.tradingview.com/widgetembed/?${q.toString()}`;
}

export function ChartsEmbed() {
  const [input, setInput] = useState("BATBC");
  const [active, setActive] = useState("BATBC");
  const rawId = useId().replace(/:/g, "");

  const tvSymbol = useMemo(() => tradingViewSymbol(active), [active]);

  const iframeSrc = useMemo(
    () => widgetEmbedSrc(tvSymbol, `tv_chart_${rawId}`),
    [tvSymbol, rawId],
  );

  const load = useCallback(() => {
    setActive(input.trim() || "GP");
  }, [input]);

  return (
    <div className="flex flex-col gap-4 text-left">
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Free chart via{" "}
        <a
          href="https://www.tradingview.com/"
          className={siteTextLinkTealClass}
          target="_blank"
          rel="noopener noreferrer"
        >
          TradingView
        </a>{" "}
        chart embed (DSE symbols use the{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">DSEBD:</code> prefix). Use the chart search if a code
        does not resolve—spelling must match TradingView (often no parentheses).
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[8rem] flex-1 sm:max-w-xs">
          <label className="mb-1 block text-xs font-normal text-zinc-600 dark:text-zinc-400">DSE trading code</label>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={() => load()}
            placeholder="e.g. GP, BATBC"
            className="font-mono"
            size="large"
          />
        </div>
        <Button type="primary" size="large" onClick={load}>
          Load chart
        </Button>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Showing <span className="font-mono font-normal text-zinc-800 dark:text-zinc-200">{tvSymbol}</span>
      </p>
      <div className="h-[min(70vh,640px)] w-full overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <iframe
          key={iframeSrc}
          title={`TradingView chart ${tvSymbol}`}
          src={iframeSrc}
          className="h-full w-full border-0"
          allow="clipboard-write; fullscreen"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}
