"use client";

import { deleteLongTermHolding, updateLongTermRow } from "@/app/(app)/planning-actions";
import { formatBdt, formatPlainNumberMax2Decimals } from "@/lib/format-bdt";
import { tablePagination } from "@/lib/table-pagination";
import { Button, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

export type LongTermHoldingRow = {
  id: string;
  created_at: string;
  symbol: string;
  buy_point_bdt?: number | string | null;
  sell_point_bdt?: number | string | null;
  manual_avg_cost_bdt?: number | string | null;
  manual_total_invested_bdt?: number | string | null;
  /** From open portfolio position for this symbol, if any. */
  portfolio_avg_cost_bdt: number | null;
  portfolio_total_invested_bdt: number | null;
};

type Row = LongTermHoldingRow & { key: string };

function numOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function strForInput(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "";
  return formatPlainNumberMax2Decimals(n);
}

function effectiveAvg(r: LongTermHoldingRow): number | null {
  const m = numOrNull(r.manual_avg_cost_bdt);
  if (m !== null) return m;
  return r.portfolio_avg_cost_bdt;
}

function effectiveTotal(r: LongTermHoldingRow): number | null {
  const m = numOrNull(r.manual_total_invested_bdt);
  if (m !== null) return m;
  return r.portfolio_total_invested_bdt;
}

function rowRefreshKey(r: LongTermHoldingRow): string {
  return [
    r.id,
    r.buy_point_bdt ?? "",
    r.sell_point_bdt ?? "",
    r.manual_avg_cost_bdt ?? "",
    r.manual_total_invested_bdt ?? "",
  ].join("|");
}

/** Buy / sell points: larger tap targets and type. */
const pointsInputClass =
  "box-border h-11 min-h-[2.75rem] w-full min-w-[4.5rem] rounded-md border border-teal-200/90 bg-white px-3 py-2 text-right text-base tabular-nums leading-tight text-zinc-900 outline-none ring-teal-500/20 focus:ring-2 dark:border-teal-800/60 dark:bg-zinc-950 dark:text-zinc-50";

const costInputClass =
  "box-border h-10 min-h-[2.5rem] w-full min-w-[3.75rem] rounded-md border border-zinc-300/90 bg-white px-2.5 py-2 text-right text-sm tabular-nums text-zinc-900 outline-none focus:ring-1 focus:ring-teal-500/40 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

const pointsLabelClass =
  "text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300";

const fieldLabelClass = "text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

const rowFieldsLayout =
  "flex w-full min-w-0 flex-wrap items-end gap-x-3 gap-y-3 sm:gap-x-4";

/** Buy & sell columns grow more than cost overrides on wide screens. */
const pointsFieldShell = "flex min-w-0 flex-[1.25] basis-[min(100%,12rem)] flex-col gap-1 sm:basis-0 sm:min-w-[8rem]";
const costFieldShell = "flex min-w-0 flex-1 basis-[min(100%,10rem)] flex-col gap-1 sm:basis-0 sm:min-w-[6.5rem]";

function bdtReadCell(n: number | null) {
  if (n === null || !Number.isFinite(n)) {
    return <Typography.Text type="secondary">—</Typography.Text>;
  }
  return <span className="tabular-nums text-sm">{formatBdt(n)}</span>;
}

function bdtReadCellPoints(n: number | null) {
  if (n === null || !Number.isFinite(n)) {
    return (
      <Typography.Text type="secondary" className="text-base">
        —
      </Typography.Text>
    );
  }
  return (
    <span className="tabular-nums text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-lg">
      {formatBdt(n)}
    </span>
  );
}

function LongTermRowReadOnly({
  row,
  onEdit,
}: {
  row: LongTermHoldingRow;
  onEdit: () => void;
}) {
  return (
    <div className={`${rowFieldsLayout} py-0.5`}>
      <div className={pointsFieldShell}>
        <span className={pointsLabelClass}>Buy pt</span>
        {bdtReadCellPoints(numOrNull(row.buy_point_bdt))}
      </div>
      <div className={pointsFieldShell}>
        <span className={pointsLabelClass}>Sell pt</span>
        {bdtReadCellPoints(numOrNull(row.sell_point_bdt))}
      </div>
      <div className={costFieldShell}>
        <span className={fieldLabelClass}>Avg cost</span>
        {bdtReadCell(effectiveAvg(row))}
      </div>
      <div className={costFieldShell}>
        <span className={fieldLabelClass}>Total</span>
        {bdtReadCell(effectiveTotal(row))}
      </div>
      <Button type="default" size="middle" className="h-10 shrink-0 px-4 text-sm font-semibold" onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
}

function LongTermRowEditor({ row, onCancel }: { row: LongTermHoldingRow; onCancel: () => void }) {
  return (
    <form action={updateLongTermRow} className={`${rowFieldsLayout} py-0.5`}>
      <input type="hidden" name="id" value={row.id} />
      <div className={pointsFieldShell}>
        <span className={pointsLabelClass}>Buy pt</span>
        <input
          name="buy_point_bdt"
          type="text"
          inputMode="decimal"
          defaultValue={strForInput(numOrNull(row.buy_point_bdt))}
          placeholder="—"
          aria-label="Buy point, empty to clear"
          title="Buy point, empty to clear"
          className={pointsInputClass}
        />
      </div>
      <div className={pointsFieldShell}>
        <span className={pointsLabelClass}>Sell pt</span>
        <input
          name="sell_point_bdt"
          type="text"
          inputMode="decimal"
          defaultValue={strForInput(numOrNull(row.sell_point_bdt))}
          placeholder="—"
          aria-label="Sell point, empty to clear"
          title="Sell point, empty to clear"
          className={pointsInputClass}
        />
      </div>
      <div className={costFieldShell}>
        <span className={fieldLabelClass}>Avg cost</span>
        <input
          name="manual_avg_cost_bdt"
          type="text"
          inputMode="decimal"
          defaultValue={strForInput(effectiveAvg(row))}
          placeholder="—"
          aria-label="Avg cost. Clear and save to use portfolio average."
          title="Avg cost. Clears to use portfolio average when you hold this symbol."
          className={costInputClass}
        />
      </div>
      <div className={costFieldShell}>
        <span className={fieldLabelClass}>Total</span>
        <input
          name="manual_total_invested_bdt"
          type="text"
          inputMode="decimal"
          defaultValue={strForInput(effectiveTotal(row))}
          placeholder="—"
          aria-label="Total invested. Clear and save to use portfolio book value."
          title="Total invested. Clears to use portfolio book value when you hold this symbol."
          className={costInputClass}
        />
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="default" size="middle" className="h-10 px-4 text-sm font-semibold" htmlType="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="primary" size="middle" htmlType="submit" className="h-10 px-4 text-sm font-semibold">
          Save
        </Button>
      </div>
    </form>
  );
}

export function LongTermHoldingsTable({ rows }: { rows: LongTermHoldingRow[] }) {
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const data: Row[] = rows.map((r) => ({ ...r, key: r.id }));

  const columns: ColumnsType<Row> = [
    {
      title: "Symbol",
      dataIndex: "symbol",
      width: 96,
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
      width: 100,
      align: "left",
      render: (v: string) => (
        <span className="text-zinc-600 dark:text-zinc-400">
          {new Date(v).toLocaleDateString()}
        </span>
      ),
    },
    {
      title: "Buy / sell points & cost overrides",
      key: "edit_row",
      align: "left",
      render: (_: unknown, r) =>
        editingRowId === r.id ? (
          <LongTermRowEditor key={rowRefreshKey(r)} row={r} onCancel={() => setEditingRowId(null)} />
        ) : (
          <LongTermRowReadOnly row={r} onEdit={() => setEditingRowId(r.id)} />
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
    <div className="w-full min-w-0 max-w-full">
      <p className="mb-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        Click <strong>Edit</strong> on a row to change buy/sell points or cost overrides, then <strong>Save</strong>.{" "}
        <strong>Cancel</strong> discards unsaved changes. Clear <strong>Avg cost</strong> or <strong>Total</strong> and save
        to use your open portfolio numbers again.
      </p>
      <Table<Row>
        className="long-term-holdings-table"
        columns={columns}
        dataSource={data}
        locale={{ emptyText: "No symbols yet." }}
        pagination={tablePagination("symbols", { hideOnSinglePage: false })}
        size="middle"
        bordered
      />
    </div>
  );
}
