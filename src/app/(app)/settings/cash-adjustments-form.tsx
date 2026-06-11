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

type Kind = "add" | "deduct";

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

  const [kind, setKind] = useState<Kind>("add");
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

  const amountNum = Number(amount.replace(/,/g, ""));
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
        kind,
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
  }, [amountValid, amountNum, kind, note, occurredOn, refresh]);

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
          tone="acc"
          icon={Icons.cash()}
          title="Add or deduct money"
          desc="Positive entries add to the Unrealized P/L on the Portfolio page (e.g. dividends, refunds). Negative entries deduct (e.g. withdrawals). Each entry flows into your Net Gain/Loss."
        />
        <SCardBody>
          <div className="field">
            <label className="lbl">Type</label>
            <div className="seg">
              <button data-on="add" className={kind === "add" ? "active" : ""} onClick={() => setKind("add")}>
                Add
              </button>
              <button data-on="deduct" className={kind === "deduct" ? "active" : ""} onClick={() => setKind("deduct")}>
                Deduct
              </button>
            </div>
          </div>

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
              placeholder="e.g. Cash dividend from GP"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="btn-row">
            <button
              className={`btn ${kind === "add" ? "btn-gain" : "btn-danger"}`}
              disabled={saving || !amountValid}
              onClick={() => void handleSave()}
            >
              {saving ? "Saving…" : kind === "add" ? "Add to Unrealized P/L" : "Deduct from Unrealized P/L"}
            </button>
          </div>

          {saveError ? <SErr>{saveError}</SErr> : null}
          {saveOk ? <SOk>Entry recorded.</SOk> : null}
        </SCardBody>
      </SCard>

      <SCard>
        <SCardHead
          tone="acc"
          icon={Icons.history()}
          title="History"
          right={
            <span className="total">
              Net adjustments:{" "}
              <b className={total >= 0 ? "ok" : "over"}>{fmtSigned(total)}</b>
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
                    <div className="empty-row">No adjustments yet.</div>
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
