"use client";

import { formatBdt } from "@/lib/format-bdt";
import { tablePagination } from "@/lib/table-pagination";
import type { TransactionRow } from "@/lib/portfolio";
import { Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";

type Props = {
  rows: TransactionRow[];
  loadError: string | null;
};

export function TradeHistorySection({ rows, loadError }: Props) {
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
          pagination={tablePagination("rows", { hideOnSinglePage: false })}
          size="middle"
          bordered
        />
      )}
    </div>
  );
}
