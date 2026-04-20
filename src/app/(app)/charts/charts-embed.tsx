"use client";

import { Button, Input } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ADVANCED_CHART_SRC = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

/** TradingView DSE listing prefix (Dhaka Stock Exchange on TradingView). */
function tradingViewSymbol(dseCode: string): string {
  const raw = dseCode.trim().toUpperCase().replace(/[()\s]/g, "");
  if (!raw) return "DSEBD:GP";
  return `DSEBD:${raw}`;
}

export function ChartsEmbed() {
  const [input, setInput] = useState("BATBC");
  const [active, setActive] = useState("BATBC");
  const mountRef = useRef<HTMLDivElement>(null);

  const tvSymbol = useMemo(() => tradingViewSymbol(active), [active]);

  useEffect(() => {
    const root = mountRef.current;
    if (!root) return;

    root.innerHTML = "";

    const container = document.createElement("div");
    container.className = "tradingview-widget-container";
    container.style.height = "100%";
    container.style.width = "100%";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "calc(100% - 2px)";
    widget.style.width = "100%";

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = ADVANCED_CHART_SRC;
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: "W",
      timezone: "Asia/Dhaka",
      theme: "light",
      style: "1",
      locale: "en",
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    container.appendChild(widget);
    container.appendChild(script);
    root.appendChild(container);

    return () => {
      root.innerHTML = "";
    };
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
          className="font-normal text-teal-800 underline dark:text-teal-300"
          target="_blank"
          rel="noopener noreferrer"
        >
          TradingView
        </a>{" "}
        advanced chart widget (DSE symbols use the{" "}
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
        <div ref={mountRef} className="h-full w-full" />
      </div>
    </div>
  );
}
