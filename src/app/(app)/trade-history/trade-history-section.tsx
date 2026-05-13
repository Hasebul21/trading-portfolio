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
  pnlById?: Record<string, number>;
  loadError: string | null;
};

export function TradeHistorySection({ rows, pnlById, loadError }: Props) {
  type Row = TransactionRow & { key: string; realizedPnl: number | null };
  const data: Row[] = rows.map((r) => ({
    ...r,
    key: r.id,
    realizedPnl:
      pnlById && Object.prototype.hasOwnProperty.call(pnlById, r.id)
        ? pnlById[r.id]
        : null,
  }));
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
        responsive: ["sm"],
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
        responsive: ["md"],
        render: (v: string | number | null | undefined) => (
          <span className="tabular-nums">{formatBdt(Number(v ?? 0))}</span>
        ),
      },
      {
        title: "P/L",
        dataIndex: "realizedPnl",
        align: "right",
        render: (v: number | null) => {
          if (v === null) {
            return (
              <span className="text-zinc-400 dark:text-zinc-500">—</span>
            );
          }
          const cls =
            v > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : v < 0
                ? "text-red-600 dark:text-red-400"
                : "text-zinc-600 dark:text-zinc-400";
          return (
            <span className={`tabular-nums ${cls}`}>{formatBdt(v)}</span>
          );
        },
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
        <>
          {/* Mobile (< md): card list — no horizontal scroll. */}
          <ul className="mobile-card-list md:hidden">
            {data.map((row) => (
              <MobileTradeCard
                key={row.id}
                row={row}
                onRemove={(id) => void onRemove(id)}
                removingId={removingId}
              />
            ))}
          </ul>

          {/* Desktop (≥ md): full Ant Design table. */}
          <div className="hidden md:block">
            <Table<Row>
              className="trade-history-table"
              columns={columns}
              dataSource={data}
              pagination={tablePagination("rows", {
                hideOnSinglePage: false,
                pageSize: 15,
                pageSizeOptions: [10, 15, 20, 50],
              })}
              size="middle"
              bordered
              tableLayout="auto"
            />
          </div>
        </>
      )}
    </div>
  );
}

function MobileTradeCard({
  row,
  onRemove,
  removingId,
}: {
  row: TransactionRow & { key: string; id: string; realizedPnl: number | null };
  onRemove: (id: string) => void;
  removingId: string | null;
}) {
  const isSell = String(row.side).toLowerCase() === "sell";
  const sideClass = isSell
    ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200"
    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";

  return (
    <li>
      <article
        className={`flex flex-col gap-2 rounded-xl border border-zinc-200/70 bg-white/85 px-3 py-3 text-left shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/70 ${
          isSell
            ? "border-l-[4px] border-l-red-500/70 dark:border-l-red-400/80"
            : "border-l-[4px] border-l-emerald-500/70 dark:border-l-emerald-400/80"
        }`}
      >
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[15px] font-medium uppercase text-zinc-900 dark:text-zinc-50">
              {String(row.symbol).toUpperCase()}
            </span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${sideClass}`}
            >
              {String(row.side)}
            </span>
          </div>
          <Popconfirm
            title="Remove this row?"
            description="Holdings and Net G/L will recalc."
            okText="Remove"
            okButtonProps={{ danger: true }}
            cancelText="Cancel"
            onConfirm={() => onRemove(row.id)}
          >
            <Button
              type="link"
              danger
              size="small"
              loading={removingId === row.id}
              disabled={removingId !== null && removingId !== row.id}
              className="!h-auto !px-1 !py-0"
            >
              Remove
            </Button>
          </Popconfirm>
        </header>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Qty × Price</dt>
            <dd className="font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatNumberMax2Decimals(Number(row.quantity))} ×{" "}
              {formatBdt(Number(row.price_per_share))}
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-zinc-500 dark:text-zinc-400">Fees</dt>
            <dd className="font-mono tabular-nums text-zinc-700 dark:text-zinc-200">
              {formatBdt(Number(row.fees_bdt ?? 0))}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">P/L</dt>
            <dd
              className={`font-mono tabular-nums ${
                row.realizedPnl === null
                  ? "text-zinc-400 dark:text-zinc-500"
                  : row.realizedPnl > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : row.realizedPnl < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-zinc-700 dark:text-zinc-200"
              }`}
            >
              {row.realizedPnl === null ? "—" : formatBdt(row.realizedPnl)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-zinc-500 dark:text-zinc-400">When</dt>
            <dd className="text-zinc-700 dark:text-zinc-200">
              {new Date(row.created_at).toLocaleString("en-GB", {
                timeZone: "Asia/Dhaka",
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </dd>
          </div>
        </dl>
      </article>
    </li>
  );
}
