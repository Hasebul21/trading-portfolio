"use client";

import { deleteTradePlan } from "@/app/(app)/planning-actions";
import { tablePagination } from "@/lib/table-pagination";
import { formatBdt } from "@/lib/format-bdt";
import { Button, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";

export type TradePlanRow = {
  id: string;
  created_at: string;
  symbol: string;
  side: string;
  target_price: number | string;
  planned_budget_bdt: number | string | null;
  notes: string | null;
};

type Row = TradePlanRow & { key: string };

export function TradePlansTable({ rows }: { rows: TradePlanRow[] }) {
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
      title: "Side",
      dataIndex: "side",
      align: "center",
      width: 88,
      render: (v: string) => <span className="capitalize">{v}</span>,
    },
    {
      title: "Target price",
      dataIndex: "target_price",
      align: "right",
      render: (v: number | string) => (
        <span className="tabular-nums">{formatBdt(Number(v))}</span>
      ),
    },
    {
      title: "Planned budget",
      dataIndex: "planned_budget_bdt",
      align: "right",
      render: (v: number | string | null) =>
        v == null ? <Typography.Text type="secondary">—</Typography.Text> : <span className="tabular-nums">{formatBdt(Number(v))}</span>,
    },
    {
      title: "Note",
      dataIndex: "notes",
      align: "left",
      width: 240,
      render: (v: string | null) => v ? <span>{v}</span> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "",
      key: "actions",
      align: "right",
      width: 100,
      render: (_: unknown, r) => (
        <form action={deleteTradePlan} className="inline">
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
      className="w-full min-w-0"
      columns={columns}
      dataSource={data}
      scroll={{ x: "max-content" }}
      locale={{ emptyText: "No targets yet." }}
      pagination={tablePagination("targets", { hideOnSinglePage: false })}
      size="middle"
      bordered
    />
  );
}
