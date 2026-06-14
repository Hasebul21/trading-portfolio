"use client";

import { SymbolField, type SymbolFieldInstrument } from "@/components/symbol-field";
import { formatBdt, formatShares } from "@/lib/format-bdt";
import {
  planAmount,
  POSITION_BROKERAGES,
  type PositionBrokerage,
  type PositionPlanRow,
  type PositionSide,
} from "@/lib/positions";
import {
  addPositionPlan,
  deletePositionPlan,
  markPositionPlan,
  updatePositionPlan,
} from "@/app/(app)/positions-actions";
import { Alert, Button, Card, InputNumber, Popconfirm, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useMemo, useState } from "react";

const BROKERAGE_OPTIONS = POSITION_BROKERAGES.map((b) => ({ label: b, value: b }));

type Props = {
  initialBuy: PositionPlanRow[];
  initialSell: PositionPlanRow[];
  initialBalance: number;
  commissionRate: number | null;
  instruments: SymbolFieldInstrument[];
  instrumentsError: string | null;
};

export function PositionsView({
  initialBuy,
  initialSell,
  initialBalance,
  commissionRate,
  instruments,
  instrumentsError,
}: Props) {
  const [buy, setBuy] = useState<PositionPlanRow[]>(initialBuy);
  const [sell, setSell] = useState<PositionPlanRow[]>(initialSell);
  const [balance, setBalance] = useState<number>(initialBalance);

  const setRowsFor = useCallback((side: PositionSide) => (side === "buy" ? setBuy : setSell), []);

  const handleAdd = useCallback(
    async (
      side: PositionSide,
      symbol: string,
      quantity: number,
      price: number,
      brokerage: PositionBrokerage,
    ): Promise<{ ok: boolean; error?: string }> => {
      const res = await addPositionPlan({
        side,
        symbol,
        quantity_shares: quantity,
        target_price: price,
        brokerage,
      });
      if (!res.ok) return { ok: false, error: res.error };
      setRowsFor(side)((prev) => [...prev, res.row]);
      setBalance(res.balance);
      return { ok: true };
    },
    [setRowsFor],
  );

  const handleMark = useCallback(
    async (side: PositionSide, id: string) => {
      const res = await markPositionPlan(id);
      if (!res.ok) return;
      setRowsFor(side)((prev) =>
        prev.map((r) => (r.id === id ? { ...r, executed: true } : r)),
      );
    },
    [setRowsFor],
  );

  const handleDelete = useCallback(
    async (side: PositionSide, id: string) => {
      const res = await deletePositionPlan(id);
      if (!res.ok) return;
      setBalance(res.balance);
      setRowsFor(side)((prev) => prev.filter((r) => r.id !== id));
    },
    [setRowsFor],
  );

  const handleReorder = useCallback(
    (side: PositionSide, id: string, direction: "up" | "down") => {
      setRowsFor(side)((prev) => {
        const idx = prev.findIndex((r) => r.id === id);
        if (idx === -1) return prev;
        if (direction === "up" && idx === 0) return prev;
        if (direction === "down" && idx === prev.length - 1) return prev;

        const newIdx = direction === "up" ? idx - 1 : idx + 1;
        const newRows = [...prev];
        [newRows[idx], newRows[newIdx]] = [newRows[newIdx], newRows[idx]];
        return newRows;
      });
    },
    [setRowsFor],
  );

  const handleUpdate = useCallback(
    async (
      side: PositionSide,
      id: string,
      symbol: string,
      quantity: number,
      price: number,
      brokerage: PositionBrokerage,
    ): Promise<{ ok: boolean; error?: string }> => {
      const res = await updatePositionPlan({
        id,
        symbol,
        quantity_shares: quantity,
        target_price: price,
        brokerage,
      });
      if (!res.ok) return { ok: false, error: res.error };
      setRowsFor(side)((prev) => prev.map((r) => (r.id === id ? res.row : r)));
      setBalance(res.balance);
      return { ok: true };
    },
    [setRowsFor],
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card variant="outlined" className="rounded-xl" styles={{ body: { padding: "18px 24px" } }}>
        <div>
          <p className="text-[12px] uppercase tracking-wide text-[var(--ink-muted)]">
            Total available amount
          </p>
          <p
            className={`mt-1 text-[24px] tabular-nums ${
              balance >= 0 ? "text-[var(--ink-strong)]" : "text-[var(--loss-700)]"
            }`}
          >
            ৳ {formatBdt(balance)}
          </p>
        </div>
      </Card>

      <PlanSection
        side="buy"
        title="Buy plan"
        rows={buy}
        balance={balance}
        commissionRate={commissionRate}
        instruments={instruments}
        instrumentsError={instrumentsError}
        onAdd={handleAdd}
        onMark={handleMark}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onReorder={handleReorder}
      />

      <PlanSection
        side="sell"
        title="Sell plan"
        rows={sell}
        balance={balance}
        commissionRate={commissionRate}
        instruments={instruments}
        instrumentsError={instrumentsError}
        onAdd={handleAdd}
        onMark={handleMark}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onReorder={handleReorder}
      />
    </div>
  );
}

