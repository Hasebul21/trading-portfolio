"use client";

import { PortfolioHoldingsTable } from "@/components/portfolio/portfolio-holdings-table";
import type { PortfolioMarketRow } from "@/lib/market/portfolio-with-quotes";
import { Alert } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function pollIntervalMs(): number {
 const raw = process.env.NEXT_PUBLIC_PORTFOLIO_POLL_MS;
 if (!raw) return 5_000;
 const n = Number.parseInt(raw, 10);
 if (!Number.isFinite(n) || n < 5_000) return 5_000;
 return Math.min(n, 120_000);
}

type PortfolioMarketApi = {
 updatedAt: string;
 lspError: string | null;
 holdings: PortfolioMarketRow[];
 totalRealizedBdt: number;
 totalInvestedBdt: number;
 totalCashAdjustmentsBdt: number;
 totalCashDividendsBdt: number;
};

export function PortfolioLiveShell({
 initialHoldings,
 initialMarketError,
 initialTotalRealizedBdt,
 initialTotalInvestedBdt,
 initialTotalCashAdjustmentsBdt,
 initialTotalCashDividendsBdt,
 sectorTargetsByKey,
 sellPlanSymbols,
}: {
 initialHoldings: PortfolioMarketRow[];
 initialMarketError: string | null;
 initialTotalRealizedBdt: number;
 initialTotalInvestedBdt: number;
 initialTotalCashAdjustmentsBdt: number;
 initialTotalCashDividendsBdt: number;
 sectorTargetsByKey: Record<string, number>;
 sellPlanSymbols: string[];
}) {
 const [rows, setRows] = useState(initialHoldings);
 const [totalRealizedBdt, setTotalRealizedBdt] = useState(initialTotalRealizedBdt);
 const [totalInvestedBdt, setTotalInvestedBdt] = useState(initialTotalInvestedBdt);
 const [totalCashAdjustmentsBdt, setTotalCashAdjustmentsBdt] = useState(
 initialTotalCashAdjustmentsBdt,
 );
 const [totalCashDividendsBdt, setTotalCashDividendsBdt] = useState(
 initialTotalCashDividendsBdt,
 );
 const [liveLspError, setLiveLspError] = useState<string | null>(null);
 const [hasPolled, setHasPolled] = useState(false);
 const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
 const [refreshing, setRefreshing] = useState(false);

 const initialKey = useMemo(
 () =>
 `${initialHoldings
 .map(
 (h) =>
 `${h.symbol}:${h.sector ?? ""}:${Number(h.shares.toFixed(4))}:${Number(h.avgPrice.toFixed(4))}:${Number(h.totalCost.toFixed(2))}:${h.marketLtp ?? ""}`,
 )
 .join("|")}|realized:${initialTotalRealizedBdt}|invested:${initialTotalInvestedBdt}|cash:${initialTotalCashAdjustmentsBdt}|div:${initialTotalCashDividendsBdt}`,
 [
 initialHoldings,
 initialTotalRealizedBdt,
 initialTotalInvestedBdt,
 initialTotalCashAdjustmentsBdt,
 initialTotalCashDividendsBdt,
 ],
 );

 const prevInitialKey = useRef<string | null>(null);
 useEffect(() => {
 if (prevInitialKey.current === initialKey) return;
 prevInitialKey.current = initialKey;
 setRows(initialHoldings);
 setTotalRealizedBdt(initialTotalRealizedBdt);
 setTotalInvestedBdt(initialTotalInvestedBdt);
 setTotalCashAdjustmentsBdt(initialTotalCashAdjustmentsBdt);
 setTotalCashDividendsBdt(initialTotalCashDividendsBdt);
 }, [
 initialKey,
 initialHoldings,
 initialTotalRealizedBdt,
 initialTotalInvestedBdt,
 initialTotalCashAdjustmentsBdt,
 initialTotalCashDividendsBdt,
 ]);

 const refresh = useCallback(async () => {
 setRefreshing(true);
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
 if (typeof data.totalRealizedBdt === "number" && Number.isFinite(data.totalRealizedBdt)) {
 setTotalRealizedBdt(data.totalRealizedBdt);
 }
 if (typeof data.totalInvestedBdt === "number" && Number.isFinite(data.totalInvestedBdt)) {
 setTotalInvestedBdt(data.totalInvestedBdt);
 }
 if (
 typeof data.totalCashAdjustmentsBdt === "number" &&
 Number.isFinite(data.totalCashAdjustmentsBdt)
 ) {
 setTotalCashAdjustmentsBdt(data.totalCashAdjustmentsBdt);
 }
 if (
 typeof data.totalCashDividendsBdt === "number" &&
 Number.isFinite(data.totalCashDividendsBdt)
 ) {
 setTotalCashDividendsBdt(data.totalCashDividendsBdt);
 }
 } catch (e) {
 setLiveLspError(e instanceof Error ? e.message : "Refresh failed");
 setHasPolled(true);
 } finally {
 setRefreshing(false);
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
 <div className="flex flex-col gap-3 sm:gap-4">
 <div className="flex items-center justify-end gap-2">
 <span
 className="inline-flex items-center gap-1.5 text-[11px] leading-none text-[var(--ink-muted)] tabular-nums"
 title={updatedAt ? "Live DSE prices" : "Connecting to live prices…"}
 >
 <span className="relative flex h-1.5 w-1.5">
 <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
 <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent-700)]" />
 </span>
 {updatedAt
 ? `Live · ${updatedAt.toLocaleTimeString(undefined, {
 hour: "2-digit",
 minute: "2-digit",
 second: "2-digit",
 })}`
 : "Connecting…"}
 </span>
 <button
 type="button"
 onClick={() => void refresh()}
 disabled={refreshing}
 title="Refresh live prices"
 aria-label="Refresh live prices"
 className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--ink-muted)] ring-1 ring-[var(--line)] transition hover:bg-[var(--surface-2)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
 >
 <svg
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 className={`h-3.5 w-3.5${refreshing ? " animate-spin" : ""}`}
 aria-hidden="true"
 >
 <path d="M21 12a9 9 0 1 1-2.64-6.36" />
 <path d="M21 3v6h-6" />
 </svg>
 </button>
 </div>

 <PortfolioHoldingsTable
 holdings={rows}
 totalRealizedBdt={totalRealizedBdt}
 totalInvestedBdt={totalInvestedBdt}
 totalCashAdjustmentsBdt={totalCashAdjustmentsBdt}
 totalCashDividendsBdt={totalCashDividendsBdt}
 sectorTargetsByKey={sectorTargetsByKey}
 sellPlanSymbols={sellPlanSymbols}
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
 className="border-[var(--warn-200)] bg-[var(--warn-50)] "
 />
 </div>
 ) : null}
 </div>
 );
}
