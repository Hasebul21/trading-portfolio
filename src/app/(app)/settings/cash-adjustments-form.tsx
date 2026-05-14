"use client";

import { Alert, Button, Card, DatePicker, Input, InputNumber, Popconfirm, Radio, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useState, useTransition } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { formatBdt } from "@/lib/format-bdt";
import {
 createCashAdjustment,
 deleteCashAdjustment,
 listCashAdjustments,
 type CashAdjustmentRow,
} from "../settings-actions";

type Kind = "add" | "deduct";

function fmtSigned(n: number): string {
 const s = formatBdt(Math.abs(n));
 if (n > 0) return `+${s}`;
 if (n < 0) return `-${s}`;
 return s;
}

export function CashAdjustmentsForm({
 initialRows,
 initialTotal,
 initialError,
}: {
 initialRows: CashAdjustmentRow[];
 initialTotal: number;
 initialError: string | null;
}) {
 const [rows, setRows] = useState<CashAdjustmentRow[]>(initialRows);
 const [total, setTotal] = useState<number>(initialTotal);
 const [loadError, setLoadError] = useState<string | null>(initialError);

 const [kind, setKind] = useState<Kind>("add");
 const [amount, setAmount] = useState<number | null>(null);
 const [note, setNote] = useState("");
 const [occurredOn, setOccurredOn] = useState<Dayjs | null>(dayjs());

 const [saving, setSaving] = useState(false);
 const [saveError, setSaveError] = useState<string | null>(null);
 const [saveOk, setSaveOk] = useState(false);
 const [, startTransition] = useTransition();

 const refresh = useCallback(async () => {
 const res = await listCashAdjustments();
 if (res.ok) {
 setRows(res.rows);
 setTotal(res.total);
 setLoadError(null);
 } else {
 setLoadError(res.error);
 }
 }, []);

 const handleSave = useCallback(async () => {
 setSaveError(null);
 setSaveOk(false);
 if (amount === null || !(amount > 0)) {
 setSaveError("Enter a positive amount.");
 return;
 }
 setSaving(true);
 try {
 const res = await createCashAdjustment({
 amount,
 kind,
 note,
 occurredOn: occurredOn ? occurredOn.format("YYYY-MM-DD") : null,
 });
 if (!res.ok) {
 setSaveError(res.error);
 return;
 }
 setSaveOk(true);
 setAmount(null);
 setNote("");
 setOccurredOn(dayjs());
 startTransition(() => {
 void refresh();
 });
 setTimeout(() => setSaveOk(false), 3000);
 } catch (e) {
 setSaveError(e instanceof Error ? e.message : "Save failed");
 } finally {
 setSaving(false);
 }
 }, [amount, kind, note, occurredOn, refresh]);

 const handleDelete = useCallback(
 async (id: string) => {
 const res = await deleteCashAdjustment(id);
 if (!res.ok) {
 setLoadError(res.error);
 return;
 }
 await refresh();
 },
 [refresh],
 );

 const columns: ColumnsType<CashAdjustmentRow> = [
 {
 title: "Date",
 dataIndex: "occurred_on",
 width: 120,
 render: (v: string) => (
 <span className="text-[14px] tabular-nums text-[var(--ink-strong)]">{v}</span>
 ),
 },
 {
 title: "Amount",
 dataIndex: "amount_bdt",
 width: 140,
 align: "right",
 render: (v: number) => {
 const positive = v >= 0;
 return (
 <span
 className={`text-[14px] tabular-nums ${
 positive ? "text-[var(--gain-700)]" : "text-[var(--loss-700)]"
 }`}
 >
 {fmtSigned(v)}
 </span>
 );
 },
 },
 {
 title: "Note",
 dataIndex: "note",
 render: (v: string | null) => (
 <span className="text-[14px] text-[var(--ink-strong)]">{v ?? "—"}</span>
 ),
 },
 {
 title: "",
 key: "actions",
 width: 80,
 align: "right",
 render: (_, row) => (
 <Popconfirm
 title="Delete this entry?"
 description="It will be removed from your Net Gain/Loss."
 okText="Delete"
 okButtonProps={{ danger: true }}
 cancelText="Cancel"
 onConfirm={() => void handleDelete(row.id)}
 >
 <Button danger size="small" type="text">
 Delete
 </Button>
 </Popconfirm>
 ),
 },
 ];

 return (
 <div className="space-y-5">
 <Card
 variant="outlined"
 className="rounded-xl"
 styles={{ body: { padding: "20px 24px" } }}
 >
 <div className="space-y-4">
 <div>
 <h3 className="text-[14px] text-[var(--ink-strong)]">Add or deduct money</h3>
 <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
 Positive entries add to Net Gain/Loss (e.g. dividends, refunds).
 Negative entries deduct (e.g. withdrawals, external losses).
 </p>
 </div>

 <div>
 <label className="block text-[14px] text-[var(--ink-strong)]">
 Type
 </label>
 <Radio.Group
 className="mt-2"
 value={kind}
 onChange={(e) => setKind(e.target.value as Kind)}
 optionType="button"
 buttonStyle="solid"
 options={[
 { label: "Add", value: "add" },
 { label: "Deduct", value: "deduct" },
 ]}
 />
 </div>

 <div className="grid gap-4 sm:grid-cols-2">
 <div>
 <label className="block text-[14px] text-[var(--ink-strong)]">
 Amount (BDT)
 </label>
 <InputNumber
 value={amount}
 onChange={(v) => {
 setAmount(typeof v === "number" ? v : null);
 setSaveError(null);
 setSaveOk(false);
 }}
 placeholder="0.00"
 min={0}
 step={100}
 size="large"
 className="mt-2 w-full rounded-md"
 />
 </div>

 <div>
 <label className="block text-[14px] text-[var(--ink-strong)]">
 Date
 </label>
 <DatePicker
 value={occurredOn}
 onChange={(d) => setOccurredOn(d)}
 size="large"
 className="mt-2 w-full rounded-md"
 allowClear={false}
 />
 </div>
 </div>

 <div>
 <label className="block text-[14px] text-[var(--ink-strong)]">
 Note (optional)
 </label>
 <Input
 value={note}
 onChange={(e) => setNote(e.target.value)}
 placeholder="e.g. Cash dividend from XYZ"
 size="large"
 className="mt-2 rounded-md"
 maxLength={200}
 />
 </div>

 <Button
 type="primary"
 size="large"
 loading={saving}
 disabled={saving || amount === null || !(amount > 0)}
 onClick={() => void handleSave()}
 >
 {kind === "add" ? "Add to Net G/L" : "Deduct from Net G/L"}
 </Button>

 {saveError && <Alert type="error" showIcon message="Error" description={saveError} />}
 {saveOk && (
 <Alert type="success" showIcon message="Saved" description="Entry recorded." />
 )}
 </div>
 </Card>

 <Card
 variant="outlined"
 className="rounded-xl"
 styles={{ body: { padding: "20px 24px" } }}
 >
 <div className="space-y-3">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <h3 className="text-[14px] text-[var(--ink-strong)]">History</h3>
 <span className="text-[13px] text-[var(--ink-muted)]">
 Net adjustments:{" "}
 <span
 className={`tabular-nums ${
 total >= 0 ? "text-[var(--gain-700)]" : "text-[var(--loss-700)]"
 }`}
 >
 {fmtSigned(total)}
 </span>
 </span>
 </div>

 {loadError ? (
 <Alert type="error" showIcon message="Could not load adjustments" description={loadError} />
 ) : null}

 <Table<CashAdjustmentRow>
 rowKey="id"
 columns={columns}
 dataSource={rows}
 pagination={{ pageSize: 10, hideOnSinglePage: true }}
 size="small"
 locale={{ emptyText: "No adjustments yet." }}
 />
 </div>
 </Card>
 </div>
 );
}
