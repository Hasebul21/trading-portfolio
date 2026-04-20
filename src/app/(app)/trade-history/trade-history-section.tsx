"use client";

import { AppPageHeader } from "@/components/app-page-header";
import { formatBdt } from "@/lib/format-bdt";
import { tablePagination } from "@/lib/table-pagination";
import type { TransactionRow } from "@/lib/portfolio";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";

type Props = {
  rows: TransactionRow[];
  activeDay: string | null;
  loadError: string | null;
};

export function TradeHistorySection({ rows, activeDay, loadError }: Props) {
  const router = useRouter();
  const [dayInput, setDayInput] = useState(activeDay ?? "");

  const subtitle = activeDay
    ? `${activeDay} · Dhaka · newest first`
    : "Last 7 days · newest first";

  function applyDaySearch(e: React.FormEvent) {
    e.preventDefault();
    const d = dayInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      router.push(`/trade-history?day=${encodeURIComponent(d)}`);
    }
  }

  type Row = TransactionRow & { key: string };
  const data: Row[] = rows.map((r) => ({ ...r, key: r.id }));

  const columns: ColumnsType<Row> = [
    {
      title: "When",
      dataIndex: "created_at",
      align: "left",
      render: (v: string) => (
        <span className="text-zinc-600 dark:text-zinc-400">
          {new Date(v).toLocaleString("en-GB", {
            timeZone: "Asia/Dhaka",
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
      ),
    },
    {
      title: "Symbol",
      dataIndex: "symbol",
      align: "left",
      render: (v: string) => (
        <Typography.Text strong className="font-mono">
          {String(v).toUpperCase()}
        </Typography.Text>
      ),
    },
    {
      title: "Side",
      dataIndex: "side",
      align: "center",
      width: 72,
      render: (v: string) => <span className="capitalize">{v}</span>,
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      align: "right",
      render: (v: string | number) => (
        <span className="tabular-nums">
          {Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </span>
      ),
    },
    {
      title: "Price",
      dataIndex: "price_per_share",
      align: "right",
      render: (v: string | number) => (
        <span className="tabular-nums">{formatBdt(Number(v))}</span>
      ),
    },
    {
      title: "Fees",
      dataIndex: "fees_bdt",
      align: "right",
      render: (v: string | number | null | undefined) => (
        <span className="tabular-nums">{formatBdt(Number(v ?? 0))}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <AppPageHeader title="Trade history" />
      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>

      <Card
        size="small"
        className="max-w-md rounded-xl border-teal-200/50 bg-white/85 py-1 shadow-sm dark:border-teal-900/35 dark:bg-zinc-900/70"
        styles={{ body: { padding: "10px 12px" } }}
      >
        <form onSubmit={applyDaySearch}>
          <Space wrap align="center" size="small">
            <input
              type="date"
              value={dayInput}
              onChange={(e) => setDayInput(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <Button type="primary" htmlType="submit" size="small">
              Go
            </Button>
            {activeDay ? (
              <Button href="/trade-history" size="small">
                7d
              </Button>
            ) : null}
          </Space>
        </form>
      </Card>

      {loadError ? (
        <Typography.Paragraph type="danger" className="rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/40">
          {loadError}
        </Typography.Paragraph>
      ) : null}

      {rows.length === 0 ? (
        <Typography.Paragraph type="secondary">No trades in this range.</Typography.Paragraph>
      ) : (
        <Table<Row>
          columns={columns}
          dataSource={data}
          pagination={tablePagination("rows")}
          size="middle"
          bordered
        />
      )}
    </div>
  );
}
