"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
    createBrokerageAccount,
    deleteBrokerageAccount,
    listBrokerageAccounts,
    updateBrokerageAccount,
    type BrokerageAccountInput,
    type BrokerageAccountRow,
} from "../settings-actions";
import { Icons, SCard, SCardBody, SCardHead, SErr, SOk } from "./settings-ui";

type Draft = {
    broker_name: string;
    account_type: string;
    bo_id: string;
    bo_name: string;
    client_code: string;
    bank_name: string;
    bank_account_name: string;
    bank_account_number: string;
    bank_routing_number: string;
    bank_branch: string;
    bank_address: string;
    rm_name: string;
    rm_phone: string;
    rm_email: string;
    notes: string;
};

function emptyDraft(): Draft {
    return {
        broker_name: "",
        account_type: "",
        bo_id: "",
        bo_name: "",
        client_code: "",
        bank_name: "",
        bank_account_name: "",
        bank_account_number: "",
        bank_routing_number: "",
        bank_branch: "",
        bank_address: "",
        rm_name: "",
        rm_phone: "",
        rm_email: "",
        notes: "",
    };
}

function rowToDraft(row: BrokerageAccountRow): Draft {
    return {
        broker_name: row.broker_name ?? "",
        account_type: row.account_type ?? "",
        bo_id: row.bo_id ?? "",
        bo_name: row.bo_name ?? "",
        client_code: row.client_code ?? "",
        bank_name: row.bank_name ?? "",
        bank_account_name: row.bank_account_name ?? "",
        bank_account_number: row.bank_account_number ?? "",
        bank_routing_number: row.bank_routing_number ?? "",
        bank_branch: row.bank_branch ?? "",
        bank_address: row.bank_address ?? "",
        rm_name: row.rm_name ?? "",
        rm_phone: row.rm_phone ?? "",
        rm_email: row.rm_email ?? "",
        notes: row.notes ?? "",
    };
}

function draftToInput(d: Draft): BrokerageAccountInput {
    const t = (s: string) => (s.trim() === "" ? null : s.trim());
    return {
        broker_name: d.broker_name.trim(),
        account_type: t(d.account_type),
        bo_id: t(d.bo_id),
        bo_name: t(d.bo_name),
        client_code: t(d.client_code),
        bank_name: t(d.bank_name),
        bank_account_name: t(d.bank_account_name),
        bank_account_number: t(d.bank_account_number),
        bank_routing_number: t(d.bank_routing_number),
        bank_branch: t(d.bank_branch),
        bank_address: t(d.bank_address),
        rm_name: t(d.rm_name),
        rm_phone: t(d.rm_phone),
        rm_email: t(d.rm_email),
        notes: t(d.notes),
    };
}

const PRESETS: Array<{ label: string; draft: Draft }> = [
    {
        label: "BRAC EPL Stock Brokerage Limited",
        draft: {
            ...emptyDraft(),
            broker_name: "BRAC EPL Stock Brokerage Limited",
            account_type: "Individual",
            bo_id: "1201820077658957",
            bo_name: "HASEBUL HASSAN CHOWDHURY",
            rm_name: "Sumaya",
            rm_phone: "01708805183",
        },
    },
    {
        label: "IDLC Securities Limited",
        draft: {
            ...emptyDraft(),
            broker_name: "IDLC Securities Limited",
            account_type: "Individual",
            bo_id: "1203680076925257",
            bo_name: "HASEBUL HASSAN CHOWDHURY",
            client_code: "OBO3742",
            bank_name: "BRAC Bank Limited",
            bank_account_number: "2017498700002",
            bank_routing_number: "060272531",
            bank_branch: "Graphics Building Branch",
            bank_address: "58 Motijheel C/A, Dhaka 1000",
            rm_name: "Ainura Mazumder",
            rm_phone: "+880 1730-728763",
            rm_email: "ainura@idlc.com",
        },
    },
    {
        label: "LankaBangla Securities PLC",
        draft: {
            ...emptyDraft(),
            broker_name: "LankaBangla Securities PLC",
            account_type: "Joint BO Account",
            bo_id: "1204240077534554",
            client_code: "E12297",
            bank_name: "Standard Chartered Bank",
            bank_account_name: "LANKABANGLA SECURITIES LIMITED",
            bank_account_number: "771080512297",
            bank_routing_number: "215274247",
            bank_branch: "Motijheel",
            rm_name: "Hannan",
            rm_phone: "+8801821-490120",
        },
    },
];

