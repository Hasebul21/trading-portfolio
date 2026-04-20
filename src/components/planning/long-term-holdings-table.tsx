"use client";

import { deleteLongTermHolding, updateLongTermField } from "@/app/(app)/planning-actions";
import { tablePagination } from "@/lib/table-pagination";
import { Button, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";

type LongTermEditableField =
  | "buy_point_bdt"
  | "sell_point_bdt"
  | "manual_avg_cost_bdt"
  | "manual_total_invested_bdt";

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
  return String(n);
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

const inputClass =
  "box-border h-8 w-full min-w-0 flex-1 rounded border border-zinc-300/90 bg-white px-1.5 text-right text-xs tabular-nums text-zinc-900 outline-none focus:ring-1 focus:ring-teal-500/40 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

function BdtCellForm({
  rowId,
  field,
  displayString,
  title,
}: {
  rowId: string;
  field: LongTermEditableField;
  displayString: string;
  title: string;
}) {
  return (
    <form
      action={updateLongTermField}
      className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:justify-end sm:gap-1.5"
    >
      <input type="hidden" name="id" value={rowId} />
      <input type="hidden" name="field" value={field} />
      <input
        key={`${rowId}-${field}-${displayString}`}
        name="value"
        type="text"
        inputMode="decimal"
        title={title}
        aria-label={title}
        defaultValue={displayString}
        placeholder="—"
        className={inputClass}
      />
      <Button
        type="primary"
        size="small"
        htmlType="submit"
        className="h-8 shrink-0 px-2.5 text-[11px] font-semibold sm:min-w-[52px]"
      >
        Save
      </Button>
    </form>
  );
}

export function LongTermHoldingsTable({ rows }: { rows: LongTermHoldingRow[] }) {
  const data: Row[] = rows.map((r) => ({ ...r, key: r.id }));

  const columns: ColumnsType<Row> = [
    {
      title: "Symbol",
      dataIndex: "symbol",
      width: 100,
      fixed: "left",
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
      width: 108,
      align: "left",
      render: (v: string) => (
        <span className="text-zinc-600 dark:text-zinc-400">
          {new Date(v).toLocaleDateString()}
        </span>
      ),
    },
    {
      title: "Buy point",
      key: "buy_point_bdt",
      width: 148,
      align: "right",
      render: (_: unknown, r) => (
        <BdtCellForm
          rowId={r.id}
          field="buy_point_bdt"
          displayString={strForInput(numOrNull(r.buy_point_bdt))}
          title="Buy point (BDT), empty to clear"
        />
      ),
    },
    {
      title: "Sell point",
      key: "sell_point_bdt",
      width: 148,
      align: "right",
      render: (_: unknown, r) => (
        <BdtCellForm
          rowId={r.id}
          field="sell_point_bdt"
          displayString={strForInput(numOrNull(r.sell_point_bdt))}
          title="Sell point (BDT), empty to clear"
        />
      ),
    },
    {
      title: "Avg cost",
      key: "avg_cost",
      width: 152,
      align: "right",
      render: (_: unknown, r) => (
        <BdtCellForm
          rowId={r.id}
          field="manual_avg_cost_bdt"
          displayString={strForInput(effectiveAvg(r))}
          title="Avg cost (BDT). Clears to use portfolio average when you hold this symbol."
        />
      ),
    },
    {
      title: "Total invested",
      key: "total_invested",
      width: 160,
      align: "right",
      render: (_: unknown, r) => (
        <BdtCellForm
          rowId={r.id}
          field="manual_total_invested_bdt"
          displayString={strForInput(effectiveTotal(r))}
          title="Total invested (BDT). Clears to use portfolio book value when you hold this symbol."
        />
      ),
    },
    {
      title: "",
      key: "actions",
      align: "right",
      width: 88,
      fixed: "right",
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
    <div className="max-w-full overflow-x-auto">
      <p className="mb-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        Edit a value, then click <strong>Save</strong> for that cell. Clear <strong>Avg cost</strong> or{" "}
        <strong>Total invested</strong> and save to use your open portfolio numbers again (plain numbers, e.g.{" "}
        <span className="font-mono">142.5</span>).
      </p>
      <Table<Row>
        className="min-w-[860px]"
        columns={columns}
        dataSource={data}
        locale={{ emptyText: "No symbols yet." }}
        pagination={tablePagination("symbols", { hideOnSinglePage: false })}
        scroll={{ x: "max-content" }}
        size="middle"
        bordered
      />
    </div>
  );
}
