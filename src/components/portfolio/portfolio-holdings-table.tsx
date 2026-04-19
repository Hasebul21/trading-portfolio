"use client";

import { formatBdt } from "@/lib/format-bdt";
import type { PortfolioMarketRow } from "@/lib/market/portfolio-with-quotes";
import { Card, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";

type Row = PortfolioMarketRow & { key: string };

function fmtSignedBdt(n: number) {
  const s = formatBdt(Math.abs(n));
  if (n > 0) return `+${s}`;
  if (n < 0) return `-${s}`;
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
  const data: Row[] = holdings.map((h) => ({ ...h, key: h.symbol }));

  const columns: ColumnsType<Row> = [
    {
      title: "Symbol",
      dataIndex: "symbol",
      width: 88,
      align: "left",
      render: (v: string) => (
        <Typography.Text strong className="font-mono text-[14px]">
          {v}
        </Typography.Text>
      ),
    },
    {
      title: "Average cost / share",
      key: "avgPrice",
      width: 128,
      align: "right",
      render: (_: unknown, row) => {
        const feePerSh =
          row.shares > 0 ? row.feesInPositionBdt / row.shares : 0;
        const feeLine =
          row.feesInPositionBdt > 0 && feePerSh > 0
            ? `incl. ${formatBdt(feePerSh)} commission / sh`
            : "incl. commission if logged on buys";
        return (
          <div className="flex flex-col items-end gap-0.5">
            <span className="tabular-nums text-[14px] font-medium">
              {formatBdt(row.avgPrice)}
            </span>
            <Typography.Text type="secondary" className="text-[11px] leading-tight">
              {feeLine}
            </Typography.Text>
          </div>
        );
      },
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
    {
      title: "52-week high",
      dataIndex: "week52High",
      width: 88,
      align: "right",
      render: (v: number | null) =>
        v === null ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          <span className="tabular-nums text-[14px]">{formatBdt(v)}</span>
        ),
    },
    {
      title: "52-week low",
      dataIndex: "week52Low",
      width: 88,
      align: "right",
      render: (v: number | null) =>
        v === null ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          <span className="tabular-nums text-[14px]">{formatBdt(v)}</span>
        ),
    },
  ];

  return (
    <Card
      bordered
      className="w-full border-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80"
      styles={{ body: { padding: 0 } }}
    >
      <Table<Row>
        className="portfolio-holdings-table"
        columns={columns}
        dataSource={data}
        pagination={false}
        size="small"
        bordered={false}
        tableLayout="auto"
      />
    </Card>
  );
}
