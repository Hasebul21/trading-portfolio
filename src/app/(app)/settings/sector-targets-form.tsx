"use client";

import {
    saveSectorTargets,
    type SectorTargetWithCurrent,
} from "@/app/(app)/sector-target-actions";
import {
    SECTOR_TARGET_MAX_ROWS,
    sectorMatchKey,
} from "@/lib/sector-targets";
import { Alert, Button, Card, Input, InputNumber } from "antd";
import { useCallback, useMemo, useState } from "react";

type DraftRow = {
    /** Stable key for React; preserves identity across edits. */
    key: string;
    sector: string;
    /** Empty string = "no target" (will be deleted on save). */
    target: string;
    /** From server — null when this row was added in the form. */
    current_percent: number | null;
    has_position: boolean;
};

function rowKey(seed: string): string {
    return `${seed}::${Math.random().toString(36).slice(2, 9)}`;
}

function fromServer(rows: SectorTargetWithCurrent[]): DraftRow[] {
    return rows.map((r) => ({
        key: rowKey(r.sector),
        sector: r.sector,
        target: r.target_percent === null ? "" : String(r.target_percent),
        current_percent: r.has_position ? r.current_percent : null,
        has_position: r.has_position,
    }));
}

function fmtPct(n: number): string {
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export function SectorTargetsForm({
    initialRows,
}: {
    initialRows: SectorTargetWithCurrent[];
}) {
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

    const setTarget = useCallback((key: string, value: string) => {
        setError(null);
        setOk(false);
        setDraft((prev) =>
            prev.map((row) => (row.key === key ? { ...row, target: value } : row)),
        );
    }, []);

    const setSector = useCallback((key: string, value: string) => {
        setError(null);
        setOk(false);
        setDraft((prev) =>
            prev.map((row) =>
                row.key === key ? { ...row, sector: value } : row,
            ),
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
        if (draft.length >= SECTOR_TARGET_MAX_ROWS) return;
        setDraft((prev) => [
            ...prev,
            {
                key: rowKey("new"),
                sector: "",
                target: "",
                current_percent: null,
                has_position: false,
            },
        ]);
    }, [draft.length]);

    const handleSave = useCallback(async () => {
        setError(null);
        setOk(false);

        // Build payload: drop blanks, validate locally for fast feedback.
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
            if (targetStr === "") {
                continue;
            }
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
            if (!res.ok) {
                setError(res.error);
            } else {
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
        <Card
            variant="outlined"
            className="rounded-xl border-teal-200/50 bg-white/75 shadow-sm dark:border-teal-900/35 dark:bg-zinc-900/65"
            styles={{ body: { padding: "16px 24px" } }}
        >
            <div className="space-y-4">
                <div>
                    <h3 className="text-[15px] font-medium text-zinc-900 dark:text-zinc-50">
                        Sector target allocation
                    </h3>
                    <p className="mt-1 text-[13px] font-normal text-zinc-600 dark:text-zinc-400">
                        Set the % of your portfolio you want in each sector. The
                        Allocation page will show these targets next to your current
                        weights so you can see drift at a glance. Leave the target
                        blank to remove it.
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[28rem] text-left text-[13px]">
                        <thead>
                            <tr className="text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                                <th className="py-2 font-normal">Sector</th>
                                <th className="py-2 text-right font-normal">Current</th>
                                <th className="py-2 text-right font-normal">
                                    Target&nbsp;%
                                </th>
                                <th className="py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {draft.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="py-4 text-center text-[13px] text-zinc-500 dark:text-zinc-400"
                                    >
                                        No sectors yet. Add one below to set a target.
                                    </td>
                                </tr>
                            ) : null}
                            {draft.map((row) => (
                                <tr
                                    key={row.key}
                                    className="border-t border-zinc-200/60 dark:border-zinc-800/70"
                                >
                                    <td className="py-1.5 pr-2 align-middle">
                                        {row.has_position ? (
                                            <span className="text-[14px] font-normal text-zinc-900 dark:text-zinc-50">
                                                {row.sector}
                                            </span>
                                        ) : (
                                            <Input
                                                value={row.sector}
                                                onChange={(e) =>
                                                    setSector(row.key, e.target.value)
                                                }
                                                placeholder="Sector name"
                                                size="middle"
                                                className="rounded-md"
                                                maxLength={80}
                                            />
                                        )}
                                    </td>
                                    <td className="py-1.5 pr-2 text-right align-middle tabular-nums text-zinc-700 dark:text-zinc-200">
                                        {row.current_percent === null
                                            ? "—"
                                            : fmtPct(row.current_percent)}
                                    </td>
                                    <td className="py-1.5 pr-2 align-middle">
                                        <InputNumber
                                            value={
                                                row.target === ""
                                                    ? null
                                                    : Number(row.target)
                                            }
                                            onChange={(val) =>
                                                setTarget(
                                                    row.key,
                                                    val === null || val === undefined
                                                        ? ""
                                                        : String(val),
                                                )
                                            }
                                            placeholder="—"
                                            min={0}
                                            max={100}
                                            step={1}
                                            size="middle"
                                            className="w-full max-w-[7.5rem] rounded-md"
                                            controls
                                            addonAfter="%"
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
                        disabled={draft.length >= SECTOR_TARGET_MAX_ROWS}
                    >
                        + Add sector
                    </Button>
                    <div
                        className={`text-[13px] font-medium tabular-nums ${
                            sumStatus === "ok"
                                ? "text-emerald-700 dark:text-emerald-300"
                                : sumStatus === "over"
                                  ? "text-red-700 dark:text-red-300"
                                  : "text-amber-700 dark:text-amber-300"
                        }`}
                    >
                        Total target:&nbsp;{fmtPct(sumPercent)}
                        {sumStatus === "over"
                            ? " (over 100%)"
                            : sumStatus === "under"
                              ? " (under 100%)"
                              : ""}
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
                        Save targets
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
                        description="Sector targets updated. The Allocation page will reflect them on next load."
                    />
                ) : null}
            </div>
        </Card>
    );
}
