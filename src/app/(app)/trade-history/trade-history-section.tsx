"use client";

import { deleteTransaction } from "@/app/(app)/actions";
import { formatBdt, formatNumberMax2Decimals } from "@/lib/format-bdt";
import { tablePagination } from "@/lib/table-pagination";
import type { TransactionRow } from "@/lib/portfolio";
import { BROKERAGE_COMMISSION_RATE, roundToTickSize } from "@/lib/portfolio";
import { Button, Popconfirm, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

type Props = {
  rows: TransactionRow[];
  pnlById?: Record<string, number>;
  avgCostById?: Record<string, number>;
  loadError: string | null;
};

export function TradeHistorySection({ rows, pnlById, avgCostById, loadError }: Props) {
  type Row = TransactionRow & { key: string; realizedPnl: number | null; avgCostAtSell: number | null };
  const data: Row[] = rows.map((r) => ({
    ...r,
    key: r.id,
    realizedPnl:
      pnlById && Object.prototype.hasOwnProperty.call(pnlById, r.id)
        ? pnlById[r.id]
        : null,
    avgCostAtSell:
      avgCostById && Object.prototype.hasOwnProperty.call(avgCostById, r.id)
        ? avgCostById[r.id]
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
        title: "Break-even",
        dataIndex: "avgCostAtSell",
        align: "right",
        responsive: ["md"],
        render: (v: number | null) => {
          if (v === null) return <span className="text-zinc-400 dark:text-zinc-500">—</span>;
          // avgCost already includes buy fees; divide out sell commission only
          const breakEven = roundToTickSize(v / (1 - BROKERAGE_COMMISSION_RATE));
          return <span className="tabular-nums">{formatBdt(breakEven)}</span>;
        },
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
          {/* Mobile (< md): compact card grid — 2 per row. */}
          <ul className="grid grid-cols-2 gap-2 md:hidden">
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
  row: TransactionRow & { key: string; id: string; realizedPnl: number | null; avgCostAtSell: number | null };
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
        className={`flex flex-col gap-1.5 rounded-lg border border-zinc-200/70 bg-white/85 px-2 py-2 text-left shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/70 ${
          isSell
            ? "border-l-[3px] border-l-red-500/70 dark:border-l-red-400/80"
            : "border-l-[3px] border-l-emerald-500/70 dark:border-l-emerald-400/80"
        }`}
      >
        <header className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-[13px] font-medium uppercase text-zinc-900 dark:text-zinc-50 truncate">
              {String(row.symbol).toUpperCase()}
            </span>
            <span
              className={`rounded px-1 py-0.5 text-[10px] font-medium uppercase tracking-wider ${sideClass}`}
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
              className="!h-auto !px-1 !py-0 !text-[11px]"
            >
              Remove
            </Button>
          </Popconfirm>
        </header>

        <dl className="flex flex-col gap-1 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Qty × Price</dt>
            <dd className="font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatNumberMax2Decimals(Number(row.quantity))} ×{" "}
              {formatBdt(Number(row.price_per_share))}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
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
        </dl>
      </article>
    </li>
  );
}
