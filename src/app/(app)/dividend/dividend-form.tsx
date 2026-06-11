"use client";

import { AppSectionTitle } from "@/components/app-page-header";
import { Alert, AutoComplete, Button, Card, DatePicker, Input, InputNumber } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { createDividend } from "../dividend-actions";

export function DividendForm({
  instruments,
  instrumentsError,
}: {
  instruments: { symbol: string }[];
  instrumentsError: string | null;
}) {
  const [symbol, setSymbol] = useState("");
  const [cash, setCash] = useState<number | null>(null);
  const [stockShares, setStockShares] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [occurredOn, setOccurredOn] = useState<Dayjs | null>(dayjs());

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const symbolOptions = useMemo(
    () => instruments.map((i) => ({ value: i.symbol })),
    [instruments],
  );

  const resetForm = useCallback(() => {
    setSymbol("");
    setCash(null);
    setStockShares(null);
    setNote("");
    setOccurredOn(dayjs());
  }, []);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setSaveOk(false);

    const sym = symbol.trim().toUpperCase();
    if (!sym) {
      setSaveError("Select a stock.");
      return;
    }
    const cashAmt = cash ?? 0;
    const stockAmt = stockShares ?? 0;
    if (!(cashAmt > 0) && !(stockAmt > 0)) {
      setSaveError("Enter a cash dividend, a stock dividend, or both.");
      return;
    }

    setSaving(true);
    try {
      const res = await createDividend({
        symbol: sym,
        cashDividend: cashAmt,
        stockDividendShares: stockAmt,
        note,
        occurredOn: occurredOn ? occurredOn.format("YYYY-MM-DD") : null,
      });
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      setSaveOk(true);
      resetForm();
      setTimeout(() => setSaveOk(false), 3000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [symbol, cash, stockShares, note, occurredOn, resetForm]);

  return (
    <div className="space-y-5">
      <AppSectionTitle>Dividends</AppSectionTitle>

      <Card variant="outlined" className="rounded-xl" styles={{ body: { padding: "20px 24px" } }}>
        <div className="space-y-4">
          <div>
            <label className="block text-[14px] text-[var(--ink-strong)]">Stock</label>
            {instrumentsError ? (
              <p className="mt-1 text-[12px] text-[var(--warn-700)]">
                Symbol list offline — type the trading code manually.
              </p>
            ) : null}
            <AutoComplete
              value={symbol}
              onChange={(v) => {
                setSymbol(typeof v === "string" ? v : "");
                setSaveError(null);
                setSaveOk(false);
              }}
              onSelect={(v) => setSymbol(typeof v === "string" ? v.toUpperCase() : "")}
              options={symbolOptions}
              placeholder="Type or choose a trading code (e.g. BATBC)"
              filterOption={(input, option) =>
                String(option?.value ?? "")
                  .toUpperCase()
                  .includes(input.trim().toUpperCase())
              }
              size="large"
              className="mt-2 w-full font-mono"
              popupMatchSelectWidth={false}
              dropdownStyle={{ minWidth: 220, maxHeight: 300, overflow: "auto", fontFamily: "monospace" }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[14px] text-[var(--ink-strong)]">
                Cash dividend (BDT)
              </label>
              <InputNumber
                value={cash}
                onChange={(v) => {
                  setCash(typeof v === "number" ? v : null);
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
                Stock dividend (bonus shares)
              </label>
              <InputNumber
                value={stockShares}
                onChange={(v) => {
                  setStockShares(typeof v === "number" ? v : null);
                  setSaveError(null);
                  setSaveOk(false);
                }}
                placeholder="0"
                min={0}
                step={1}
                size="large"
                className="mt-2 w-full rounded-md"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[14px] text-[var(--ink-strong)]">Date</label>
              <DatePicker
                value={occurredOn}
                onChange={(d) => setOccurredOn(d)}
                size="large"
                className="mt-2 w-full rounded-md"
                allowClear={false}
              />
            </div>

            <div>
              <label className="block text-[14px] text-[var(--ink-strong)]">
                Note (optional)
              </label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. FY2025 final dividend"
                size="large"
                className="mt-2 rounded-md"
                maxLength={200}
              />
            </div>
          </div>

          <Button
            type="primary"
            size="large"
            loading={saving}
            disabled={saving}
            onClick={() => void handleSave()}
          >
            Save dividend
          </Button>

          {saveError && <Alert type="error" showIcon message="Error" description={saveError} />}
          {saveOk && (
            <Alert type="success" showIcon message="Saved" description="Dividend recorded." />
          )}
        </div>
      </Card>
    </div>
  );
}
