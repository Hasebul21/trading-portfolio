"use client";

import { SymbolField, type SymbolFieldInstrument } from "@/components/symbol-field";
import { formatBdt, formatShares } from "@/lib/format-bdt";
import { planAmount, type PositionPlanRow, type PositionSide } from "@/lib/positions";
import {
  addPositionPlan,
  deletePositionPlan,
  markPositionPlan,
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

  const handleDelete = useCallback(
    async (side: PositionSide, id: string) => {
      const res = await deletePositionPlan(id);
      if (!res.ok) return;
      setBalance(res.balance);
      setRowsFor(side)((prev) => prev.filter((r) => r.id !== id));
    },
    [setRowsFor],
  );

  const handleMark = useCallback(
    async (side: PositionSide, id: string) => {
      const res = await markPositionPlan(id);
      if (!res.ok) return;
      setBalance(res.balance);
      setRowsFor(side)((prev) =>
        prev.map((r) => (r.id === id ? { ...r, executed: true } : r)),
      );
    },
    [setRowsFor],
  );

  const commissionPct = commissionRate ? (commissionRate * 100).toFixed(3).replace(/\.?0+$/, "") : null;

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card variant="outlined" className="rounded-xl" styles={{ body: { padding: "18px 24px" } }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
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
          <p className="max-w-[320px] text-[12px] leading-snug text-[var(--ink-muted)]">
            Adding a sell adds its proceeds to the total; adding a buy deducts its cost
            {commissionPct ? ` (incl. ${commissionPct}% commission)` : ""}. Removing a row reverses
            it. Top up from <span className="text-[var(--ink-strong)]">Settings → Positions cash</span>.
            Mark a done row to clear it on refresh.
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
        onDelete={handleDelete}
        onMark={handleMark}
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
        onDelete={handleDelete}
        onMark={handleMark}
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
  onDelete,
  onMark,
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
  onDelete: (side: PositionSide, id: string) => void;
  onMark: (side: PositionSide, id: string) => void;
}) {
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBuy = side === "buy";
  const markLabel = isBuy ? "Bought" : "Sold";

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
      render: (v: string, row) => (
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
      width: 90,
      render: (v: number, row) => (
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
      width: 120,
      render: (v: number, row) => (
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
        const amt = planAmount(side, row.quantity_shares, row.target_price, commissionRate);
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
            {isBuy ? "−" : "+"}
            {formatBdt(amt)}
          </span>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 160,
      align: "right",
      render: (_, row) =>
        row.executed ? (
          <span className="text-[12px] text-[var(--ink-muted)]">Marked — clears on refresh</span>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="small"
              type="primary"
              ghost={!isBuy}
              danger={isBuy}
              onClick={() => onMark(side, row.id)}
            >
              {markLabel}
            </Button>
            <Popconfirm
              title="Remove this row?"
              okText="Remove"
              okButtonProps={{ danger: true }}
              cancelText="Cancel"
              onConfirm={() => onDelete(side, row.id)}
            >
              <Button size="small" type="text" danger>
                Delete
              </Button>
            </Popconfirm>
          </div>
        ),
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
