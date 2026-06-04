"use client";

import { saveSectorMonthlyInvestments } from "@/app/(app)/sector-investment-actions";
import { formatBdt } from "@/lib/format-bdt";
import {
  SECTOR_INVESTMENT_MAX_ROWS,
  type SectorInvestmentRow,
} from "@/lib/sector-investments";
import { DSE_SECTORS, sectorMatchKey } from "@/lib/sector-targets";
import { Alert, AutoComplete, Button, Card, InputNumber } from "antd";
import { useCallback, useMemo, useRef, useState } from "react";

type DraftRow = {
  /** Stable key for React; preserves identity across edits. */
  key: string;
  sector: string;
  /** Empty string = "no amount" (row dropped on save). */
  amount: string;
};

function fromServer(rows: SectorInvestmentRow[]): DraftRow[] {
  return rows.map((r, i) => ({
    key: r.sector || `row-${i}`,
    sector: r.sector,
    amount: r.amount_bdt === 0 ? "0" : String(r.amount_bdt),
  }));
}

export function SectorInvestmentsForm({
  initialRows,
}: {
  initialRows: SectorInvestmentRow[];
}) {
  const newRowSeq = useRef(0);
  const [draft, setDraft] = useState<DraftRow[]>(() => fromServer(initialRows));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const totalBdt = useMemo(() => {
    let s = 0;
    for (const row of draft) {
      const n = Number(row.amount);
      if (Number.isFinite(n) && n > 0) s += n;
    }
    return Math.round(s * 100) / 100;
  }, [draft]);

  // DSE sectors not already used by another row, so the dropdown never
  // suggests a duplicate. Free typing is still allowed for custom sectors.
  const sectorOptions = useMemo(() => {
    const used = new Set(draft.map((row) => sectorMatchKey(row.sector)));
    return DSE_SECTORS.filter((s) => !used.has(sectorMatchKey(s))).map((s) => ({
      value: s,
    }));
  }, [draft]);

  const setAmount = useCallback((key: string, value: string) => {
    setError(null);
    setOk(false);
    setDraft((prev) =>
      prev.map((row) => (row.key === key ? { ...row, amount: value } : row)),
    );
  }, []);

  const setSector = useCallback((key: string, value: string) => {
    setError(null);
    setOk(false);
    setDraft((prev) =>
      prev.map((row) => (row.key === key ? { ...row, sector: value } : row)),
    );
  }, []);

  const removeRow = useCallback((key: string) => {
    setError(null);
    setOk(false);
    setDraft((prev) => prev.filter((row) => row.key !== key));
  }, []);

  const addRow = useCallback(() => {
    setError(null);
    setOk(false);
    if (draft.length >= SECTOR_INVESTMENT_MAX_ROWS) return;
    const seq = ++newRowSeq.current;
    setDraft((prev) => [
      ...prev,
      { key: `new::${seq}`, sector: "", amount: "" },
    ]);
  }, [draft.length]);

  const handleSave = useCallback(async () => {
    setError(null);
    setOk(false);

    // Build payload: drop blanks, validate locally for fast feedback.
    const seen = new Set<string>();
    const payload: Array<{ sector: string; amount_bdt: number }> = [];
    for (const row of draft) {
      const sector = row.sector.trim();
      const amountStr = row.amount.trim();
      if (!sector && !amountStr) continue;
      if (!sector) {
        setError("Each row needs a sector name.");
        return;
      }
      const key = sectorMatchKey(sector);
      if (seen.has(key)) {
        setError(`Duplicate sector "${sector}".`);
        return;
      }
      seen.add(key);
      if (amountStr === "") continue;
      const n = Number(amountStr);
      if (!Number.isFinite(n) || n < 0) {
        setError(`${sector}: amount must be a non-negative number.`);
        return;
      }
      payload.push({ sector, amount_bdt: n });
    }

    setSaving(true);
    try {
      const res = await saveSectorMonthlyInvestments(payload);
      if (!res.ok) {
        setError(res.error);
      } else {
        setOk(true);
        setTimeout(() => setOk(false), 3000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save amounts.");
    } finally {
      setSaving(false);
    }
  }, [draft]);

  const handleReset = useCallback(() => {
    setError(null);
    setOk(false);
    setDraft(fromServer(initialRows));
  }, [initialRows]);

  return (
    <Card
      variant="outlined"
      className="rounded-xl"
      styles={{ body: { padding: "20px 24px" } }}
    >
      <div className="space-y-4">
        <div>
          <h3 className="text-[14px] text-[var(--ink-strong)]">
            Monthly investment by sector
          </h3>
          <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
            Plan how much you intend to invest in each sector every month (in
            BDT). The total below adds up your monthly plan. Leave an amount
            blank to remove that sector.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-[13px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                <th className="py-2 font-normal">Sector</th>
                <th className="py-2 text-right font-normal">Monthly&nbsp;(BDT)</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {draft.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="py-4 text-center text-[13px] text-[var(--ink-muted)]"
                  >
                    No sectors yet. Add one below to set a monthly amount.
                  </td>
                </tr>
              ) : null}
              {draft.map((row) => (
                <tr key={row.key} className="border-t border-[var(--line)]">
                  <td className="py-1.5 pr-2 align-middle">
                    <AutoComplete
                      value={row.sector}
                      onChange={(value) => setSector(row.key, value)}
                      options={sectorOptions}
                      placeholder="Sector name"
                      size="middle"
                      className="w-full rounded-md"
                      filterOption={(input, option) =>
                        String(option?.value ?? "")
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                    />
                  </td>
                  <td className="py-1.5 pr-2 align-middle">
                    <InputNumber
                      value={row.amount === "" ? null : Number(row.amount)}
                      onChange={(val) =>
                        setAmount(
                          row.key,
                          val === null || val === undefined
                            ? ""
                            : String(val),
                        )
                      }
                      placeholder="—"
                      min={0}
                      step={1000}
                      size="middle"
                      className="w-full max-w-[10rem] rounded-md"
                      controls
                      addonBefore="৳"
                    />
                  </td>
                  <td className="py-1.5 align-middle text-right">
                    <Button
                      type="link"
                      size="small"
                      danger
                      onClick={() => removeRow(row.key)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="dashed"
            size="middle"
            onClick={addRow}
            disabled={draft.length >= SECTOR_INVESTMENT_MAX_ROWS}
          >
            + Add sector
          </Button>
          <div className="text-[13px] tabular-nums text-[var(--ink-strong)]">
            Monthly total:&nbsp;৳{formatBdt(totalBdt)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="primary"
            size="large"
            loading={saving}
            disabled={saving}
            onClick={() => void handleSave()}
          >
            Save amounts
          </Button>
          <Button
            type="default"
            size="large"
            disabled={saving}
            onClick={handleReset}
          >
            Reset
          </Button>
        </div>

        {error ? (
          <Alert type="error" showIcon message="Could not save" description={error} />
        ) : null}
        {ok ? (
          <Alert
            type="success"
            showIcon
            message="Saved"
            description="Monthly investment amounts updated."
          />
        ) : null}
      </div>
    </Card>
  );
}
