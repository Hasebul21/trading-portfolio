"use client";

import {
  deleteLongTermHolding,
  saveLongTermTable,
  setWatchlistClassification,
  type LongTermRowSavePayload,
} from "@/app/(app)/planning-actions";
import type { DseSessionZones } from "@/lib/market/dse-zone-levels";
import { formatBdt, formatPlainNumberMax2Decimals } from "@/lib/format-bdt";
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
  buy_point_bdt?: number | string | null;
  sell_point_bdt?: number | string | null;
  manual_avg_cost_bdt?: number | string | null;
  manual_total_invested_bdt?: number | string | null;
  /** From open portfolio position for this symbol, if any. */
  portfolio_avg_cost_bdt: number | null;
  portfolio_total_invested_bdt: number | null;
  /** Today’s DSE LSP snapshot (same as Holdings table). Null if symbol missing from LSP. */
  liveZones: DseSessionZones | null;
};

type Row = LongTermHoldingRow & { key: string };

type DraftCell = { avg: string; total: string };

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

function displayFirstBuyZone(r: LongTermHoldingRow): number | null {
  if (r.liveZones) return r.liveZones.firstBuyZone;
  return numOrNull(r.buy_point_bdt);
}

function displaySellBlend(r: LongTermHoldingRow): number | null {
  if (r.liveZones) return r.liveZones.sellZoneBlend;
  return numOrNull(r.sell_point_bdt);
}

function buildDraftFromRows(rows: LongTermHoldingRow[]): Record<string, DraftCell> {
  const d: Record<string, DraftCell> = {};
  for (const r of rows) {
    d[r.id] = {
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
      avg: strForInput(effectiveAvg(row)),
      total: strForInput(effectiveTotal(row)),
    } satisfies DraftCell);
  const sym = String(row.symbol ?? "")
    .trim()
    .toUpperCase();
  return {
    id: row.id,
    symbol: sym,
    manual_avg_cost_bdt: parseFieldToNullableNumber(d.avg),
    manual_total_invested_bdt: parseFieldToNullableNumber(d.total),
  };
}

const costInputClass =
  "box-border h-10 min-h-[2.5rem] w-full min-w-[3.75rem] rounded-md border border-zinc-300/90 bg-white px-2.5 py-2 text-right text-[15px] font-normal tabular-nums text-zinc-900 outline-none focus:ring-1 focus:ring-teal-500/40 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

const fieldLabelClass =
  "text-[15px] font-normal tracking-normal text-zinc-50";

const rowFieldsLayout =
  "flex w-full min-w-0 flex-wrap items-end gap-x-3 gap-y-3 sm:gap-x-4";

const pointsFieldShell = "flex min-w-0 flex-[1.25] basis-[min(100%,12rem)] flex-col gap-1 sm:basis-0 sm:min-w-[8rem]";
const costFieldShell = "flex min-w-0 flex-1 basis-[min(100%,10rem)] flex-col gap-1 sm:basis-0 sm:min-w-[6.5rem]";

function bdtReadCell(n: number | null) {
  if (n === null || !Number.isFinite(n)) {
    return <span className="text-zinc-50">—</span>;
  }
  return <span className="tabular-nums text-[15px] font-normal">{formatBdt(n)}</span>;
}

function LongTermFieldsReadOnly({ row }: { row: LongTermHoldingRow }) {
  return (
    <div className={`${rowFieldsLayout} py-0.5`}>
      <div className={pointsFieldShell}>
        <span className={fieldLabelClass}>Buy Amount</span>
        {bdtReadCell(displayFirstBuyZone(row))}
        {!row.liveZones ? (
          <span className="text-[15px] font-normal leading-snug text-zinc-50">
            Saved value (no live DSE row)
          </span>
        ) : null}
      </div>
      <div className={pointsFieldShell}>
        <span className={fieldLabelClass}>Sell Amount</span>
        {bdtReadCell(displaySellBlend(row))}
        {!row.liveZones ? (
          <span className="text-[15px] font-normal leading-snug text-zinc-50">
            Saved value (no live DSE row)
          </span>
        ) : null}
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
        <span className={fieldLabelClass}>Buy Amount</span>
        {bdtReadCell(displayFirstBuyZone(row))}
      </div>
      <div className={pointsFieldShell}>
        <span className={fieldLabelClass}>Sell Amount</span>
        {bdtReadCell(displaySellBlend(row))}
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

function rowMeetsClassFilter(r: LongTermHoldingRow, filter: WatchlistClassFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "CLASSIFIED") return r.classification === "BLUE" || r.classification === "GREEN";
  if (filter === "NONE") return r.classification === null;
  return r.classification === filter;
}

export function LongTermHoldingsTable({ rows }: { rows: LongTermHoldingRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, DraftCell>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
            disabled={editing}
            menu={{ items: classificationMenu(r) }}
          >
            <Button size="small" type="default" loading={classBusyId === r.id} disabled={editing}>
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
      title: "Buy / sell amounts & book overrides",
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
          {!editing ? (
            <Button type="default" size="middle" className="w-full sm:w-auto" onClick={beginEdit}>
              Edit table
            </Button>
          ) : (
            <>
              <Button type="primary" size="middle" className="w-full sm:w-auto" loading={saving} disabled={saving} onClick={() => void handleSave()}>
                Save changes
              </Button>
              <Button type="default" size="middle" className="w-full sm:w-auto" disabled={saving} onClick={cancelEdit}>
                Cancel
              </Button>
            </>
          )}
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
      {saveError ? (
        <Alert type="error" showIcon className="mb-3" title="Could not save" description={saveError} />
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
