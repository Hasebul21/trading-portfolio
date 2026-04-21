"use client";

import { deleteTransaction } from "@/app/(app)/actions";
import { formatBdt, formatNumberMax2Decimals } from "@/lib/format-bdt";
import { tablePagination } from "@/lib/table-pagination";
import type { TransactionRow } from "@/lib/portfolio";
import { Button, Popconfirm, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

type Props = {
  rows: TransactionRow[];
  loadError: string | null;
};

export function TradeHistorySection({ rows, loadError }: Props) {
  type Row = TransactionRow & { key: string };
  const data: Row[] = rows.map((r) => ({ ...r, key: r.id }));
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const onRemove = useCallback(
    async (id: string) => {
      setRemoveError(null);
      setRemovingId(id);
      const res = await deleteTransaction(id);
      setRemovingId(null);
      if (res.error) {
        setRemoveError(res.error);
        return;
      }
      router.refresh();
    },
    [router],
  );

  const columns: ColumnsType<Row> = useMemo(
    () => [
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
          {formatNumberMax2Decimals(Number(v))}
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
    {
      title: "",
      key: "actions",
      width: 96,
      align: "center",
      render: (_: unknown, record) => (
        <Popconfirm
          title="Remove this row?"
          description="Deletes this row. Holdings and Net Gain/Loss will recalc."
          okText="Remove"
          okButtonProps={{ danger: true }}
          cancelText="Cancel"
          onConfirm={() => void onRemove(record.id)}
        >
          <Button
            type="link"
            danger
            size="small"
            loading={removingId === record.id}
            disabled={removingId !== null && removingId !== record.id}
            className="p-0"
          >
            Remove
          </Button>
        </Popconfirm>
      ),
    },
  ],
    [onRemove, removingId],
  );

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      {loadError ? (
        <Typography.Paragraph type="danger" className="rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/40">
          {loadError}
        </Typography.Paragraph>
      ) : null}

      {removeError ? (
        <Typography.Paragraph type="danger" className="rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/40">
          {removeError}
        </Typography.Paragraph>
      ) : null}

      {rows.length === 0 ? (
        <Typography.Paragraph type="secondary">No trades in this range.</Typography.Paragraph>
      ) : (
        <Table<Row>
          columns={columns}
          dataSource={data}
          scroll={{ x: "max-content" }}
          pagination={tablePagination("rows", {
            hideOnSinglePage: false,
            pageSize: 15,
            pageSizeOptions: [10, 15, 20, 50],
          })}
          size="middle"
          bordered
        />
      )}
    </div>
  );
}
