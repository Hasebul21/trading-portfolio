"use client";

import { updateTopSectors } from "../settings-actions";
import { DSE_SECTORS } from "@/lib/sector-targets";
import { useCallback, useId, useMemo, useState, type KeyboardEvent } from "react";
import { Icons, SCard, SCardBody, SCardHead, SErr, SOk } from "./settings-ui";

const MAX_SECTORS = 8;

export function TopSectorsForm({
    initialSectors,
    suggestions,
}: {
    initialSectors: string[];
    suggestions: string[];
}) {
    const listId = useId().replace(/:/g, "");
    const [draft, setDraft] = useState<string[]>(() => normalize(initialSectors));
    const [input, setInput] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState(false);

    const options = useMemo(() => {
        const seen = new Set<string>();
        const merged: string[] = [];
        for (const s of [...DSE_SECTORS, ...suggestions]) {
            const label = String(s ?? "").trim();
            if (!label) continue;
            const key = label.toLowerCase();
            if (seen.has(key) || draft.some((d) => d.toLowerCase() === key)) continue;
            seen.add(key);
            merged.push(label);
        }
        merged.sort((a, b) => a.localeCompare(b));
        return merged;
    }, [suggestions, draft]);

    const addTag = useCallback(
        (raw: string) => {
            const label = raw.trim().replace(/\s+/g, " ");
            if (!label) return;
            setError(null);
            setOk(false);
            setDraft((prev) => {
                if (prev.length >= MAX_SECTORS) return prev;
                if (prev.some((d) => d.toLowerCase() === label.toLowerCase())) return prev;
                return [...prev, label];
            });
            setInput("");
        },
        [],
    );

    const removeTag = useCallback((label: string) => {
        setError(null);
        setOk(false);
        setDraft((prev) => prev.filter((d) => d !== label));
    }, []);

    const onKeyDown = useCallback(
        (e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag(input);
            } else if (e.key === "Backspace" && input === "" && draft.length > 0) {
                removeTag(draft[draft.length - 1]);
            }
        },
        [addTag, removeTag, input, draft],
    );

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
        setInput("");
        setDraft(normalize(initialSectors));
    }, [initialSectors]);

    const full = draft.length >= MAX_SECTORS;

    return (
        <SCard>
            <SCardHead
                tone="warn"
                icon={Icons.topsectors()}
                title="Top trending sectors"
                desc={`Pick up to ${MAX_SECTORS} sectors you want to keep an eye on. They appear as a reminder strip just below the navbar on every page.`}
            />
            <SCardBody>
                <div className="field">
                    <label className="lbl">Tracked sectors</label>
                    <div className="tagbox">
                        {draft.map((tag) => (
                            <span className="tag" key={tag}>
                                {tag}
                                <button title="Remove" onClick={() => removeTag(tag)}>
                                    ×
                                </button>
                            </span>
                        ))}
                        <input
                            className="tag-input"
                            list={`topsectors-${listId}`}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={onKeyDown}
                            onBlur={() => addTag(input)}
                            placeholder={full ? "Maximum reached" : "Type to add a sector…"}
                            disabled={full}
                            autoComplete="off"
                        />
                        <datalist id={`topsectors-${listId}`}>
                            {options.map((s) => (
                                <option key={s} value={s} />
                            ))}
                        </datalist>
                    </div>
                    <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
                        {draft.length} of {MAX_SECTORS} selected.
                    </p>
                </div>

                <div className="preview-strip">
                    <p className="pl">Preview · reminder strip</p>
                    <div className="pr">
                        {draft.length === 0 ? (
                            <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>Nothing tracked yet.</span>
                        ) : (
                            draft.map((s) => (
                                <span className="chip" key={s}>
                                    {s}
                                </span>
                            ))
                        )}
                    </div>
                </div>

                <div className="btn-row">
                    <button className="btn btn-primary" disabled={saving} onClick={() => void handleSave()}>
                        {saving ? "Saving…" : "Save top sectors"}
                    </button>
                    <button className="btn btn-default" disabled={saving} onClick={handleReset}>
                        Reset
                    </button>
                </div>

                {error ? <SErr>{error}</SErr> : null}
                {ok ? <SOk>Top sectors updated. The reminder strip will refresh on next page load.</SOk> : null}
            </SCardBody>
        </SCard>
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
