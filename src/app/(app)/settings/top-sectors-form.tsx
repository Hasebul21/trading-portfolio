"use client";

import { updateTopSectors } from "../settings-actions";
import { DSE_SECTORS } from "@/lib/sector-targets";
import { Alert, Button, Card, Select } from "antd";
import { useCallback, useMemo, useState } from "react";

const MAX_SECTORS = 8;

export function TopSectorsForm({
    initialSectors,
    suggestions,
}: {
    initialSectors: string[];
    suggestions: string[];
}) {
    const [draft, setDraft] = useState<string[]>(() => normalize(initialSectors));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState(false);

    const options = useMemo(() => {
        const seen = new Set<string>();
        const merged: string[] = [];
        for (const s of [...DSE_SECTORS, ...suggestions, ...draft]) {
            const label = String(s ?? "").trim();
            if (!label) continue;
            const key = label.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(label);
        }
        merged.sort((a, b) => a.localeCompare(b));
        return merged.map((s) => ({ value: s, label: s }));
    }, [suggestions, draft]);

    const handleChange = useCallback((next: string[]) => {
        setError(null);
        setOk(false);
        const cleaned = normalize(next).slice(0, MAX_SECTORS);
        setDraft(cleaned);
    }, []);

    const handleSave = useCallback(async () => {
        setError(null);
        setOk(false);
        setSaving(true);
        try {
            const res = await updateTopSectors(draft);
            if (!res.ok) {
                setError(res.error);
                return;
            }
            setDraft(res.top_sectors);
            setOk(true);
            setTimeout(() => setOk(false), 3000);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save top sectors.");
        } finally {
            setSaving(false);
        }
    }, [draft]);

    const handleReset = useCallback(() => {
        setError(null);
        setOk(false);
        setDraft(normalize(initialSectors));
    }, [initialSectors]);

    return (
        <Card
            variant="outlined"
            className="rounded-xl"
            styles={{ body: { padding: "20px 24px" } }}
        >
            <div className="space-y-4">
                <div>
                    <h3 className="text-[14px] text-[var(--ink-strong)]">Top trending sectors</h3>
                    <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
                        Pick up to {MAX_SECTORS} sectors you want to keep an eye on. They
                        appear as a small reminder strip just below the navbar on every
                        page. Type to add a new one, or pick from your existing sector
                        targets.
                    </p>
                </div>

                <Select
                    mode="tags"
                    size="large"
                    value={draft}
                    onChange={handleChange}
                    options={options}
                    placeholder="e.g. Bank, Pharma & Chemicals"
                    tokenSeparators={[","]}
                    maxTagCount={MAX_SECTORS}
                    className="w-full"
                />

                <div className="text-[12px] text-[var(--ink-muted)]">
                    {draft.length} of {MAX_SECTORS} selected.
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button
                        type="primary"
                        size="large"
                        loading={saving}
                        disabled={saving}
                        onClick={() => void handleSave()}
                    >
                        Save top sectors
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
                        description="Top sectors updated. The reminder strip will refresh on next page load."
                    />
                ) : null}
            </div>
        </Card>
    );
}

function normalize(input: ReadonlyArray<string>): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of input) {
        const label = String(raw ?? "").trim().replace(/\s+/g, " ");
        if (!label) continue;
        const key = label.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(label);
    }
    return out;
}
