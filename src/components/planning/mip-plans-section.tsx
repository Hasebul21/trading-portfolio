"use client";

import {
  addMipPlan,
  deleteMipPlan,
  updateMipPlan,
} from "@/app/(app)/planning-actions";
import { SymbolField, type SymbolFieldInstrument } from "@/components/symbol-field";
import { formatBdt } from "@/lib/format-bdt";
import { tablePagination } from "@/lib/table-pagination";
import { Alert, Button, Popconfirm, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

export type MipPlanRow = {
  id: string;
  created_at: string;
  symbol: string;
  total_investment_plan_bdt: string | number;
};

type Row = MipPlanRow & { key: string };

const toolbarShell =
  "rounded-md border border-teal-200/60 bg-white/92 px-2 py-1 shadow-sm ring-1 ring-teal-500/5 dark:border-teal-900/45 dark:bg-zinc-900/85 dark:ring-teal-900/20";

const amountInputClass =
  "box-border h-9 w-full min-w-0 rounded border border-zinc-300/90 bg-white px-2 text-right text-[15px] font-normal tabular-nums text-zinc-900 outline-none ring-teal-500/30 focus:ring-1 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

export function MipPlansSection({
  rows,
  loadError,
  instruments,
  instrumentsError,
}: {
  rows: MipPlanRow[];
  loadError: string | null;
  instruments: SymbolFieldInstrument[];
  instrumentsError: string | null;
}) {
  const router = useRouter();
  const [addSymbol, setAddSymbol] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSymbol, setEditSymbol] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const data: Row[] = useMemo(
    () => rows.map((r) => ({ ...r, key: r.id })),
    [rows],
  );

  const beginEdit = useCallback((r: MipPlanRow) => {
    setEditingId(r.id);
    setEditSymbol(String(r.symbol).toUpperCase());
    setEditAmount(String(r.total_investment_plan_bdt));
    setEditError(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditSymbol("");
    setEditAmount("");
    setEditError(null);
  }, []);

  const handleAdd = useCallback(async () => {
    setAddError(null);
    setAdding(true);
    const fd = new FormData();
    fd.set("symbol", addSymbol.trim().toUpperCase());
    fd.set("total_investment_plan_bdt", addAmount.trim());
    const res = await addMipPlan(fd);
    setAdding(false);
    if (!res.ok) {
      setAddError(res.error);
      return;
    }
    setAddSymbol("");
    setAddAmount("");
    router.refresh();
  }, [addAmount, addSymbol, router]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    setEditError(null);
    setSavingEdit(true);
    const fd = new FormData();
    fd.set("id", editingId);
    fd.set("symbol", editSymbol.trim().toUpperCase());
    fd.set("total_investment_plan_bdt", editAmount.trim());
    const res = await updateMipPlan(fd);
    setSavingEdit(false);
    if (!res.ok) {
      setEditError(res.error);
      return;
    }
    cancelEdit();
    router.refresh();
  }, [cancelEdit, editAmount, editSymbol, editingId, router]);

  const columns: ColumnsType<Row> = useMemo(
    () => [
      {
        title: "Symbol",
        dataIndex: "symbol",
        align: "left",
        render: (v: string, record) =>
          editingId === record.id ? (
            <SymbolField
              instruments={instruments}
              loadError={instrumentsError}
              required
              name={`mip_edit_symbol_${record.id}`}
              aria-label="Symbol"
              placeholder="e.g. BATBC"
              size="sm"
              value={editSymbol}
              onValueChange={setEditSymbol}
              className="box-border h-9 w-full min-w-[6rem] max-w-[10rem] rounded border border-zinc-300/90 bg-white px-2 font-mono text-[15px] font-normal text-zinc-900 outline-none ring-teal-500/30 focus:ring-1 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
            />
          ) : (
            <Typography.Text strong className="font-mono">
              {String(v).toUpperCase()}
            </Typography.Text>
          ),
      },
      {
        title: "Total investment plan",
        key: "amount",
        align: "right",
        render: (_: unknown, record) =>
          editingId === record.id ? (
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              aria-label="Total investment plan"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              className={amountInputClass}
            />
          ) : (
            <span className="tabular-nums">{formatBdt(Number(record.total_investment_plan_bdt))}</span>
          ),
      },
      {
        title: "",
        key: "actions",
        align: "right",
        width: 200,
        render: (_: unknown, record) =>
          editingId === record.id ? (
            <div className="flex flex-wrap justify-end gap-1">
              <Button type="primary" size="small" loading={savingEdit} disabled={savingEdit} onClick={() => void handleSaveEdit()}>
                Save
              </Button>
              <Button type="default" size="small" disabled={savingEdit} onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-1">
              <Button type="default" size="small" onClick={() => beginEdit(record)}>
                Edit
              </Button>
              <Popconfirm
                title="Remove this row?"
                okText="Remove"
                okButtonProps={{ danger: true }}
                cancelText="Cancel"
                onConfirm={async () => {
                  const fd = new FormData();
                  fd.set("id", record.id);
                  await deleteMipPlan(fd);
                  router.refresh();
                }}
              >
                <Button type="link" danger size="small" className="p-0">
                  Remove
                </Button>
              </Popconfirm>
            </div>
          ),
      },
    ],
    [
      beginEdit,
      cancelEdit,
      editAmount,
      editSymbol,
      editingId,
      handleSaveEdit,
      instruments,
      instrumentsError,
      router,
      savingEdit,
    ],
  );

  return (
    <div className="flex min-w-0 flex-col gap-4 text-left">
      {loadError ? (
        <Typography.Paragraph type="danger" className="rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/40">
          {loadError}
        </Typography.Paragraph>
      ) : null}

      <div className={toolbarShell}>
        <div className="flex flex-col gap-2 p-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-2">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <label className="block text-[15px] font-normal text-zinc-600 dark:text-zinc-400">
              Share name
              <SymbolField
                instruments={instruments}
                loadError={instrumentsError}
                required
                aria-label="Share name (symbol)"
                placeholder="e.g. BATBC"
                size="sm"
                value={addSymbol}
                onValueChange={setAddSymbol}
                className="mt-1 box-border h-9 w-full rounded border border-zinc-300/90 bg-white px-2 font-mono text-[15px] font-normal text-zinc-900 outline-none ring-teal-500/30 focus:ring-1 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </label>
          </div>
          <label className="block min-w-0 sm:w-40">
            <span className="block text-[15px] font-normal text-zinc-600 dark:text-zinc-400">
              Total investment plan (BDT)
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              aria-label="Total investment plan"
              placeholder="0"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              className="mt-1 box-border h-9 w-full rounded border border-zinc-300/90 bg-white px-2 text-right text-[15px] font-normal tabular-nums text-zinc-900 outline-none ring-teal-500/30 focus:ring-1 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </label>
          <Button
            type="primary"
            size="middle"
            className="h-9 w-full shrink-0 sm:w-auto"
            loading={adding}
            disabled={adding}
            onClick={() => void handleAdd()}
          >
            Add
          </Button>
        </div>
        {addError ? (
          <Alert type="error" showIcon className="mx-2 mb-2 text-left" title={addError} />
        ) : null}
      </div>

      {editError ? (
        <Alert type="error" showIcon className="text-left" title={editError} />
      ) : null}

      {rows.length === 0 ? (
        <Typography.Paragraph type="secondary">No MIP rows yet. Add a symbol and amount above.</Typography.Paragraph>
      ) : (
        <Table<Row>
          className="w-full min-w-0"
          columns={columns}
          dataSource={data}
          scroll={{ x: "max-content" }}
          pagination={tablePagination("mip", { hideOnSinglePage: false, pageSize: 15 })}
          size="middle"
          bordered
        />
      )}
    </div>
  );
}
