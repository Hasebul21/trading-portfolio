"use client";

import { AppPageHeader } from "@/components/app-page-header";
import { formatBdt } from "@/lib/format-bdt";
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
    ? `Showing ${activeDay} (Asia/Dhaka), newest first.`
    : "Last 7 days, newest first.";

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
    <div>
      <AppPageHeader title="Trade history" />
      <Typography.Paragraph type="secondary" className="mb-6 text-sm leading-relaxed">
        {subtitle} Filter by calendar day (Dhaka).
      </Typography.Paragraph>

      <Card size="small" className="mb-6 max-w-2xl border-zinc-200 dark:border-zinc-800">
        <form onSubmit={applyDaySearch}>
          <Space wrap align="end" size="middle">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <span className="mb-1 block">Date</span>
              <input
                type="date"
                value={dayInput}
                onChange={(e) => setDayInput(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
            <Button type="primary" htmlType="submit">
              Load day
            </Button>
            {activeDay ? (
              <Button href="/trade-history">Last 7 days</Button>
            ) : null}
          </Space>
        </form>
      </Card>

      {loadError ? (
        <Typography.Paragraph type="danger" className="mb-4 rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/40">
          {loadError}
        </Typography.Paragraph>
      ) : null}

      {rows.length === 0 ? (
        <Typography.Paragraph type="secondary">No trades in this range.</Typography.Paragraph>
      ) : (
        <Table<Row>
          columns={columns}
          dataSource={data}
          pagination={false}
          size="middle"
          bordered
        />
      )}
    </div>
  );
}
