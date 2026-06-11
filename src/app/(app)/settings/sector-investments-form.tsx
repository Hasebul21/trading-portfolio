"use client";

import { saveSectorMonthlyInvestments } from "@/app/(app)/sector-investment-actions";
import { formatBdt } from "@/lib/format-bdt";
import {
  SECTOR_INVESTMENT_MAX_ROWS,
  type SectorInvestmentRow,
} from "@/lib/sector-investments";
import { DSE_SECTORS, sectorMatchKey } from "@/lib/sector-targets";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { Icons, SCard, SCardBody, SCardHead, SErr, SOk, SStat, SStats } from "./settings-ui";

type DraftRow = { key: string; sector: string; amount: string };

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
  const listId = useId().replace(/:/g, "");
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

  const maxAmount = useMemo(() => {
    let m = 1;
    for (const row of draft) {
      const n = Number(row.amount);
      if (Number.isFinite(n) && n > m) m = n;
    }
    return m;
  }, [draft]);

  const plannedCount = useMemo(
    () => draft.filter((r) => Number(r.amount) > 0).length,
    [draft],
  );

  const sectorOptions = useMemo(() => {
    const used = new Set(draft.map((row) => sectorMatchKey(row.sector)));
    return DSE_SECTORS.filter((s) => !used.has(sectorMatchKey(s)));
  }, [draft]);

  const setAmount = useCallback((key: string, value: string) => {
    setError(null);
    setOk(false);
    setDraft((prev) => prev.map((row) => (row.key === key ? { ...row, amount: value } : row)));
  }, []);

  const setSector = useCallback((key: string, value: string) => {
    setError(null);
    setOk(false);
    setDraft((prev) => prev.map((row) => (row.key === key ? { ...row, sector: value } : row)));
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
    setDraft((prev) => [...prev, { key: `new::${seq}`, sector: "", amount: "" }]);
  }, [draft.length]);

  const handleSave = useCallback(async () => {
    setError(null);
    setOk(false);

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
      if (!res.ok) setError(res.error);
      else {
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
    <>
      <SStats>
        <SStat k="Sectors planned" v={plannedCount} />
        <SStat k="Monthly total" v={`৳${formatBdt(totalBdt)}`} d="across all sectors" />
        <SStat k="Annualized" v={`৳${formatBdt(Math.round(totalBdt * 12 * 100) / 100)}`} d="at current plan" />
      </SStats>

      <SCard>
        <SCardHead
          tone="acc"
          icon={Icons.monthly()}
          title="Monthly investment by sector"
          desc="Plan how much you intend to invest in each sector every month, in BDT. The total below adds up your monthly plan. Leave an amount blank to remove that sector."
        />
        <SCardBody>
          <datalist id={`sectors-${listId}`}>
            {sectorOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <table className="tbl">
            <thead>
              <tr>
                <th>Sector</th>
                <th>Share of plan</th>
                <th className="r">Monthly&nbsp;(BDT)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {draft.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-row">No sectors yet. Add one below to set a monthly amount.</div>
                  </td>
                </tr>
              ) : null}
              {draft.map((row) => {
                const amt = Number(row.amount) || 0;
                const w = Math.min(100, (amt / maxAmount) * 100);
                return (
                  <tr key={row.key}>
                    <td>
                      <input
                        className="inp"
                        style={{ height: 34, maxWidth: 200 }}
                        list={`sectors-${listId}`}
                        value={row.sector}
                        onChange={(e) => setSector(row.key, e.target.value)}
                        placeholder="Sector name"
                        autoComplete="off"
                      />
                    </td>
                    <td style={{ width: "46%" }}>
                      <div className="bar">
                        <div className="bar-fill" style={{ width: `${w}%` }} />
                      </div>
                    </td>
                    <td className="td-r">
                      <div className="inp-affix num-inp" style={{ display: "inline-flex", width: 140 }}>
                        <span className="affix">৳</span>
                        <input
                          inputMode="decimal"
                          value={row.amount}
                          onChange={(e) => setAmount(row.key, e.target.value)}
                          placeholder="—"
                        />
                      </div>
                    </td>
                    <td className="td-r">
                      <button className="btn-link" onClick={() => removeRow(row.key)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="foot-row">
            <button className="btn-dashed" onClick={addRow} disabled={draft.length >= SECTOR_INVESTMENT_MAX_ROWS}>
              + Add sector
            </button>
            <div className="total">
              Monthly total: <b>৳{formatBdt(totalBdt)}</b>
            </div>
          </div>

          <div className="btn-row">
            <button className="btn btn-primary" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Saving…" : "Save amounts"}
            </button>
            <button className="btn btn-default" disabled={saving} onClick={handleReset}>
              Reset
            </button>
          </div>

          {error ? <SErr>{error}</SErr> : null}
          {ok ? <SOk>Monthly investment amounts updated.</SOk> : null}
        </SCardBody>
      </SCard>
    </>
  );
}
