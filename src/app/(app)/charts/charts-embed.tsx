"use client";

import { Button, Input } from "antd";
import { useCallback, useMemo, useState } from "react";

/** TradingView DSE listing prefix (Dhaka Stock Exchange on TradingView). */
function tradingViewSymbol(dseCode: string): string {
  const raw = dseCode.trim().toUpperCase().replace(/[()\s]/g, "");
  if (!raw) return "DSEBD:GP";
  return `DSEBD:${raw}`;
}

export function ChartsEmbed() {
  const [input, setInput] = useState("BATBC");
  const [active, setActive] = useState("BATBC");

  const tvSymbol = useMemo(() => tradingViewSymbol(active), [active]);

  const src = useMemo(() => {
    const params = new URLSearchParams({
      frameElementId: "tv-chart-embed",
      symbol: tvSymbol,
      interval: "W",
      symboledit: "1",
      saveimage: "0",
      toolbarbg: "f1f3f6",
      studies: "[]",
      theme: "light",
      style: "1",
      timezone: "Asia/Dhaka",
      locale: "en",
      hideideas: "1",
    });
    return `https://www.tradingview.com/widgetembed/?${params.toString()}`;
  }, [tvSymbol]);

  const load = useCallback(() => {
    setActive(input.trim() || "GP");
  }, [input]);

  return (
    <div className="flex flex-col gap-4 text-left">
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Free chart via{" "}
        <a
          href="https://www.tradingview.com/"
          className="font-medium text-teal-800 underline dark:text-teal-300"
          target="_blank"
          rel="noopener noreferrer"
        >
          TradingView
        </a>{" "}
        embed (DSE symbols use the <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">DSEBD:</code> prefix). Range
        defaults to weekly over several years; use the chart toolbar to adjust. If a code fails, try the spelling used on
        TradingView (often no parentheses).
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[8rem] flex-1 sm:max-w-xs">
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">DSE trading code</label>
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
      <div className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <iframe
          key={src}
          title={`TradingView chart ${tvSymbol}`}
          src={src}
          className="h-[min(70vh,640px)] w-full border-0"
          allow="clipboard-write; fullscreen"
        />
      </div>
    </div>
  );
}
