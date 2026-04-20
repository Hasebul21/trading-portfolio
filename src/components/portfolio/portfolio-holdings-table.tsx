"use client";

import { formatBdt } from "@/lib/format-bdt";
import { tablePagination } from "@/lib/table-pagination";
import type { PortfolioMarketRow } from "@/lib/market/portfolio-with-quotes";
import { Card, Input, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

type Row = PortfolioMarketRow & { key: string };

const { Search } = Input;

function fmtSignedBdt(n: number) {
  const s = formatBdt(Math.abs(n));
  if (n > 0) return `+${s}`;
  if (n < 0) return `-${s}`;
  return s;
}

function unrealizedTotals(holdings: PortfolioMarketRow[]) {
  let sum = 0;
  let withQuote = 0;
  for (const h of holdings) {
    const pl = h.unrealizedPl;
    if (pl !== null && Number.isFinite(pl)) {
      sum += pl;
      withQuote += 1;
    }
  }
  return { sum, withQuote, positions: holdings.length };
}

function sumTotalInvested(holdings: PortfolioMarketRow[]) {
  let s = 0;
  for (const h of holdings) {
    if (Number.isFinite(h.totalCost)) s += h.totalCost;
  }
  return s;
}

function fmtPivotCell(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) {
    return <Typography.Text type="secondary">—</Typography.Text>;
  }
  return (
    <span className="tabular-nums">
      {n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  );
}

export function PortfolioHoldingsTable({ holdings }: { holdings: PortfolioMarketRow[] }) {
  const [symbolQuery, setSymbolQuery] = useState("");

  const { sum: totalUnrealized, withQuote, positions } = unrealizedTotals(holdings);
  const totalInvested = sumTotalInvested(holdings);

  const data: Row[] = useMemo(() => {
    const q = symbolQuery.trim().toUpperCase();
    return holdings
      .filter((h) => !q || h.symbol.toUpperCase().includes(q))
      .map((h) => ({ ...h, key: h.symbol }));
  }, [holdings, symbolQuery]);

  const columns: ColumnsType<Row> = [
    {
      title: "Symbol",
      dataIndex: "symbol",
      width: 88,
      align: "left",
      render: (v: string) => (
        <span className="bg-gradient-to-r from-teal-700 via-emerald-700 to-teal-800 bg-clip-text font-mono text-[15px] font-bold text-transparent dark:from-teal-300 dark:via-emerald-300 dark:to-teal-200">
          {v}
        </span>
      ),
    },
    {
      title: "Average cost / share",
      key: "avgPrice",
      width: 128,
      align: "right",
      render: (_: unknown, row) => (
        <span className="tabular-nums text-[14px] font-medium">{formatBdt(row.avgPrice)}</span>
      ),
    },
    {
      title: "Shares",
      dataIndex: "shares",
      width: 80,
      align: "right",
      render: (v: number) => (
        <span className="tabular-nums text-[14px]">
          {v.toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </span>
      ),
    },
    {
      title: "Total invested",
      dataIndex: "totalCost",
      width: 112,
      align: "right",
      sorter: (a, b) => a.totalCost - b.totalCost,
      defaultSortOrder: "descend",
      showSorterTooltip: { title: "Sort by total invested" },
      render: (_: unknown, row) => (
        <span className="tabular-nums text-[14px]">{formatBdt(row.totalCost)}</span>
      ),
    },
    {
      title: "Unrealized P/L",
      dataIndex: "unrealizedPl",
      width: 118,
      align: "right",
      render: (v: number | null) =>
        v === null ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          <Typography.Text
            type={v >= 0 ? "success" : "danger"}
            className="tabular-nums text-[14px]"
          >
            {fmtSignedBdt(v)}
          </Typography.Text>
        ),
    },
    {
      title: "Last price (DSE)",
      dataIndex: "marketLtp",
      width: 118,
      align: "right",
      render: (v: number | null) =>
        v === null ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          <span className="tabular-nums text-[14px]">{formatBdt(v)}</span>
        ),
    },
    {
      title: "Session midpoint",
      key: "pivot",
      width: 108,
      align: "right",
      render: (_: unknown, row) => fmtPivotCell(row.pivot?.pivot ?? null),
    },
    {
      title: "First downside target",
      key: "s1",
      width: 118,
      align: "right",
      render: (_: unknown, row) => fmtPivotCell(row.pivot?.s1 ?? null),
    },
    {
      title: "Second downside target",
      key: "s2",
      width: 128,
      align: "right",
      render: (_: unknown, row) => fmtPivotCell(row.pivot?.s2 ?? null),
    },
    {
      title: "First upside target",
      key: "r1",
      width: 118,
      align: "right",
      render: (_: unknown, row) => fmtPivotCell(row.pivot?.r1 ?? null),
    },
    {
      title: "Second upside target",
      key: "r2",
      width: 128,
      align: "right",
      render: (_: unknown, row) => fmtPivotCell(row.pivot?.r2 ?? null),
    },
  ];

  return (
    <Card
      variant="outlined"
      className="w-full overflow-hidden rounded-2xl border border-teal-200/50 bg-white/75 shadow-xl shadow-teal-950/[0.07] ring-1 ring-black/[0.04] backdrop-blur-md dark:border-teal-900/35 dark:bg-zinc-900/65 dark:shadow-black/40 dark:ring-white/[0.06]"
      styles={{ body: { padding: 0 } }}
    >
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-teal-100/80 px-3 py-3 sm:gap-3 sm:px-4 dark:border-teal-900/40">
        <div className="min-w-[10.5rem] max-w-[13rem] flex-1 rounded-xl border border-teal-200/70 bg-teal-50/40 px-3 py-2 text-center shadow-sm dark:border-teal-800/50 dark:bg-teal-950/25">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Total unrealized P/L
          </div>
          <div className="mt-0.5 min-h-[1.25rem]">
            {withQuote === 0 ? (
              <Typography.Text type="secondary" className="text-[13px]">
                —
              </Typography.Text>
            ) : (
              <Typography.Text
                type={totalUnrealized >= 0 ? "success" : "danger"}
                className="text-[15px] font-semibold tabular-nums sm:text-base"
              >
                {fmtSignedBdt(totalUnrealized)}
              </Typography.Text>
            )}
          </div>
          {withQuote > 0 && withQuote < positions ? (
            <Typography.Text type="secondary" className="mt-0.5 block text-[10px] leading-tight">
              {withQuote}/{positions} with last price
            </Typography.Text>
          ) : null}
          {withQuote === 0 && positions > 0 ? (
            <Typography.Text type="secondary" className="mt-0.5 block text-[10px] leading-tight">
              Needs DSE last price
            </Typography.Text>
          ) : null}
        </div>

        <div className="min-w-[10.5rem] max-w-[13rem] flex-1 rounded-xl border border-teal-200/70 bg-teal-50/40 px-3 py-2 text-center shadow-sm dark:border-teal-800/50 dark:bg-teal-950/25">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Total invested
          </div>
          <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50 sm:text-base">
            {formatBdt(totalInvested)}
          </div>
        </div>
      </div>

      <div className="border-b border-teal-100/80 px-3 py-2 sm:px-4 dark:border-teal-900/40">
        <Search
          allowClear
          placeholder="Search symbol…"
          value={symbolQuery}
          onChange={(e) => setSymbolQuery(e.target.value)}
          className="max-w-sm"
          size="middle"
        />
      </div>

      <Table<Row>
        className="portfolio-holdings-table"
        columns={columns}
        dataSource={data}
        pagination={tablePagination("positions", { hideOnSinglePage: false })}
        size="middle"
        bordered={false}
        tableLayout="auto"
        locale={{
          emptyText: symbolQuery.trim() ? "No symbols match your search." : undefined,
        }}
      />
    </Card>
  );
}
