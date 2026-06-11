"use client";

import { SymbolField, type SymbolFieldInstrument } from "@/components/symbol-field";
import { formatBdt, formatShares } from "@/lib/format-bdt";
import { planAmount, type PositionPlanRow, type PositionSide } from "@/lib/positions";
import {
  addPositionPlan,
  deletePositionPlan,
  markPositionPlan,
  updatePositionPlan,
} from "@/app/(app)/positions-actions";
import { Alert, Button, Card, InputNumber, Popconfirm, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useMemo, useState } from "react";

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
    ): Promise<{ ok: boolean; error?: string }> => {
      const res = await addPositionPlan({
        side,
        symbol,
        quantity_shares: quantity,
        target_price: price,
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

  const handleUpdate = useCallback(
    async (
      side: PositionSide,
      id: string,
      symbol: string,
      quantity: number,
      price: number,
    ): Promise<{ ok: boolean; error?: string }> => {
      const res = await updatePositionPlan({
        id,
        symbol,
        quantity_shares: quantity,
        target_price: price,
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
  ) => Promise<{ ok: boolean; error?: string }>;
  onMark: (side: PositionSide, id: string) => void;
  onUpdate: (
    side: PositionSide,
    id: string,
    symbol: string,
    quantity: number,
    price: number,
  ) => Promise<{ ok: boolean; error?: string }>;
  onDelete: (side: PositionSide, id: string) => void;
}) {
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline row editing.
  const [editId, setEditId] = useState<string | null>(null);
  const [editSymbol, setEditSymbol] = useState("");
  const [editQty, setEditQty] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const isBuy = side === "buy";

  const startEdit = useCallback((row: PositionPlanRow) => {
    setEditError(null);
    setEditId(row.id);
    setEditSymbol(row.symbol);
    setEditQty(row.quantity_shares);
    setEditPrice(row.target_price);
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
    setEditSaving(true);
    try {
      const res = await onUpdate(side, editId, editSymbol, editQty, editPrice);
      if (!res.ok) {
        setEditError(res.error ?? "Could not update plan.");
        return;
      }
      setEditId(null);
    } finally {
      setEditSaving(false);
    }
  }, [editId, editSymbol, editQty, editPrice, onUpdate, side]);

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
    setSaving(true);
    try {
      const res = await onAdd(side, symbol, quantity, price);
      if (!res.ok) {
        setError(res.error ?? "Could not add plan.");
        return;
      }
      setSymbol("");
      setQuantity(null);
      setPrice(null);
    } finally {
      setSaving(false);
    }
  }, [onAdd, side, symbol, quantity, price]);

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
            className={`font-mono text-[14px] ${
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
      width: 110,
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
            className={`tabular-nums text-[14px] ${
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
      width: 130,
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
            className={`tabular-nums text-[14px] ${
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
      width: 130,
      render: (_, row) => {
        const editing = editId === row.id;
        const amt = editing
          ? editQty !== null && editQty > 0 && editPrice !== null && editPrice > 0
            ? planAmount(side, editQty, editPrice, commissionRate)
            : null
          : planAmount(side, row.quantity_shares, row.target_price, commissionRate);
        return (
          <span
            className={`tabular-nums text-[14px] ${
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
      width: 250,
      align: "right",
      render: (_, row) => {
        if (row.executed) {
          return <span className="text-[12px] text-[var(--ink-muted)]">Done — clears on refresh</span>;
        }
        if (editId === row.id) {
          return (
            <div className="flex items-center justify-end gap-1">
              <Button size="small" type="primary" loading={editSaving} onClick={() => void saveEdit()}>
                Save
              </Button>
              <Button size="small" type="text" disabled={editSaving} onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
          );
        }
        return (
          <div className="flex items-center justify-end gap-1">
            <Button size="small" type="default" disabled={editId !== null} onClick={() => startEdit(row)}>
              Edit
            </Button>
            <Button size="small" type="default" disabled={editId !== null} onClick={() => onMark(side, row.id)}>
              Mark as done
            </Button>
            <Popconfirm
              title="Remove this row?"
              description={`Its ${isBuy ? "cost" : "proceeds"} will be reversed from the total.`}
              okText="Remove"
              okButtonProps={{ danger: true }}
              cancelText="Cancel"
              onConfirm={() => onDelete(side, row.id)}
            >
              <Button size="small" type="text" danger disabled={editId !== null}>
                Remove
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
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_120px_140px_auto]">
          <div>
            <label className="block text-[13px] text-[var(--ink-strong)]">Stock</label>
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
          <div>
            <label className="block text-[13px] text-[var(--ink-strong)]">Quantity</label>
            <InputNumber
              value={quantity}
              onChange={(v) => {
                setQuantity(typeof v === "number" ? v : null);
                setError(null);
              }}
              min={0}
              step={1}
              placeholder="0"
              className="mt-1 w-full rounded-md"
            />
          </div>
          <div>
            <label className="block text-[13px] text-[var(--ink-strong)]">Target price</label>
            <InputNumber
              value={price}
              onChange={(v) => {
                setPrice(typeof v === "number" ? v : null);
                setError(null);
              }}
              min={0}
              step={0.1}
              placeholder="0.00"
              className="mt-1 w-full rounded-md"
            />
          </div>
          <Button
            type="primary"
            loading={saving}
            disabled={saving}
            onClick={() => void submit()}
          >
            Add
          </Button>
        </div>

        <div className="flex min-h-[20px] flex-wrap items-center gap-x-2 text-[13px]">
          <span className="text-[var(--ink-muted)]">{isBuy ? "Cost to deduct:" : "Proceeds to add:"}</span>
          {previewAmount !== null ? (
            <span
              className={`tabular-nums ${isBuy ? "text-[var(--loss-700)]" : "text-[var(--gain-700)]"}`}
            >
              {isBuy ? "−" : "+"}৳{formatBdt(previewAmount)}
            </span>
          ) : (
            <span className="text-[var(--ink-faint)]">— enter quantity &amp; target price</span>
          )}
          {previewAmount !== null && commissionPct ? (
            <span className="text-[var(--ink-faint)]">
              (gross ৳{formatBdt(Math.round((quantity as number) * (price as number) * 100) / 100)} ·
              {" "}{commissionPct}% fee)
            </span>
          ) : null}
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
