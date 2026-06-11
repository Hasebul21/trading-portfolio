"use client";

import { formatBdt } from "@/lib/format-bdt";
import { adjustPositionsBalance } from "../settings-actions";
import { useCallback, useState } from "react";
import { Icons, SCard, SCardBody, SCardHead, SErr, SOk } from "./settings-ui";

type Kind = "add" | "deduct";

export function PositionsCashForm({ initialBalance }: { initialBalance: number }) {
  const [balance, setBalance] = useState<number>(initialBalance);
  const [kind, setKind] = useState<Kind>("add");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const amountNum = Number(amount.replace(/,/g, ""));
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;

  const handleSave = useCallback(async () => {
    setError(null);
    setOk(false);
    if (!amountValid) {
      setError("Enter a positive amount.");
      return;
    }
    setSaving(true);
    try {
      const res = await adjustPositionsBalance({ amount: amountNum, kind });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBalance(res.balance);
      setAmount("");
      setOk(true);
      setTimeout(() => setOk(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [amountValid, amountNum, kind]);

  return (
    <SCard>
      <SCardHead
        tone="gain"
        icon={Icons.positions()}
        title="Positions available amount"
        desc="The cash pool shown on the Positions page. Top up here; buy/sell marks move it automatically. Independent of Cash adjustments and Net Gain/Loss."
        right={
          <span className="total">
            Balance: <b style={{ color: "var(--ink-strong)" }}>৳{formatBdt(balance)}</b>
          </span>
        }
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

        <div className="field" style={{ marginBottom: 0, maxWidth: 320 }}>
          <label className="lbl">Amount (BDT)</label>
          <div className="inp-affix">
            <span className="affix">৳</span>
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
                setOk(false);
              }}
            />
          </div>
        </div>

        <div className="btn-row">
          <button
            className={`btn ${kind === "add" ? "btn-gain" : "btn-danger"}`}
            disabled={saving || !amountValid}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : kind === "add" ? "Add to total" : "Deduct from total"}
          </button>
        </div>

        {error ? <SErr>{error}</SErr> : null}
        {ok ? <SOk>Balance updated.</SOk> : null}
      </SCardBody>
    </SCard>
  );
}
