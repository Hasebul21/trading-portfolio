"use client";

import {
  deleteLongTermHolding,
  saveLongTermTable,
  type LongTermRowSavePayload,
} from "@/app/(app)/planning-actions";
import { formatBdt, formatPlainNumberMax2Decimals } from "@/lib/format-bdt";
import { tablePagination } from "@/lib/table-pagination";
import { Alert, Button, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

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

type DraftCell = { buy: string; sell: string; avg: string; total: string };

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

function buildDraftFromRows(rows: LongTermHoldingRow[]): Record<string, DraftCell> {
  const d: Record<string, DraftCell> = {};
  for (const r of rows) {
    d[r.id] = {
      buy: strForInput(numOrNull(r.buy_point_bdt)),
      sell: strForInput(numOrNull(r.sell_point_bdt)),
      avg: strForInput(effectiveAvg(r)),
      total: strForInput(effectiveTotal(r)),
    };
  }
  return d;
}

function parseFieldToNullableNumber(raw: string): number | null {
  const s = raw.trim().replace(/,/g, "");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function rowToPayload(row: LongTermHoldingRow, cell: DraftCell | undefined): LongTermRowSavePayload {
  const d =
    cell ??
    ({
      buy: strForInput(numOrNull(row.buy_point_bdt)),
      sell: strForInput(numOrNull(row.sell_point_bdt)),
      avg: strForInput(effectiveAvg(row)),
      total: strForInput(effectiveTotal(row)),
    } satisfies DraftCell);
  return {
    id: row.id,
    buy_point_bdt: parseFieldToNullableNumber(d.buy),
    sell_point_bdt: parseFieldToNullableNumber(d.sell),
    manual_avg_cost_bdt: parseFieldToNullableNumber(d.avg),
    manual_total_invested_bdt: parseFieldToNullableNumber(d.total),
  };
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

function LongTermFieldsReadOnly({ row }: { row: LongTermHoldingRow }) {
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
    </div>
  );
}

function LongTermFieldsEdit({
  row,
  values,
  onPatch,
}: {
  row: LongTermHoldingRow;
  values: DraftCell;
  onPatch: (patch: Partial<DraftCell>) => void;
}) {
  return (
    <div className={`${rowFieldsLayout} py-0.5`}>
      <div className={pointsFieldShell}>
        <span className={pointsLabelClass}>Buy pt</span>
        <input
          type="text"
          inputMode="decimal"
          value={values.buy}
          onChange={(e) => onPatch({ buy: e.target.value })}
          placeholder="—"
          aria-label={`${row.symbol} buy point, empty to clear`}
          title="Buy point, empty to clear"
          className={pointsInputClass}
        />
      </div>
      <div className={pointsFieldShell}>
        <span className={pointsLabelClass}>Sell pt</span>
        <input
          type="text"
          inputMode="decimal"
          value={values.sell}
          onChange={(e) => onPatch({ sell: e.target.value })}
          placeholder="—"
          aria-label={`${row.symbol} sell point, empty to clear`}
          title="Sell point, empty to clear"
          className={pointsInputClass}
        />
      </div>
      <div className={costFieldShell}>
        <span className={fieldLabelClass}>Avg cost</span>
        <input
          type="text"
          inputMode="decimal"
          value={values.avg}
          onChange={(e) => onPatch({ avg: e.target.value })}
          placeholder="—"
          aria-label={`${row.symbol} avg cost. Clear to use portfolio average.`}
          title="Avg cost. Clears to use portfolio average when you hold this symbol."
          className={costInputClass}
        />
      </div>
      <div className={costFieldShell}>
        <span className={fieldLabelClass}>Total</span>
        <input
          type="text"
          inputMode="decimal"
          value={values.total}
          onChange={(e) => onPatch({ total: e.target.value })}
          placeholder="—"
          aria-label={`${row.symbol} total invested. Clear to use portfolio book value.`}
          title="Total invested. Clears to use portfolio book value when you hold this symbol."
          className={costInputClass}
        />
      </div>
    </div>
  );
}

export function LongTermHoldingsTable({ rows }: { rows: LongTermHoldingRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, DraftCell>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const data: Row[] = rows.map((r) => ({ ...r, key: r.id }));

  const beginEdit = useCallback(() => {
    setSaveError(null);
    setDraft(buildDraftFromRows(rows));
    setEditing(true);
  }, [rows]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setDraft({});
    setSaveError(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    const updates: LongTermRowSavePayload[] = rows.map((r) => rowToPayload(r, draft[r.id]));
    setSaving(true);
    try {
      const res = await saveLongTermTable(updates);
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      setEditing(false);
      setDraft({});
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [draft, rows, router]);

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
        <span className="text-zinc-600 dark:text-zinc-400">{new Date(v).toLocaleDateString()}</span>
      ),
    },
    {
      title: "Buy / sell points & cost overrides",
      key: "edit_row",
      align: "left",
      render: (_: unknown, r) => {
        if (!editing) return <LongTermFieldsReadOnly row={r} />;
        const values = draft[r.id] ?? buildDraftFromRows([r])[r.id];
        return (
          <LongTermFieldsEdit
            key={r.id}
            row={r}
            values={values}
            onPatch={(patch) =>
              setDraft((prev) => {
                const base = prev[r.id] ?? buildDraftFromRows([r])[r.id];
                return { ...prev, [r.id]: { ...base, ...patch } };
              })
            }
          />
        );
      },
    },
    {
      title: "",
      key: "actions",
      align: "right",
      width: 88,
      render: (_: unknown, r) => (
        <form action={deleteLongTermHolding} className="inline">
          <input type="hidden" name="id" value={r.id} />
          <Button type="link" danger size="small" htmlType="submit" disabled={editing}>
            Remove
          </Button>
        </form>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 max-w-full">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Use <strong>Edit table</strong> to change all rows, then <strong>Save changes</strong>.{" "}
          <strong>Cancel</strong> discards edits. Clear <strong>Avg cost</strong> or <strong>Total</strong> and save to
          use your open portfolio numbers again. <strong>Remove</strong> is disabled while editing.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {!editing ? (
            <Button type="default" size="middle" className="font-semibold" onClick={beginEdit}>
              Edit table
            </Button>
          ) : (
            <>
              <Button
                type="primary"
                size="middle"
                className="font-semibold"
                loading={saving}
                disabled={saving}
                onClick={() => void handleSave()}
              >
                Save changes
              </Button>
              <Button type="default" size="middle" className="font-semibold" disabled={saving} onClick={cancelEdit}>
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>
      {saveError ? (
        <Alert type="error" showIcon className="mb-3" message="Could not save" description={saveError} />
      ) : null}
      <Table<Row>
        className="long-term-holdings-table"
        columns={columns}
        dataSource={data}
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
