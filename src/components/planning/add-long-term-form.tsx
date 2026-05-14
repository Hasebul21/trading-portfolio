"use client";

import { addLongTermHolding } from "@/app/(app)/planning-actions";
import type { SymbolFieldInstrument } from "@/components/symbol-field";
import { Alert, AutoComplete, Button } from "antd";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

export function AddLongTermForm({
    instruments,
    instrumentsError,
}: {
    instruments: SymbolFieldInstrument[];
    instrumentsError: string | null;
    toolbarShell?: string;
}) {
    const router = useRouter();
    const [symbol, setSymbol] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const symbolOptions = useMemo(
        () =>
            instruments
                .map((i) => i.symbol)
                .sort((a, b) => a.localeCompare(b))
                .map((s) => ({ value: s, label: s })),
        [instruments],
    );

    const submit = useCallback(async () => {
        const sym = symbol.trim().toUpperCase();
        if (!sym) {
            setError("Enter a DSE trading code.");
            return;
        }
        setBusy(true);
        setError(null);
        const fd = new FormData();
        fd.set("symbol", sym);
        const res = await addLongTermHolding(fd);
        setBusy(false);
        if (!res.ok) {
            setError(res.error);
            return;
        }
        setSymbol("");
        router.refresh();
    }, [router, symbol]);

    return (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] p-4 shadow-sm">
            <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                Add to watchlist
            </p>
            {instrumentsError ? (
                <p className="mb-2 text-[12px] text-[var(--warn-700)]">
                    Symbol list offline — type code manually.
                </p>
            ) : null}
            <div className="flex gap-2">
                <AutoComplete
                    value={symbol}
                    onChange={(v) => {
                        setSymbol(typeof v === "string" ? v : "");
                        setError(null);
                    }}
                    onSelect={(v) => setSymbol(typeof v === "string" ? v.toUpperCase() : "")}
                    options={symbolOptions}
                    placeholder="Symbol (e.g. BATBC)"
                    filterOption={(input, option) =>
                        String(option?.value ?? "")
                            .toUpperCase()
                            .includes(input.trim().toUpperCase())
                    }
                    className="flex-1 font-mono"
                    size="large"
                    popupMatchSelectWidth={false}
                    dropdownStyle={{ minWidth: 200, maxHeight: 300, overflow: "auto", fontFamily: "monospace" }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") void submit();
                    }}
                />
                <Button
                    type="primary"
                    size="large"
                    loading={busy}
                    onClick={() => void submit()}
                    className="shrink-0"
                >
                    Add
                </Button>
            </div>
            {error ? (
                <Alert type="error" showIcon className="mt-2 text-left" message={error} />
            ) : null}
        </div>
    );
}
