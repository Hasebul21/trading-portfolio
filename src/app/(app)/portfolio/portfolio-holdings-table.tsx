"use client";

import { formatBdt } from "@/lib/format-bdt";
import type { PortfolioMarketRow } from "@/lib/market/portfolio-with-quotes";
import { Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";

type Row = PortfolioMarketRow & { key: string };

function fmtSignedBdt(n: number) {
  const s = formatBdt(Math.abs(n));
  if (n > 0) return `+${s}`;
  if (n < 0) return `-${s}`;
  return s;
}

export function PortfolioHoldingsTable({ holdings }: { holdings: PortfolioMarketRow[] }) {
  const data: Row[] = holdings.map((h) => ({ ...h, key: h.symbol }));

  const columns: ColumnsType<Row> = [
    {
      title: "Symbol",
      dataIndex: "symbol",
      width: 110,
      fixed: "left",
      render: (v: string) => (
        <Typography.Text strong>{v}</Typography.Text>
      ),
    },
    {
      title: "Shares",
      dataIndex: "shares",
      width: 100,
      align: "right",
      render: (v: number) =>
        v.toLocaleString(undefined, { maximumFractionDigits: 4 }),
    },
    {
      title: "Category",
      dataIndex: "category",
      width: 120,
      ellipsis: true,
      render: (v: string | null) => v ?? "—",
    },
    {
      title: "Market LTP",
      dataIndex: "marketLtp",
      width: 120,
      align: "right",
      render: (v: number | null) =>
        v === null ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          formatBdt(v)
        ),
    },
    {
      title: "Day Δ",
      dataIndex: "dayChange",
      width: 90,
      align: "right",
      render: (v: number | null) =>
        v === null ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          fmtSignedBdt(v)
        ),
    },
    {
      title: "Day %",
      dataIndex: "dayChangePct",
      width: 80,
      align: "right",
      render: (v: number | null) =>
        v === null ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`
        ),
    },
    {
      title: "Avg price",
      dataIndex: "avgPrice",
      width: 110,
      align: "right",
      render: (_: unknown, row) => formatBdt(row.avgPrice),
    },
    {
      title: "Total invested",
      dataIndex: "totalCost",
      width: 130,
      align: "right",
      sorter: (a, b) => a.totalCost - b.totalCost,
      defaultSortOrder: "descend",
      showSorterTooltip: { title: "Click to toggle sort" },
      render: (_: unknown, row) => formatBdt(row.totalCost),
    },
    {
      title: "Unrealized P/L",
      dataIndex: "unrealizedPl",
      width: 130,
      align: "right",
      render: (v: number | null) =>
        v === null ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          <Typography.Text type={v >= 0 ? "success" : "danger"}>
            {fmtSignedBdt(v)}
          </Typography.Text>
        ),
    },
  ];

  return (
    <Table<Row>
      columns={columns}
      dataSource={data}
      pagination={false}
      size="middle"
      bordered
      scroll={{ x: 1100 }}
    />
  );
}
