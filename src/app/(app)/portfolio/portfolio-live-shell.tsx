"use client";

import type { PortfolioMarketRow } from "@/lib/market/portfolio-with-quotes";
import type { FloorPivot } from "@/lib/pivot-floor";
import { PortfolioColumnNotesEditor } from "@/components/portfolio/portfolio-column-notes-editor";
import { Alert, Typography } from "antd";
import { useCallback, useEffect, useState } from "react";
import { PortfolioHoldingsTable } from "@/components/portfolio/portfolio-holdings-table";

function pollIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_PORTFOLIO_POLL_MS;
  if (!raw) return 45_000;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 15_000) return 45_000;
  return Math.min(n, 120_000);
}

function mergeQuote(
  row: PortfolioMarketRow,
  q: { marketLtp: number | null; pivot: FloorPivot | null } | undefined,
): PortfolioMarketRow {
  if (!q) return row;
  const { marketLtp, pivot } = q;
  const unrealizedPl =
    marketLtp !== null && Number.isFinite(marketLtp)
      ? (marketLtp - row.avgPrice) * row.shares
      : null;
  return { ...row, marketLtp, pivot, unrealizedPl };
}

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
      const data = (await res.json()) as {
        updatedAt: string;
        quotes: Record<string, { marketLtp: number | null; pivot: FloorPivot | null }>;
        lspError: string | null;
      };
      setLiveLspError(data.lspError);
      setHasPolled(true);
      setUpdatedAt(new Date(data.updatedAt));
      setRows((prev) => prev.map((r) => mergeQuote(r, data.quotes[r.symbol])));
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
    <div className="space-y-6">
      <PortfolioColumnNotesEditor />

      {marketWarning ? (
        <Alert
          type="warning"
          showIcon
          title="Could not load or refresh DSE price table"
          description={marketWarning}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Typography.Text type="secondary" className="text-sm">
          {updatedAt
            ? `Market prices last updated: ${updatedAt.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}`
            : "Fetching fresh prices shortly…"}
        </Typography.Text>
      </div>

      <PortfolioHoldingsTable holdings={rows} />
    </div>
  );
}
