"use client";

import { formatBdt } from "@/lib/format-bdt";
import { adjustPositionsBalance } from "../settings-actions";
import { Alert, Button, Card, InputNumber, Radio } from "antd";
import { useCallback, useState } from "react";

type Kind = "add" | "deduct";

export function PositionsCashForm({ initialBalance }: { initialBalance: number }) {
  const [balance, setBalance] = useState<number>(initialBalance);
  const [kind, setKind] = useState<Kind>("add");
  const [amount, setAmount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const handleSave = useCallback(async () => {
    setError(null);
    setOk(false);
    if (amount === null || !(amount > 0)) {
      setError("Enter a positive amount.");
      return;
    }
    setSaving(true);
    try {
      const res = await adjustPositionsBalance({ amount, kind });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBalance(res.balance);
      setAmount(null);
      setOk(true);
      setTimeout(() => setOk(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [amount, kind]);

  return (
    <Card variant="outlined" className="rounded-xl" styles={{ body: { padding: "20px 24px" } }}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[14px] text-[var(--ink-strong)]">Positions available amount</h3>
            <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
              The cash pool shown on the Positions page. Top up here; buy/sell marks move it
              automatically. Independent of Cash adjustments and Net Gain/Loss.
            </p>
          </div>
          <span className="text-[18px] tabular-nums text-[var(--ink-strong)]">
            ৳ {formatBdt(balance)}
          </span>
        </div>

        <div>
          <label className="block text-[14px] text-[var(--ink-strong)]">Type</label>
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

        <div>
          <label className="block text-[14px] text-[var(--ink-strong)]">Amount (BDT)</label>
          <InputNumber
            value={amount}
            onChange={(v) => {
              setAmount(typeof v === "number" ? v : null);
              setError(null);
              setOk(false);
            }}
            placeholder="0.00"
            min={0}
            step={100}
            size="large"
            className="mt-2 w-full rounded-md"
          />
        </div>

        <Button
          type="primary"
          size="large"
          loading={saving}
          disabled={saving || amount === null || !(amount > 0)}
          onClick={() => void handleSave()}
        >
          {kind === "add" ? "Add to total" : "Deduct from total"}
        </Button>

        {error ? <Alert type="error" showIcon message="Error" description={error} /> : null}
        {ok ? <Alert type="success" showIcon message="Saved" description="Balance updated." /> : null}
      </div>
    </Card>
  );
}
