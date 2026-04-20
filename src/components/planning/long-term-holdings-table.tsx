"use client";

import { deleteLongTermHolding, updateLongTermRow } from "@/app/(app)/planning-actions";
import { tablePagination } from "@/lib/table-pagination";
import { Button, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";

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

function rowRefreshKey(r: LongTermHoldingRow): string {
  return [
    r.id,
    r.buy_point_bdt ?? "",
    r.sell_point_bdt ?? "",
    r.manual_avg_cost_bdt ?? "",
    r.manual_total_invested_bdt ?? "",
  ].join("|");
}

const inputClass =
  "box-border h-8 w-full min-w-[3.5rem] max-w-[6.5rem] rounded border border-zinc-300/90 bg-white px-1.5 text-right text-xs tabular-nums text-zinc-900 outline-none focus:ring-1 focus:ring-teal-500/40 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

const fieldLabelClass = "text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

function LongTermRowEditor({ row }: { row: LongTermHoldingRow }) {
  return (
    <form action={updateLongTermRow} className="flex flex-wrap items-end gap-x-3 gap-y-2 py-0.5">
      <input type="hidden" name="id" value={row.id} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={fieldLabelClass}>Buy pt</span>
        <input
          name="buy_point_bdt"
          type="text"
          inputMode="decimal"
          defaultValue={strForInput(numOrNull(row.buy_point_bdt))}
          placeholder="—"
          aria-label="Buy point (BDT), empty to clear"
          title="Buy point (BDT), empty to clear"
          className={inputClass}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={fieldLabelClass}>Sell pt</span>
        <input
          name="sell_point_bdt"
          type="text"
          inputMode="decimal"
          defaultValue={strForInput(numOrNull(row.sell_point_bdt))}
          placeholder="—"
          aria-label="Sell point (BDT), empty to clear"
          title="Sell point (BDT), empty to clear"
          className={inputClass}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={fieldLabelClass}>Avg cost</span>
        <input
          name="manual_avg_cost_bdt"
          type="text"
          inputMode="decimal"
          defaultValue={strForInput(effectiveAvg(row))}
          placeholder="—"
          aria-label="Avg cost (BDT). Clear and save to use portfolio average."
          title="Avg cost (BDT). Clears to use portfolio average when you hold this symbol."
          className={inputClass}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={fieldLabelClass}>Total</span>
        <input
          name="manual_total_invested_bdt"
          type="text"
          inputMode="decimal"
          defaultValue={strForInput(effectiveTotal(row))}
          placeholder="—"
          aria-label="Total invested (BDT). Clear and save to use portfolio book value."
          title="Total invested (BDT). Clears to use portfolio book value when you hold this symbol."
          className={inputClass}
        />
      </div>
      <Button type="primary" size="small" htmlType="submit" className="h-8 shrink-0 px-3 text-xs font-semibold">
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
      render: (_: unknown, r) => <LongTermRowEditor key={rowRefreshKey(r)} row={r} />,
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
    <div className="max-w-full">
      <p className="mb-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        Edit fields in a row, then click that row&apos;s <strong>Save</strong> once. Clear <strong>Avg cost</strong> or{" "}
        <strong>Total</strong> and save to use your open portfolio numbers again (plain numbers, e.g.{" "}
        <span className="font-mono">142.5</span>).
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