function PlanSection({
  side,
  title,
  rows,
  commissionRate,
  instruments,
  instrumentsError,
  onAdd,
  onMark,
  onUpdate,
  onDelete,
  onReorder,
}: {
  side: PositionSide;
  title: string;
  rows: PositionPlanRow[];
  balance: number;
  commissionRate: number | null;
  instruments: SymbolFieldInstrument[];
  instrumentsError: string | null;
  onAdd: (
    side: PositionSide,
    symbol: string,
    quantity: number,
    price: number,
    brokerage: PositionBrokerage,
  ) => Promise<{ ok: boolean; error?: string }>;
  onMark: (side: PositionSide, id: string) => void;
  onUpdate: (
    side: PositionSide,
    id: string,
    symbol: string,
    quantity: number,
    price: number,
    brokerage: PositionBrokerage,
  ) => Promise<{ ok: boolean; error?: string }>;
  onDelete: (side: PositionSide, id: string) => void;
  onReorder: (side: PositionSide, id: string, direction: "up" | "down") => void;
}) {
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [brokerage, setBrokerage] = useState<PositionBrokerage | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline row editing.
  const [editId, setEditId] = useState<string | null>(null);
  const [editSymbol, setEditSymbol] = useState("");
  const [editQty, setEditQty] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState<number | null>(null);
  const [editBrokerage, setEditBrokerage] = useState<PositionBrokerage | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const isBuy = side === "buy";

  const startEdit = useCallback((row: PositionPlanRow) => {
    setEditError(null);
    setEditId(row.id);
    setEditSymbol(row.symbol);
    setEditQty(row.quantity_shares);
    setEditPrice(row.target_price);
    setEditBrokerage(row.brokerage);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditId(null);
    setEditError(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (editId === null) return;
    setEditError(null);
    if (!editSymbol.trim()) {
      setEditError("Choose a stock.");
      return;
    }
    if (editQty === null || !(editQty > 0)) {
      setEditError("Enter a quantity.");
      return;
    }
    if (editPrice === null || !(editPrice > 0)) {
      setEditError("Enter a target price.");
      return;
    }
    if (!editBrokerage) {
      setEditError("Choose a brokerage house.");
      return;
    }
    setEditSaving(true);
    try {
      const res = await onUpdate(side, editId, editSymbol, editQty, editPrice, editBrokerage);
      if (!res.ok) {
        setEditError(res.error ?? "Could not update plan.");
        return;
      }
      setEditId(null);
    } finally {
      setEditSaving(false);
    }
  }, [editId, editSymbol, editQty, editPrice, editBrokerage, onUpdate, side]);

  const commissionPct = commissionRate ? (commissionRate * 100).toFixed(3).replace(/\.?0+$/, "") : null;

  // Live amount that will move the balance once this row is added.
  const previewAmount =
    quantity !== null && quantity > 0 && price !== null && price > 0
      ? planAmount(side, quantity, price, commissionRate)
      : null;

  const submit = useCallback(async () => {
    setError(null);
    if (!symbol.trim()) {
      setError("Choose a stock.");
      return;
    }
    if (quantity === null || !(quantity > 0)) {
      setError("Enter a quantity.");
      return;
    }
    if (price === null || !(price > 0)) {
      setError("Enter a target price.");
      return;
    }
    if (!brokerage) {
      setError("Choose a brokerage house.");
      return;
    }
    setSaving(true);
    try {
      const res = await onAdd(side, symbol, quantity, price, brokerage);
      if (!res.ok) {
        setError(res.error ?? "Could not add plan.");
        return;
      }
      setSymbol("");
      setQuantity(null);
      setPrice(null);
      setBrokerage(null);
    } finally {
      setSaving(false);
    }
  }, [onAdd, side, symbol, quantity, price, brokerage]);

  const total = useMemo(
    () =>
      rows
        .filter((r) => !r.executed)
        .reduce(
          (sum, r) => sum + planAmount(side, r.quantity_shares, r.target_price, commissionRate),
          0,
        ),
    [rows, side, commissionRate],
  );

  const columns: ColumnsType<PositionPlanRow> = [
    {
      title: "Stock",
      dataIndex: "symbol",
      render: (v: string, row) =>
        editId === row.id ? (
          <SymbolField
            instruments={instruments}
            loadError={instrumentsError}
            value={editSymbol}
            onValueChange={setEditSymbol}
            placeholder="Trading code"
            aria-label="Edit stock"
            size="sm"
          />
        ) : (
          <span
            className={`font-mono text-[13px] sm:text-[14px] ${
              row.executed ? "text-[var(--ink-muted)] line-through" : "text-[var(--ink-strong)]"
            }`}
          >
            {v}
          </span>
        ),
    },
    {
      title: "Qty",
      dataIndex: "quantity_shares",
      align: "right",
      width: 70,
      className: "hidden sm:table-cell",
      render: (v: number, row) =>
        editId === row.id ? (
          <InputNumber
            value={editQty}
            onChange={(val) => setEditQty(typeof val === "number" ? val : null)}
            min={0}
            step={1}
            size="small"
            className="w-full"
          />
        ) : (
          <span
            className={`tabular-nums text-[13px] sm:text-[14px] ${
              row.executed ? "text-[var(--ink-muted)] line-through" : "text-[var(--ink-strong)]"
            }`}
          >
            {formatShares(v)}
          </span>
        ),
    },
    {
      title: "Target price",
      dataIndex: "target_price",
      align: "right",
      width: 90,
      className: "hidden sm:table-cell",
      render: (v: number, row) =>
        editId === row.id ? (
          <InputNumber
            value={editPrice}
            onChange={(val) => setEditPrice(typeof val === "number" ? val : null)}
            min={0}
            step={0.1}
            size="small"
            className="w-full"
          />
        ) : (
          <span
            className={`tabular-nums text-[13px] sm:text-[14px] ${
              row.executed ? "text-[var(--ink-muted)] line-through" : "text-[var(--ink-strong)]"
            }`}
          >
            {formatBdt(v)}
          </span>
        ),
    },
    {
      title: isBuy ? "Cost" : "Proceeds",
      key: "amount",
      align: "right",
      width: 100,
      render: (_, row) => {
        const editing = editId === row.id;
        const amt = editing
          ? editQty !== null && editQty > 0 && editPrice !== null && editPrice > 0
            ? planAmount(side, editQty, editPrice, commissionRate)
            : null
          : planAmount(side, row.quantity_shares, row.target_price, commissionRate);
        return (
          <span
            className={`tabular-nums text-[13px] sm:text-[14px] ${
              row.executed
                ? "text-[var(--ink-muted)] line-through"
                : isBuy
                  ? "text-[var(--loss-700)]"
                  : "text-[var(--gain-700)]"
            }`}
          >
            {amt === null ? "—" : `${isBuy ? "−" : "+"}${formatBdt(amt)}`}
          </span>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 150,
      align: "right",
      render: (_, row, rowIndex) => {
        const isFirst = rowIndex === 0;
        const isLast = rowIndex === rows.length - 1;
        if (row.executed) {
          return <span className="text-[11px] sm:text-[12px] text-[var(--ink-muted)]">Done</span>;
        }
        if (editId === row.id) {
          return (
            <div className="flex items-center justify-end gap-0.5 sm:gap-1">
              <Button size="small" type="primary" loading={editSaving} onClick={() => void saveEdit()}>
                Save
              </Button>
              <Button size="small" type="text" disabled={editSaving} onClick={cancelEdit}>
                ✕
              </Button>
            </div>
          );
        }
        return (
          <div className="flex items-center justify-end gap-0.5 sm:gap-1">
            <Button
              size="small"
              type="text"
              disabled={editId !== null || isFirst}
              onClick={() => onReorder(side, row.id, "up")}
              className="!p-1 sm:!p-4"
              title="Move up"
            >
              ↑
            </Button>
            <Button
              size="small"
              type="text"
              disabled={editId !== null || isLast}
              onClick={() => onReorder(side, row.id, "down")}
              className="!p-1 sm:!p-4"
              title="Move down"
            >
              ↓
            </Button>
            <Button
              size="small"
              type="text"
              disabled={editId !== null}
              onClick={() => startEdit(row)}
              className="!p-1 sm:!p-4"
              title="Edit"
            >
              ✎
            </Button>
            <Button
              size="small"
              type="text"
              disabled={editId !== null}
              onClick={() => onMark(side, row.id)}
              className="!p-1 sm:!p-4 hidden sm:inline-block"
              title="Mark as done"
            >
              ✓
            </Button>
            <Popconfirm
              title="Remove this row?"
              description={`Its ${isBuy ? "cost" : "proceeds"} will be reversed from the total.`}
              okText="Remove"
              okButtonProps={{ danger: true }}
              cancelText="Cancel"
              onConfirm={() => onDelete(side, row.id)}
            >
              <Button
                size="small"
                type="text"
                danger
                disabled={editId !== null}
                className="!p-1 sm:!p-4"
                title="Remove"
              >
                ×
              </Button>
            </Popconfirm>
          </div>
        );
      },
    },
  ];

  return (
    <Card
      variant="outlined"
      className="rounded-xl"
      styles={{ body: { padding: "18px 20px" } }}
      title={
        <span className="text-[14px] text-[var(--ink-strong)]">{title}</span>
      }
      extra={
        <span className="text-[13px] tabular-nums text-[var(--ink-muted)]">
          {isBuy ? "Planned cost: " : "Planned proceeds: "}
          <span className={isBuy ? "text-[var(--loss-700)]" : "text-[var(--gain-700)]"}>
            {formatBdt(total)}
          </span>
        </span>
      }
    >
      <div className="space-y-4">
        <div className="grid items-end gap-2 grid-cols-1 sm:gap-3 sm:grid-cols-[1fr_140px_100px_110px_auto]">
          <div>
            <label className="block text-[13px] text-[var(--ink-strong)] mb-1">Stock</label>
            <SymbolField
              instruments={instruments}
              loadError={instrumentsError}
              value={symbol}
              onValueChange={(v) => {
                setSymbol(v);
                setError(null);
              }}
              placeholder="Trading code"
              aria-label={`${title} stock`}
            />
          </div>
          <div className="hidden sm:block">
            <label className="block text-[13px] text-[var(--ink-strong)] mb-1">Brokerage</label>
            <Select<PositionBrokerage>
              value={brokerage ?? undefined}
              onChange={(v) => {
                setBrokerage(v);
                setError(null);
              }}
              options={BROKERAGE_OPTIONS}
              placeholder="Choose"
              aria-label={`${title} brokerage`}
              className="w-full"
              size="small"
            />
          </div>
          <div>
            <label className="block text-[13px] text-[var(--ink-strong)] mb-1">Qty</label>
            <InputNumber
              value={quantity}
              onChange={(v) => {
                setQuantity(typeof v === "number" ? v : null);
                setError(null);
              }}
              min={0}
              step={1}
              placeholder="0"
              className="w-full rounded-md"
              size="small"
            />
          </div>
          <div>
            <label className="block text-[13px] text-[var(--ink-strong)] mb-1">Price</label>
            <InputNumber
              value={price}
              onChange={(v) => {
                setPrice(typeof v === "number" ? v : null);
                setError(null);
              }}
              min={0}
              step={0.1}
              placeholder="0.00"
              className="w-full rounded-md"
              size="small"
            />
          </div>
          <Button
            type="primary"
            loading={saving}
            disabled={saving}
            onClick={() => void submit()}
            className="sm:mt-0"
          >
            Add
          </Button>
        </div>

        <div className="block sm:hidden">
          <label className="block text-[13px] text-[var(--ink-strong)] mb-1">Brokerage</label>
          <Select<PositionBrokerage>
            value={brokerage ?? undefined}
            onChange={(v) => {
              setBrokerage(v);
              setError(null);
            }}
            options={BROKERAGE_OPTIONS}
            placeholder="Choose"
            aria-label={`${title} brokerage`}
            className="w-full"
            size="small"
          />
        </div>

        {error ? <Alert type="error" showIcon message={error} /> : null}
        {editError ? <Alert type="error" showIcon message={editError} /> : null}

        <Table<PositionPlanRow>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          pagination={false}
          size="small"
          locale={{ emptyText: isBuy ? "No buy plans yet." : "No sell plans yet." }}
        />
      </div>
    </Card>
  );
}
