"use client";

import type { PortfolioMarketRow } from "@/lib/market/portfolio-with-quotes";
import { Alert } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PortfolioHoldingsTable } from "@/components/portfolio/portfolio-holdings-table";

function pollIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_PORTFOLIO_POLL_MS;
  if (!raw) return 45_000;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 15_000) return 45_000;
  return Math.min(n, 120_000);
}

type PortfolioMarketApi = {
  updatedAt: string;
  lspError: string | null;
  holdings: PortfolioMarketRow[];
};

export function PortfolioLiveShell({
  initialHoldings,
  initialMarketError,
}: {
  initialHoldings: PortfolioMarketRow[];
  initialMarketError: string | null;
}) {
  const [rows, setRows] = useState(initialHoldings);
  const [liveLspError, setLiveLspError] = useState<string | null>(null);
  const [hasPolled, setHasPolled] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const initialKey = useMemo(
    () =>
      initialHoldings
        .map(
          (h) =>
            `${h.symbol}:${Number(h.shares.toFixed(4))}:${Number(h.avgPrice.toFixed(4))}:${Number(h.totalCost.toFixed(2))}:${h.marketLtp ?? ""}`,
        )
        .join("|"),
    [initialHoldings],
  );

  const prevInitialKey = useRef<string | null>(null);
  useEffect(() => {
    if (prevInitialKey.current === initialKey) return;
    prevInitialKey.current = initialKey;
    setRows(initialHoldings);
  }, [initialKey, initialHoldings]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/portfolio-market", { cache: "no-store" });
      if (res.status === 401) return;
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setLiveLspError(j.error ?? `HTTP ${res.status}`);
        setHasPolled(true);
        return;
      }
      const data = (await res.json()) as PortfolioMarketApi;
      setLiveLspError(data.lspError);
      setHasPolled(true);
      setUpdatedAt(new Date(data.updatedAt));
      if (Array.isArray(data.holdings)) {
        setRows(data.holdings);
      }
    } catch (e) {
      setLiveLspError(e instanceof Error ? e.message : "Refresh failed");
      setHasPolled(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ms = pollIntervalMs();
    const run = () => {
      if (!cancelled) void refresh();
    };
    const t = window.setTimeout(run, 2_000);
    const id = window.setInterval(run, ms);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      window.clearInterval(id);
    };
  }, [refresh]);

  const marketWarning = liveLspError ?? (!hasPolled ? initialMarketError : null);

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <div className="flex flex-wrap items-center justify-start gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-teal-200/60 bg-white/80 px-4 py-2 text-[15px] font-normal text-teal-900 shadow-sm backdrop-blur-sm dark:border-teal-800/50 dark:bg-zinc-900/80 dark:text-teal-100">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
          </span>
          {updatedAt
            ? `Live prices · ${updatedAt.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}`
            : "Connecting to live prices…"}
        </span>
      </div>

      <PortfolioHoldingsTable
        holdings={rows}
        enableBookEdit
        onAfterBookSave={refresh}
      />

      {marketWarning ? (
        <div className="overflow-hidden rounded-2xl ring-1 ring-amber-500/20">
          <Alert
            type="warning"
            showIcon
            title="Could not load or refresh DSE price table"
            description={marketWarning}
            className="border-amber-200/60 bg-amber-50/90 dark:border-amber-900/40 dark:bg-amber-950/40"
          />
        </div>
      ) : null}
    </div>
  );
}
