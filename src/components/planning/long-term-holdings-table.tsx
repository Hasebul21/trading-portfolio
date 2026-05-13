"use client";

import {
  deleteLongTermHolding,
  setWatchlistClassification,
} from "@/app/(app)/planning-actions";
import { tablePagination } from "@/lib/table-pagination";
import {
  WATCHLIST_CLASS_FILTER_OPTIONS,
  type WatchlistClassFilter,
  type WatchlistClassification,
} from "@/lib/watchlist-classification";
import { Alert, Button, Dropdown, Input, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import type { MenuProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

export type LongTermHoldingRow = {
  id: string;
  created_at: string;
  symbol: string; sector: string | null;  /** Stored as BLUE | GREEN | null (unclassified). */
  classification: WatchlistClassification;
};

type Row = LongTermHoldingRow & { key: string };

function rowMeetsClassFilter(r: LongTermHoldingRow, filter: WatchlistClassFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "CLASSIFIED") return r.classification === "BLUE" || r.classification === "GREEN";
  if (filter === "NONE") return r.classification === null;
  return r.classification === filter;
}

export function LongTermHoldingsTable({ rows }: { rows: LongTermHoldingRow[] }) {
  const router = useRouter();

  const [searchText, setSearchText] = useState("");
  const [classFilter, setClassFilter] = useState<WatchlistClassFilter>("ALL");
  const [classBusyId, setClassBusyId] = useState<string | null>(null);
  const [classError, setClassError] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const q = searchText.trim().toUpperCase();
    return rows.filter((r) => {
      if (!rowMeetsClassFilter(r, classFilter)) return false;
      if (!q) return true;
      const sym = String(r.symbol ?? "")
        .trim()
        .toUpperCase();
      return sym.includes(q);
    });
  }, [rows, searchText, classFilter]);

  const data: Row[] = useMemo(
    () => filteredRows.map((r) => ({ ...r, key: r.id })),
    [filteredRows],
  );

  const applyClassification = useCallback(
    async (rowId: string, next: WatchlistClassification) => {
      setClassError(null);
      setClassBusyId(rowId);
      const res = await setWatchlistClassification(rowId, next);
      setClassBusyId(null);
      if (!res.ok) {
        setClassError(res.error);
        return;
      }
      router.refresh();
    },
    [router],
  );

  const classificationMenu = useCallback(
    (r: Row): MenuProps["items"] => [
      {
        key: "blue",
        label: "Set as blue chip",
        onClick: () => {
          void applyClassification(r.id, "BLUE");
        },
      },
      {
        key: "green",
        label: "Set as green chip",
        onClick: () => {
          void applyClassification(r.id, "GREEN");
        },
      },
      { type: "divider" },
      {
        key: "clear",
        label: "Remove classification",
        disabled: r.classification === null,
        onClick: () => {
          void applyClassification(r.id, null);
        },
      },
    ],
    [applyClassification],
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
      title: "Classification",
      key: "classification",
      width: 200,
      align: "left",
      responsive: ["sm"],
      render: (_: unknown, r) => (
        <Space direction="vertical" size={6} className="w-full py-0.5">
          {r.classification === "BLUE" ? (
            <Tooltip title="Blue chip (your own grouping). Shown with a blue accent on the row.">
              <Tag color="blue">Blue chip</Tag>
            </Tooltip>
          ) : r.classification === "GREEN" ? (
            <Tooltip title="Green chip (your own grouping). Shown with a green accent on the row.">
              <Tag color="green">Green chip</Tag>
            </Tooltip>
          ) : (
            <Tooltip title="No chip label — neutral row styling.">
              <Tag>Unclassified</Tag>
            </Tooltip>
          )}
          <Dropdown
            trigger={["click"]}
            menu={{ items: classificationMenu(r) }}
          >
            <Button size="small" type="default" loading={classBusyId === r.id}>
              Set classification
            </Button>
          </Dropdown>
        </Space>
      ),
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
          <Select<WatchlistClassFilter>
            value={classFilter}
            onChange={setClassFilter}
            options={WATCHLIST_CLASS_FILTER_OPTIONS}
            aria-label="Filter by chip classification"
            className="w-full min-w-0 sm:min-w-[11rem]"
          />
        </Space>
        <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
        </div>
      </div>
      {classError ? (
        <Alert
          type="error"
          showIcon
          closable
          className="mb-3"
          title="Could not update classification"
          description={classError}
          onClose={() => setClassError(null)}
        />
      ) : null}
      <Table<Row>
        className="long-term-holdings-table"
        columns={columns}
        dataSource={data}
        rowClassName={(record) => {
          if (record.classification === "BLUE") {
            return "watchlist-row-blue border-l-[5px] border-l-blue-700 bg-blue-100/80 dark:border-l-blue-400 dark:bg-blue-900/50";
          }
          if (record.classification === "GREEN") {
            return "watchlist-row-green border-l-[5px] border-l-emerald-700 bg-emerald-100/80 dark:border-l-emerald-400 dark:bg-emerald-900/50";
          }
          return "";
        }}
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
