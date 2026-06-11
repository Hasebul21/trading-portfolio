"use client";

import { formatBdt, formatPlainNumberMax2Decimals } from "@/lib/format-bdt";
import { useMemo } from "react";
import type { DividendRow } from "../dividend-actions";
import { Icons, SCard, SCardBody, SCardHead, SErr } from "./settings-ui";

type SummaryRow = { symbol: string; cash: number; shares: number; payouts: number };

export function DividendSummary({
  rows,
  totalCash,
  totalStockShares,
  error,
}: {
  rows: DividendRow[];
  totalCash: number;
  totalStockShares: number;
  error: string | null;
}) {
  const summary = useMemo<SummaryRow[]>(() => {
    const map = new Map<string, SummaryRow>();
    for (const r of rows) {
      const e = map.get(r.symbol) ?? { symbol: r.symbol, cash: 0, shares: 0, payouts: 0 };
      e.cash += r.cash_dividend_bdt;
      e.shares += r.stock_dividend_shares;
      e.payouts += 1;
      map.set(r.symbol, e);
    }
    return [...map.values()]
      .map((e) => ({
        ...e,
        cash: Math.round(e.cash * 100) / 100,
        shares: Math.round(e.shares * 10000) / 10000,
      }))
      .sort((a, b) => b.cash - a.cash || b.shares - a.shares || a.symbol.localeCompare(b.symbol));
  }, [rows]);

  return (
    <SCard>
      <SCardHead
        tone="gain"
        icon={Icons.dividend()}
        title="Dividend summary"
        right={
          <span className="total">
            Total cash: <b className="ok">+৳{formatBdt(totalCash)}</b>
            {totalStockShares > 0 ? (
              <>
                {" · "}Bonus shares:{" "}
                <b style={{ color: "var(--ink-strong)" }}>+{formatPlainNumberMax2Decimals(totalStockShares)}</b>
              </>
            ) : null}
          </span>
        }
      />
      <SCardBody>
        {error ? <SErr>{error}</SErr> : null}
        <table className="tbl">
          <thead>
            <tr>
              <th>Stock</th>
              <th className="r">Cash dividend</th>
              <th className="r">Stock dividend (shares)</th>
              <th className="r">Payouts</th>
            </tr>
          </thead>
          <tbody>
            {summary.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="empty-row">No dividends recorded yet.</div>
                </td>
              </tr>
            ) : null}
            {summary.map((r) => (
              <tr key={r.symbol}>
                <td>
                  <span className="sym">{r.symbol}</span>
                </td>
                <td className="td-r mono" style={{ color: r.cash > 0 ? "var(--gain-700)" : "var(--ink-muted)" }}>
                  {r.cash > 0 ? `+৳${formatBdt(r.cash)}` : "—"}
                </td>
                <td className="td-r mono" style={{ color: "var(--ink-strong)" }}>
                  {r.shares > 0 ? `+${formatPlainNumberMax2Decimals(r.shares)}` : "—"}
                </td>
                <td className="td-r mono" style={{ color: "var(--ink-muted)" }}>
                  {r.payouts}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SCardBody>
    </SCard>
  );
}
