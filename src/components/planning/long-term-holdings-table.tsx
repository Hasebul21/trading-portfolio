"use client";

import { deleteLongTermHolding } from "@/app/(app)/planning-actions";
import { tablePagination } from "@/lib/table-pagination";
import { Button, Input, Space, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

export type LongTermHoldingRow = {
  id: string;
  created_at: string;
  symbol: string;
  sector: string | null;
};

type Row = LongTermHoldingRow & { key: string };

export function LongTermHoldingsTable({ rows }: { rows: LongTermHoldingRow[] }) {
  const [searchText, setSearchText] = useState("");

  const filteredRows = useMemo(() => {
    const q = searchText.trim().toUpperCase();
    return rows.filter((r) => {
      if (!q) return true;
      const sym = String(r.symbol ?? "")
        .trim()
        .toUpperCase();
      return sym.includes(q);
    });
  }, [rows, searchText]);

  const data: Row[] = useMemo(
    () => filteredRows.map((r) => ({ ...r, key: r.id })),
    [filteredRows],
  );

  const columns: ColumnsType<Row> = [
    {
      title: "Symbol",
      dataIndex: "symbol",
      width: 112,
      align: "left",
      render: (v: string) => (
        <span className="font-mono text-[15px] font-normal text-zinc-50">{v}</span>
      ),
    },
    {
      title: "Sector",
      dataIndex: "sector",
      width: 144,
      align: "left",
      responsive: ["sm"],
      sorter: (a, b) => (a.sector ?? "Unknown").localeCompare(b.sector ?? "Unknown"),
      render: (v: string | null) => v ? <span>{v}</span> : <span className="text-zinc-50">Unknown</span>,
    },
    {
      title: "Added",
      dataIndex: "created_at",
      width: 100,
      align: "left",
      responsive: ["md"],
      render: (v: string) => (
        <span className="text-zinc-50">{new Date(v).toLocaleDateString()}</span>
      ),
    },
    {
      title: "",
      key: "actions",
      align: "right",
      width: 88,
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
    <div className="w-full min-w-0 max-w-full overflow-x-auto">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Space wrap className="w-full min-w-0 [&_.ant-space-item]:w-full sm:w-auto sm:[&_.ant-space-item]:w-auto">
          <Input
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by symbol"
            aria-label="Filter watchlist by symbol"
            className="w-full max-w-full sm:max-w-[16rem]"
          />
        </Space>
      </div>
      <Table<Row>
        className="long-term-holdings-table"
        columns={columns}
        dataSource={data}
        scroll={{ x: "max-content" }}
        locale={{ emptyText: "No symbols yet." }}
        pagination={tablePagination("symbols", {
          hideOnSinglePage: false,
          pageSize: 15,
          pageSizeOptions: [10, 15, 20, 50],
        })}
        size="middle"
        bordered
      />
    </div>
  );
}
