"use client";

import {
    saveSectorTargets,
    type SectorTargetWithCurrent,
} from "@/app/(app)/sector-target-actions";
import {
    DSE_SECTORS,
    SECTOR_TARGET_MAX_ROWS,
    sectorMatchKey,
} from "@/lib/sector-targets";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { Icons, SCard, SCardBody, SCardHead, SErr, SOk, SStat, SStats } from "./settings-ui";

type DraftRow = {
    key: string;
    sector: string;
    target: string;
    current_percent: number | null;
    has_position: boolean;
};

function fromServer(rows: SectorTargetWithCurrent[]): DraftRow[] {
    return rows.map((r, i) => ({
        key: r.sector || `row-${i}`,
        sector: r.sector,
        target: r.target_percent === null ? "" : String(r.target_percent),
        current_percent: r.has_position ? r.current_percent : null,
        has_position: r.has_position,
    }));
}

function fmtPct(n: number): string {
    return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function driftState(cur: number | null, tgt: number): "on" | "over" | "under" {
    if (cur === null || cur === 0) return "under";
    const d = cur - tgt;
    if (Math.abs(d) <= 1.0) return "on";
    return d > 0 ? "over" : "under";
}

function driftLabel(cur: number | null, tgt: number): string {
    if (cur === null || cur === 0) return "not held";
    const d = cur - tgt;
    if (Math.abs(d) <= 1.0) return "on target";
    return `${d > 0 ? "+" : ""}${d.toFixed(1)}%`;
}

export function SectorTargetsForm({
    initialRows,
}: {
    initialRows: SectorTargetWithCurrent[];
}) {
    const newRowSeq = useRef(0);
    const listId = useId().replace(/:/g, "");
    const [draft, setDraft] = useState<DraftRow[]>(() => fromServer(initialRows));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState(false);

    const sumPercent = useMemo(() => {
        let s = 0;
        for (const row of draft) {
            const n = Number(row.target);
            if (Number.isFinite(n) && n > 0) s += n;
        }
        return Math.round(s * 100) / 100;
    }, [draft]);

    const sumStatus: "ok" | "under" | "over" =
        sumPercent > 100.01 ? "over" : sumPercent < 99.99 ? "under" : "ok";

    const heldCount = useMemo(() => draft.filter((r) => r.has_position).length, [draft]);

    const largestDrift = useMemo(() => {
        let best: { sector: string; d: number } | null = null;
        for (const r of draft) {
            if (r.current_percent === null) continue;
            const tgt = Number(r.target);
            if (!Number.isFinite(tgt)) continue;
            const d = r.current_percent - tgt;
            if (best === null || Math.abs(d) > Math.abs(best.d)) best = { sector: r.sector, d };
        }
        return best;
    }, [draft]);

    const scale = useMemo(() => {
        let m = 10;
        for (const r of draft) {
            if (r.current_percent !== null) m = Math.max(m, r.current_percent);
            const t = Number(r.target);
            if (Number.isFinite(t)) m = Math.max(m, t);
        }
        return m * 1.08;
    }, [draft]);

    const sectorOptions = useMemo(() => {
        const used = new Set(draft.map((row) => sectorMatchKey(row.sector)));
        return DSE_SECTORS.filter((s) => !used.has(sectorMatchKey(s)));
    }, [draft]);

    const setTarget = useCallback((key: string, value: string) => {
        setError(null);
        setOk(false);
        setDraft((prev) => prev.map((row) => (row.key === key ? { ...row, target: value } : row)));
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
        if (draft.length >= SECTOR_TARGET_MAX_ROWS) return;
        const seq = ++newRowSeq.current;
        setDraft((prev) => [
            ...prev,
            { key: `new::${seq}`, sector: "", target: "", current_percent: null, has_position: false },
        ]);
    }, [draft.length]);

    const handleSave = useCallback(async () => {
        setError(null);
        setOk(false);

        const seen = new Set<string>();
        const payload: Array<{ sector: string; target_percent: number }> = [];
        for (const row of draft) {
            const sector = row.sector.trim();
            const targetStr = row.target.trim();
            if (!sector && !targetStr) continue;
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
            if (targetStr === "") continue;
            const n = Number(targetStr);
            if (!Number.isFinite(n) || n < 0 || n > 100) {
                setError(`${sector}: target must be between 0 and 100.`);
                return;
            }
            payload.push({ sector, target_percent: n });
        }

        setSaving(true);
        try {
            const res = await saveSectorTargets(payload);
            if (!res.ok) setError(res.error);
            else {
                setOk(true);
                setTimeout(() => setOk(false), 3000);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save targets.");
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
                <SStat k="Sectors tracked" v={draft.length} d={`${heldCount} held · ${draft.length - heldCount} planned`} />
                <SStat
                    k="Total target"
                    v={fmtPct(sumPercent)}
                    tone={sumStatus === "ok" ? "gain" : sumStatus === "over" ? "loss" : undefined}
                    d={sumStatus === "ok" ? "Fully allocated" : sumStatus === "over" ? "Over 100%" : "Under 100%"}
                />
                <SStat
                    k="Largest drift"
                    v={largestDrift ? `${largestDrift.d > 0 ? "+" : ""}${largestDrift.d.toFixed(1)}%` : "—"}
                    tone={largestDrift ? (largestDrift.d > 0 ? "loss" : undefined) : undefined}
                    d={largestDrift ? `${largestDrift.sector} ${largestDrift.d > 0 ? "over" : "under"} target` : "No held sectors"}
                />
            </SStats>

            <SCard>
                <SCardHead tone="gain" icon={Icons.targets()} title="Sector target allocation" />
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
                                <th>Current vs. target</th>
                                <th className="r">Current</th>
                                <th className="r">Target&nbsp;%</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {draft.length === 0 ? (
                                <tr>
                                    <td colSpan={5}>
                                        <div className="empty-row">No sectors yet. Add one below to set a target.</div>
                                    </td>
                                </tr>
                            ) : null}
                            {draft.map((row) => {
                                const tgt = Number(row.target) || 0;
                                const st = driftState(row.current_percent, tgt);
                                const fillW = Math.min(100, ((row.current_percent ?? 0) / scale) * 100);
                                const markL = Math.min(100, (tgt / scale) * 100);
                                return (
                                    <tr key={row.key}>
                                        <td>
                                            {row.has_position ? (
                                                <span className="sec-name">
                                                    <span className="dot-pos" title="You hold this sector" />
                                                    {row.sector}
                                                </span>
                                            ) : (
                                                <input
                                                    className="inp"
                                                    style={{ height: 34, maxWidth: 200 }}
                                                    list={`sectors-${listId}`}
                                                    value={row.sector}
                                                    onChange={(e) => setSector(row.key, e.target.value)}
                                                    placeholder="Sector name"
                                                    autoComplete="off"
                                                />
                                            )}
                                        </td>
                                        <td style={{ width: "42%" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <div className="bar">
                                                    <div className={`bar-fill ${st}`} style={{ width: `${fillW}%` }} />
                                                    {tgt > 0 ? <div className="bar-mark" style={{ left: `${markL}%` }} /> : null}
                                                </div>
                                                <span className={`drift ${st}`}>{driftLabel(row.current_percent, tgt)}</span>
                                            </div>
                                        </td>
                                        <td className="td-r mono" style={{ color: "var(--ink-default)" }}>
                                            {row.current_percent === null ? "—" : `${row.current_percent.toFixed(1)}%`}
                                        </td>
                                        <td className="td-r">
                                            <div className="inp-affix num-inp" style={{ display: "inline-flex" }}>
                                                <input
                                                    inputMode="decimal"
                                                    value={row.target}
                                                    onChange={(e) => setTarget(row.key, e.target.value)}
                                                    placeholder="—"
                                                />
                                                <span className="affix after">%</span>
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
                        <button className="btn-dashed" onClick={addRow} disabled={draft.length >= SECTOR_TARGET_MAX_ROWS}>
                            + Add sector
                        </button>
                        <div className="total">
                            Total target: <b className={sumStatus === "ok" ? "ok" : sumStatus === "over" ? "over" : "under"}>{fmtPct(sumPercent)}</b>
                        </div>
                    </div>

                    <div className="btn-row">
                        <button className="btn btn-primary" disabled={saving} onClick={() => void handleSave()}>
                            {saving ? "Saving…" : "Save targets"}
                        </button>
                        <button className="btn btn-default" disabled={saving} onClick={handleReset}>
                            Reset
                        </button>
                    </div>

                    {error ? <SErr>{error}</SErr> : null}
                    {ok ? <SOk>Sector targets updated. The Allocation page will reflect them on next load.</SOk> : null}
                </SCardBody>
            </SCard>
        </>
    );
}