export function BrokerageAccountsForm({
    initialRows,
    initialError,
}: {
    initialRows: BrokerageAccountRow[];
    initialError: string | null;
}) {
    const [rows, setRows] = useState<BrokerageAccountRow[]>(initialRows);
    const [loadError, setLoadError] = useState<string | null>(initialError);
    const [, startTransition] = useTransition();

    const refresh = useCallback(async () => {
        const res = await listBrokerageAccounts();
        if (res.ok) {
            setRows(res.rows);
            setLoadError(null);
        } else {
            setLoadError(res.error);
        }
    }, []);

    const existingNames = useMemo(
        () => new Set(rows.map((r) => r.broker_name.trim().toLowerCase())),
        [rows],
    );

    const availablePresets = PRESETS.filter(
        (p) => !existingNames.has(p.draft.broker_name.trim().toLowerCase()),
    );

    const handleAddPreset = useCallback(
        async (draft: Draft) => {
            setLoadError(null);
            const res = await createBrokerageAccount(draftToInput(draft));
            if (!res.ok) {
                setLoadError(res.error);
                return;
            }
            startTransition(() => void refresh());
        },
        [refresh],
    );

    const handleAddBlank = useCallback(async () => {
        setLoadError(null);
        const res = await createBrokerageAccount({ broker_name: "New brokerage account" });
        if (!res.ok) {
            setLoadError(res.error);
            return;
        }
        startTransition(() => void refresh());
    }, [refresh]);

    return (
        <>
            <SCard>
                <SCardHead
                    tone="acc"
                    icon={Icons.cash()}
                    title="Brokerage accounts"
                    desc="Your BO accounts, deposit bank details, and relationship managers — all editable."
                />
                <SCardBody>
                    {loadError ? <SErr>{loadError}</SErr> : null}

                    {availablePresets.length > 0 ? (
                        <div className="field" style={{ marginBottom: 0 }}>
                            <label className="lbl">Add from your records</label>
                            <p className="hint">Prefilled with the info you provided. You can edit anything afterwards.</p>
                            <div className="btn-row" style={{ marginTop: 0 }}>
                                {availablePresets.map((p) => (
                                    <button
                                        key={p.label}
                                        className="btn-dashed"
                                        onClick={() => void handleAddPreset(p.draft)}
                                    >
                                        + {p.label}
                                    </button>
                                ))}
                                <button className="btn-dashed" onClick={() => void handleAddBlank()}>
                                    + Blank account
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="btn-row" style={{ marginTop: 0 }}>
                            <button className="btn-dashed" onClick={() => void handleAddBlank()}>
                                + Add brokerage account
                            </button>
                        </div>
                    )}
                </SCardBody>
            </SCard>

            {rows.length === 0 ? (
                <SCard>
                    <SCardBody>
                        <div className="empty-row" style={{ padding: 24 }}>
                            No brokerage accounts yet. Use the buttons above to add one.
                        </div>
                    </SCardBody>
                </SCard>
            ) : (
                rows.map((row) => (
                    <BrokerageCard
                        key={row.id}
                        row={row}
                        onSaved={(updated) => {
                            setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
                        }}
                        onDeleted={(id) => {
                            setRows((prev) => prev.filter((r) => r.id !== id));
                        }}
                    />
                ))
            )}
        </>
    );
}

