"use client";

import { deleteLongTermHolding } from "@/app/(app)/planning-actions";
import { Button, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";

export type LongTermHoldingRow = {
  id: string;
  created_at: string;
  symbol: string;
};

type Row = LongTermHoldingRow & { key: string };

export function LongTermHoldingsTable({ rows }: { rows: LongTermHoldingRow[] }) {
  const data: Row[] = rows.map((r) => ({ ...r, key: r.id }));

  const columns: ColumnsType<Row> = [
    {
      title: "Symbol",
      dataIndex: "symbol",
      align: "left",
      render: (v: string) => (
        <Typography.Text strong className="font-mono">
          {v}
        </Typography.Text>
      ),
    },
    {
      title: "Added",
      dataIndex: "created_at",
      align: "left",
      render: (v: string) => (
        <span className="text-zinc-600 dark:text-zinc-400">
          {new Date(v).toLocaleDateString()}
        </span>
      ),
    },
    {
      title: "",
      key: "actions",
      align: "right",
      width: 100,
      render: (_: unknown, r) => (
        <form action={deleteLongTermHolding} className="inline">
          <input type="hidden" name="id" value={r.id} />
          <Button type="link" danger size="small" htmlType="submit">
            Remove
          </Button>
        </form>
      ),
    },
  ];

  return (
    <Table<Row>
      className="mt-4 max-w-2xl"
      columns={columns}
      dataSource={data}
      pagination={false}
      size="middle"
      bordered
    />
  );
}
