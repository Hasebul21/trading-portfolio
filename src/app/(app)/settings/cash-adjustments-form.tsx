"use client";

import { formatBdt } from "@/lib/format-bdt";
import { useCallback, useState, useTransition } from "react";
import {
  createCashAdjustment,
  deleteCashAdjustment,
  listCashAdjustments,
  type CashAdjustmentRow,
} from "../settings-actions";
import { Icons, SCard, SCardBody, SCardHead, SErr, SOk } from "./settings-ui";

function fmtSigned(n: number): string {
  const s = `৳${formatBdt(Math.abs(n))}`;
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

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  // Default to today. toISOString is UTC on both server and client, so the
  // initial render matches and there is no hydration mismatch.
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));

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

  // Deductions are always money out — use the magnitude; the entry is recorded
  // as a negative amount on the server.
  const amountNum = Math.abs(Number(amount.replace(/,/g, "")));
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setSaveOk(false);
    if (!amountValid) {
      setSaveError("Enter a positive amount.");
      return;
    }
    setSaving(true);
    try {
      const res = await createCashAdjustment({
        amount: amountNum,
        kind: "deduct",
        note,
        occurredOn: occurredOn || null,
      });
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      setSaveOk(true);
      setAmount("");
      setNote("");
      startTransition(() => void refresh());
      setTimeout(() => setSaveOk(false), 3000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [amountValid, amountNum, note, occurredOn, refresh]);

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

  return (
    <>
      <SCard>
        <SCardHead
          tone="loss"
          icon={Icons.cash()}
          title="Record a deduction"
        />
        <SCardBody>
          <div className="grid2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="lbl">Amount (BDT)</label>
              <div className="inp-affix">
                <span className="affix">৳</span>
                <input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setSaveError(null);
                    setSaveOk(false);
                  }}
                />
              </div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="lbl">Date</label>
              <input
                className="inp mono"
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
              />
            </div>
          </div>

          <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
            <label className="lbl">Note (optional)</label>
            <input
              className="inp"
              type="text"
              placeholder="e.g. BO account renewal fee"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="btn-row">
            <button
              className="btn btn-danger"
              disabled={saving || !amountValid}
              onClick={() => void handleSave()}
            >
              {saving ? "Saving…" : "Deduct from Net P/L"}
            </button>
          </div>

          {saveError ? <SErr>{saveError}</SErr> : null}
          {saveOk ? <SOk>Deduction recorded.</SOk> : null}
        </SCardBody>
      </SCard>

      <SCard>
        <SCardHead
          tone="loss"
          icon={Icons.history()}
          title="History"
          right={
            <span className="total">
              Total deducted: <b className="over">{fmtSigned(total)}</b>
            </span>
          }
        />
        <SCardBody>
          {loadError ? <SErr>{loadError}</SErr> : null}
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th className="r">Amount</th>
                <th>Note</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-row">No deductions yet.</div>
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ color: "var(--ink-default)" }}>
                    {r.occurred_on}
                  </td>
                  <td
                    className="td-r mono"
                    style={{ color: r.amount_bdt >= 0 ? "var(--gain-700)" : "var(--loss-700)" }}
                  >
                    {fmtSigned(r.amount_bdt)}
                  </td>
                  <td style={{ color: "var(--ink-default)" }}>{r.note ?? "—"}</td>
                  <td className="td-r">
                    <button className="btn-link" onClick={() => void handleDelete(r.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SCardBody>
      </SCard>
    </>
  );
}