function BrokerageCard({
    row,
    onSaved,
    onDeleted,
}: {
    row: BrokerageAccountRow;
    onSaved: (row: BrokerageAccountRow) => void;
    onDeleted: (id: string) => void;
}) {
    const [draft, setDraft] = useState<Draft>(() => rowToDraft(row));
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState(false);

    const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
        setDraft((d) => ({ ...d, [key]: value }));
        setError(null);
        setOk(false);
    }, []);

    const beginEdit = useCallback(() => {
        setDraft(rowToDraft(row));
        setEditing(true);
        setError(null);
        setOk(false);
    }, [row]);

    const cancelEdit = useCallback(() => {
        setDraft(rowToDraft(row));
        setEditing(false);
        setError(null);
        setOk(false);
    }, [row]);

    const save = useCallback(async () => {
        if (!draft.broker_name.trim()) {
            setError("Broker name is required.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const res = await updateBrokerageAccount(row.id, draftToInput(draft));
            if (!res.ok) {
                setError(res.error);
                return;
            }
            onSaved(res.row);
            setEditing(false);
            setOk(true);
            setTimeout(() => setOk(false), 2500);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSaving(false);
        }
    }, [draft, row.id, onSaved]);

    const doDelete = useCallback(async () => {
        setDeleting(true);
        setError(null);
        try {
            const res = await deleteBrokerageAccount(row.id);
            if (!res.ok) {
                setError(res.error);
                return;
            }
            onDeleted(row.id);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Delete failed");
        } finally {
            setDeleting(false);
        }
    }, [row.id, onDeleted]);

    return (
        <SCard>
            <SCardHead
                tone="acc"
                icon={Icons.cash()}
                title={row.broker_name || "Brokerage account"}
                desc={
                    [row.account_type, row.bo_id ? `BO #${row.bo_id}` : null, row.client_code ? `Client ${row.client_code}` : null]
                        .filter(Boolean)
                        .join(" • ") || "BO info, bank details, and relation manager."
                }
                right={
                    editing ? (
                        <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn btn-default" disabled={saving} onClick={cancelEdit}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" disabled={saving} onClick={() => void save()}>
                                {saving ? "Saving…" : "Save"}
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn btn-default" onClick={beginEdit}>
                                Edit
                            </button>
                            {confirmDelete ? (
                                <>
                                    <button
                                        className="btn btn-default"
                                        disabled={deleting}
                                        onClick={() => setConfirmDelete(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button className="btn btn-danger" disabled={deleting} onClick={() => void doDelete()}>
                                        {deleting ? "Removing…" : "Confirm remove"}
                                    </button>
                                </>
                            ) : (
                                <button className="btn btn-default" onClick={() => setConfirmDelete(true)}>
                                    Remove
                                </button>
                            )}
                        </div>
                    )
                }
            />
            <SCardBody>
                {editing ? (
                    <BrokerageEditor draft={draft} set={set} />
                ) : (
                    <BrokerageReadView row={row} />
                )}
                {error ? <SErr>{error}</SErr> : null}
                {ok ? <SOk>Brokerage account updated.</SOk> : null}
            </SCardBody>
        </SCard>
    );
}

function BrokerageEditor({
    draft,
    set,
}: {
    draft: Draft;
    set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
    return (
        <>
            <SectionLabel>Account</SectionLabel>
            <div className="grid2">
                <Field label="Broker name">
                    <input
                        className="inp"
                        value={draft.broker_name}
                        onChange={(e) => set("broker_name", e.target.value)}
                        placeholder="e.g. IDLC Securities Limited"
                    />
                </Field>
                <Field label="Account type">
                    <input
                        className="inp"
                        value={draft.account_type}
                        onChange={(e) => set("account_type", e.target.value)}
                        placeholder="Individual / Joint"
                    />
                </Field>
            </div>
            <div className="grid2" style={{ marginTop: 18 }}>
                <Field label="BO ID">
                    <input
                        className="inp mono"
                        value={draft.bo_id}
                        onChange={(e) => set("bo_id", e.target.value)}
                        placeholder="1201XXXXXXXXXXX"
                    />
                </Field>
                <Field label="BO name">
                    <input
                        className="inp"
                        value={draft.bo_name}
                        onChange={(e) => set("bo_name", e.target.value)}
                        placeholder="Name on the BO account"
                    />
                </Field>
            </div>
            <div className="field" style={{ marginTop: 18 }}>
                <label className="lbl">Client code</label>
                <input
                    className="inp mono"
                    style={{ maxWidth: 240 }}
                    value={draft.client_code}
                    onChange={(e) => set("client_code", e.target.value)}
                    placeholder="e.g. OBO3742"
                />
            </div>

            <div style={{ height: 18 }} />
            <SectionLabel>Deposit bank</SectionLabel>
            <div className="grid2">
                <Field label="Bank name">
                    <input
                        className="inp"
                        value={draft.bank_name}
                        onChange={(e) => set("bank_name", e.target.value)}
                        placeholder="e.g. BRAC Bank Limited"
                    />
                </Field>
                <Field label="Account name">
                    <input
                        className="inp"
                        value={draft.bank_account_name}
                        onChange={(e) => set("bank_account_name", e.target.value)}
                        placeholder="As registered with the bank"
                    />
                </Field>
            </div>
            <div className="grid2" style={{ marginTop: 18 }}>
                <Field label="Account number">
                    <input
                        className="inp mono"
                        value={draft.bank_account_number}
                        onChange={(e) => set("bank_account_number", e.target.value)}
                    />
                </Field>
                <Field label="Routing number">
                    <input
                        className="inp mono"
                        value={draft.bank_routing_number}
                        onChange={(e) => set("bank_routing_number", e.target.value)}
                    />
                </Field>
            </div>
            <div className="grid2" style={{ marginTop: 18 }}>
                <Field label="Branch">
                    <input
                        className="inp"
                        value={draft.bank_branch}
                        onChange={(e) => set("bank_branch", e.target.value)}
                    />
                </Field>
                <Field label="Branch address">
                    <input
                        className="inp"
                        value={draft.bank_address}
                        onChange={(e) => set("bank_address", e.target.value)}
                    />
                </Field>
            </div>

            <div style={{ height: 18 }} />
            <SectionLabel>Relation manager</SectionLabel>
            <div className="grid2">
                <Field label="Name">
                    <input
                        className="inp"
                        value={draft.rm_name}
                        onChange={(e) => set("rm_name", e.target.value)}
                    />
                </Field>
                <Field label="Phone">
                    <input
                        className="inp mono"
                        value={draft.rm_phone}
                        onChange={(e) => set("rm_phone", e.target.value)}
                    />
                </Field>
            </div>
            <div className="field" style={{ marginTop: 18 }}>
                <label className="lbl">Email</label>
                <input
                    className="inp"
                    type="email"
                    value={draft.rm_email}
                    onChange={(e) => set("rm_email", e.target.value)}
                    placeholder="rm@example.com"
                />
            </div>

            <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
                <label className="lbl">Notes</label>
                <textarea
                    className="inp"
                    value={draft.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    rows={3}
                    style={{ height: "auto", padding: "10px 12px", resize: "vertical", minHeight: 72 }}
                    placeholder="Anything else worth remembering"
                />
            </div>
        </>
    );
}

function BrokerageReadView({ row }: { row: BrokerageAccountRow }) {
    const hasBank =
        row.bank_name ||
        row.bank_account_name ||
        row.bank_account_number ||
        row.bank_routing_number ||
        row.bank_branch ||
        row.bank_address;
    const hasRm = row.rm_name || row.rm_phone || row.rm_email;
    return (
        <>
            <SectionLabel>Account</SectionLabel>
            <DefList>
                <Def k="Account type" v={row.account_type} />
                <Def k="BO ID" v={row.bo_id} mono />
                <Def k="BO name" v={row.bo_name} />
                <Def k="Client code" v={row.client_code} mono />
            </DefList>

            {hasBank ? (
                <>
                    <div style={{ height: 18 }} />
                    <SectionLabel>Deposit bank</SectionLabel>
                    <DefList>
                        <Def k="Bank name" v={row.bank_name} />
                        <Def k="Account name" v={row.bank_account_name} />
                        <Def k="Account number" v={row.bank_account_number} mono />
                        <Def k="Routing number" v={row.bank_routing_number} mono />
                        <Def k="Branch" v={row.bank_branch} />
                        <Def k="Branch address" v={row.bank_address} />
                    </DefList>
                </>
            ) : null}

            {hasRm ? (
                <>
                    <div style={{ height: 18 }} />
                    <SectionLabel>Relation manager</SectionLabel>
                    <DefList>
                        <Def k="Name" v={row.rm_name} />
                        <Def
                            k="Phone"
                            v={
                                row.rm_phone ? (
                                    <a href={`tel:${row.rm_phone.replace(/\s/g, "")}`} style={{ color: "var(--accent-200)" }}>
                                        {row.rm_phone}
                                    </a>
                                ) : null
                            }
                            mono
                        />
                        <Def
                            k="Email"
                            v={
                                row.rm_email ? (
                                    <a href={`mailto:${row.rm_email}`} style={{ color: "var(--accent-200)" }}>
                                        {row.rm_email}
                                    </a>
                                ) : null
                            }
                        />
                    </DefList>
                </>
            ) : null}

            {row.notes ? (
                <>
                    <div style={{ height: 18 }} />
                    <SectionLabel>Notes</SectionLabel>
                    <p style={{ margin: 0, color: "var(--ink-default)", fontSize: 13, whiteSpace: "pre-wrap" }}>
                        {row.notes}
                    </p>
                </>
            ) : null}
        </>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p
            style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: ".14em",
                color: "var(--ink-faint)",
                margin: "0 0 10px",
            }}
        >
            {children}
        </p>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="field" style={{ marginBottom: 0 }}>
            <label className="lbl">{label}</label>
            {children}
        </div>
    );
}

function DefList({ children }: { children: React.ReactNode }) {
    return (
        <dl
            style={{
                display: "grid",
                gridTemplateColumns: "minmax(160px, 200px) 1fr",
                rowGap: 10,
                columnGap: 16,
                margin: 0,
            }}
        >
            {children}
        </dl>
    );
}

function Def({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
    return (
        <>
            <dt style={{ color: "var(--ink-muted)", fontSize: 13 }}>{k}</dt>
            <dd
                style={{
                    margin: 0,
                    color: "var(--ink-strong)",
                    fontSize: 14,
                    fontFamily: mono ? "var(--font-mono)" : undefined,
                    fontVariantNumeric: mono ? "tabular-nums" : undefined,
                    wordBreak: "break-word",
                }}
            >
                {v ?? <span style={{ color: "var(--ink-faint)" }}>—</span>}
            </dd>
        </>
    );
}
