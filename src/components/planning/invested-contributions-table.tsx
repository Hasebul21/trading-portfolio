"use client";

import { deleteCapitalContribution } from "@/app/(app)/planning-actions";
import { formatBdt } from "@/lib/format-bdt";
import { tablePagination } from "@/lib/table-pagination";
import { Button, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";

export type ContributionRow = {
  id: string;
  created_at: string;
  amount_bdt: string | number;
  note: string | null;
};

type Row = ContributionRow & { key: string };

export function InvestedContributionsTable({ rows }: { rows: ContributionRow[] }) {
  const data: Row[] = rows.map((r) => ({ ...r, key: r.id }));

  const columns: ColumnsType<Row> = [
    {
      title: "When",
      dataIndex: "created_at",
      align: "left",
      render: (v: string) => (
        <span className="text-zinc-50">
          {new Date(v).toLocaleString()}
        </span>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount_bdt",
      align: "right",
      render: (v: string | number) => (
        <Typography.Text strong className="tabular-nums">
          {formatBdt(Number(v))}
        </Typography.Text>
      ),
    },
    {
      title: "Note",
      dataIndex: "note",
      ellipsis: true,
      render: (v: string | null) =>
        v?.trim() ? (
          <span className="text-zinc-50">{v}</span>
        ) : (
          <span className="text-zinc-50">—</span>
        ),
    },
    {
      title: "",
      key: "actions",
      align: "right",
      width: 100,
      render: (_: unknown, r) => (
        <form action={deleteCapitalContribution} className="inline">
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
      className="w-full min-w-0 max-w-2xl"
      columns={columns}
      dataSource={data}
      scroll={{ x: "max-content" }}
      locale={{ emptyText: "No entries yet." }}
      pagination={tablePagination("entries", { hideOnSinglePage: false })}
      size="middle"
      bordered
    />
  );
}
