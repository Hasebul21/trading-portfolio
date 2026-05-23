"use client";

import { SymbolField, type SymbolFieldInstrument } from "@/components/symbol-field";
import { useActionState, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { recordTransaction, type RecordState } from "../actions";
import { CommissionField } from "./commission-field";
import {
    computeTradeCommissionBdt,
    getTradeCommissionRate,
} from "@/lib/fees/trade-commission";
import { formatBdt } from "@/lib/format-bdt";
import { Alert, Button, Descriptions, InputNumber, Modal, Segmented, Tag } from "antd";

const initial: RecordState = {};

type ConfirmSnapshot = {
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    pricePerShare: number;
    fees: number;
    gross: number;
    net: number;
    ratePct: string;
};

type Props = {
    instruments: SymbolFieldInstrument[];
    instrumentsError?: string | null;
};

export function RecordForm({ instruments, instrumentsError }: Props) {
    const router = useRouter();
    const [state, formAction, pending] = useActionState(recordTransaction, initial);
    const formRef = useRef<HTMLFormElement>(null);
    const feedbackRef = useRef<HTMLDivElement>(null);

    const [side, setSide] = useState<"buy" | "sell">("buy");
    const [quantity, setQuantity] = useState("");
    const [pricePerShare, setPricePerShare] = useState("");
    const [symbolInput, setSymbolInput] = useState("");
    /** Remount commission block after save so auto-commission resets cleanly. */
    const [commissionKey, setCommissionKey] = useState(0);
    const [confirmSnapshot, setConfirmSnapshot] = useState<ConfirmSnapshot | null>(null);

    useEffect(() => {
        if (!state.ok) return;
        const id = requestAnimationFrame(() => {
            setConfirmSnapshot(null);
            formRef.current?.reset();
            setSide("buy");
            setQuantity("");
            setPricePerShare("");
            setSymbolInput("");
            setCommissionKey((k) => k + 1);
            router.refresh();
        });
        return () => cancelAnimationFrame(id);
    }, [state.ok, router]);

    useLayoutEffect(() => {
        if (!state.error && !(state.ok && !pending)) return;
        feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [state.error, state.ok, pending]);

    // Live trade summary — gross / fees / net before submitting.
    const summary = useMemo(() => {
        const qty = Number(quantity);
        const price = Number(pricePerShare);
        const valid =
            Number.isFinite(qty) && Number.isFinite(price) && qty > 0 && price >= 0;
        if (!valid) return null;
        const rate = getTradeCommissionRate();
        const gross = qty * price;
        const fees = computeTradeCommissionBdt(qty, price, rate);
        const net = side === "buy" ? gross + fees : gross - fees;
        return { gross, fees, net, ratePct: `${(rate * 100).toFixed(2)}%` };
    }, [quantity, pricePerShare, side]);

    function handleSaveClick(e: React.MouseEvent) {
        e.preventDefault();
        const qty = Number(quantity);
        const price = Number(pricePerShare);
        if (!symbolInput || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
            formRef.current?.requestSubmit();
            return;
        }
        const fd = new FormData(formRef.current!);
        const feesRaw = (fd.get("fees_bdt") as string) ?? "";
        const rate = getTradeCommissionRate();
        const fees = feesRaw === ""
            ? computeTradeCommissionBdt(qty, price, rate)
            : Number(feesRaw);
        const gross = qty * price;
        const net = side === "buy" ? gross + fees : gross - fees;
        setConfirmSnapshot({
            symbol: symbolInput.toUpperCase(),
            side,
            quantity: qty,
            pricePerShare: price,
            fees,
            gross,
            net,
            ratePct: `${(rate * 100).toFixed(2)}%`,
        });
    }

    const isBuy = side === "buy";
    const sideAccent = isBuy
        ? "border-[var(--gain-600)]/40 bg-[var(--gain-50)] text-[var(--gain-700)]"
        : "border-[var(--loss-600)]/40 bg-[var(--loss-50)] text-[var(--loss-700)]";

    return (
        <div className="flex w-full min-w-0 flex-col gap-5 text-[var(--ink-strong)]">
            {/* Page header */}
            <header className="flex items-end justify-between gap-3">
                <div>
                    <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                        Transaction
                    </p>
                    <h1 className="mt-1 text-[26px] leading-tight tracking-tight text-[var(--ink-strong)]">
                        New trade ticket
                    </h1>
                </div>
                <span
                    className={`hidden rounded-full border px-3 py-1 text-[12px] uppercase tracking-[0.12em] sm:inline-block ${sideAccent}`}
                >
                    {isBuy ? "Buy" : "Sell"}
                </span>
            </header>

            <form
                ref={formRef}
                action={formAction}
                className="flex flex-col gap-5 rounded-2xl border border-[var(--line)] bg-[var(--bg-surface)] p-4 shadow-sm sm:p-6"
            >
                {/* Side — full-width segmented control, colored to match buy/sell. */}
                <div>
                    <Segmented
                        block
                        size="large"
                        value={side}
                        onChange={(v) => setSide(v === "sell" ? "sell" : "buy")}
                        options={[
                            { label: "Buy", value: "buy" },
                            { label: "Sell", value: "sell" },
                        ]}
                        className={`record-side-toggle record-side-${side}`}
                    />
                    <input type="hidden" name="side" value={side} />
                </div>

                {/* Symbol */}
                <FieldLabel label="Symbol" hint="DSE trading code">
                    <SymbolField
                        instruments={instruments}
                        loadError={instrumentsError}
                        required
                        placeholder="e.g. GP, BRACBANK"
                        value={symbolInput}
                        onValueChange={setSymbolInput}
                    />
                </FieldLabel>

                {/* Qty + Price side-by-side on sm+. Both inputs share the row equally. */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FieldLabel label="Quantity" hint="Shares">
                        <InputNumber
                            value={quantity === "" ? null : Number(quantity)}
                            onChange={(v) => setQuantity(v === null || v === undefined ? "" : String(v))}
                            placeholder="0"
                            min={0}
                            step={1}
                            size="large"
                            controls={false}
                            className="mt-1 w-full"
                            style={{ width: "100%" }}
                            inputMode="numeric"
                        />
                        <input type="hidden" name="quantity" value={quantity} />
                    </FieldLabel>

                    <FieldLabel label="Price / share" hint="BDT">
                        <InputNumber
                            value={pricePerShare === "" ? null : Number(pricePerShare)}
                            onChange={(v) =>
                                setPricePerShare(v === null || v === undefined ? "" : String(v))
                            }
                            placeholder="0.00"
                            min={0}
                            step={0.1}
                            size="large"
                            controls={false}
                            className="mt-1 w-full"
                            style={{ width: "100%" }}
                            inputMode="decimal"
                        />
                        <input type="hidden" name="price_per_share" value={pricePerShare} />
                    </FieldLabel>
                </div>

                <CommissionField key={commissionKey} quantity={quantity} pricePerShare={pricePerShare} />

                {/* Live trade summary strip */}
                <TradeSummary side={side} summary={summary} />

                <Button
                    type="primary"
                    size="large"
                    onClick={handleSaveClick}
                    loading={pending}
                    className="mt-1 w-full"
                >
                    {pending ? "Saving…" : isBuy ? "Save buy transaction" : "Save sell transaction"}
                </Button>

                <div ref={feedbackRef} className="min-h-0 scroll-mt-24">
                    {state.error ? (
                        <Alert
                            type="error"
                            showIcon
                            message="Could not save"
                            description={state.error}
                            className="text-left"
                            role="alert"
                        />
                    ) : null}
                    {state.ok && !pending ? (
                        <Alert
                            type="success"
                            showIcon
                            message="Saved"
                            description={state.summary ?? "Transaction was recorded."}
                            className="text-left"
                        />
                    ) : null}
                </div>
            </form>

            <Modal
                open={confirmSnapshot !== null}
                title="Confirm transaction"
                onCancel={() => setConfirmSnapshot(null)}
                footer={[
                    <Button key="cancel" onClick={() => setConfirmSnapshot(null)} disabled={pending}>
                        Cancel
                    </Button>,
                    <Button
                        key="confirm"
                        type="primary"
                        loading={pending}
                        onClick={() => formRef.current?.requestSubmit()}
                    >
                        Confirm
                    </Button>,
                ]}
                centered
            >
                {confirmSnapshot && (
                    <div className="pt-1">
                        <div className="mb-4 flex items-center gap-2">
                            <span className="text-[18px] font-semibold tracking-tight text-[var(--ink-strong)]">
                                {confirmSnapshot.symbol}
                            </span>
                            <Tag color={confirmSnapshot.side === "buy" ? "success" : "error"}>
                                {confirmSnapshot.side.toUpperCase()}
                            </Tag>
                        </div>
                        <Descriptions column={1} size="small" bordered>
                            <Descriptions.Item label="Quantity">
                                {confirmSnapshot.quantity.toLocaleString()} shares
                            </Descriptions.Item>
                            <Descriptions.Item label="Price / share">
                                {formatBdt(confirmSnapshot.pricePerShare)}
                            </Descriptions.Item>
                            <Descriptions.Item label="Gross">
                                {formatBdt(confirmSnapshot.gross)}
                            </Descriptions.Item>
                            <Descriptions.Item label={`Fees (${confirmSnapshot.ratePct})`}>
                                {formatBdt(confirmSnapshot.fees)}
                            </Descriptions.Item>
                            <Descriptions.Item
                                label={confirmSnapshot.side === "buy" ? "Cash out" : "Cash in"}
                            >
                                <span
                                    className={confirmSnapshot.side === "buy"
                                        ? "font-semibold text-[var(--loss-700)]"
                                        : "font-semibold text-[var(--gain-700)]"}
                                >
                                    {formatBdt(confirmSnapshot.net)}
                                </span>
                            </Descriptions.Item>
                        </Descriptions>
                    </div>
                )}
            </Modal>
        </div>
    );
}

/** Live Gross / Fees / Net preview strip. */
function TradeSummary({
    side,
    summary,
}: {
    side: "buy" | "sell";
    summary: { gross: number; fees: number; net: number; ratePct: string } | null;
}) {
    const isBuy = side === "buy";
    const netLabel = isBuy ? "Cash out" : "Cash in";
    const netClass = isBuy ? "text-[var(--loss-700)]" : "text-[var(--gain-700)]";

    if (!summary) {
        return (
            <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--bg-surface-soft)] px-4 py-3 text-[12px] text-[var(--ink-muted)]">
                Enter quantity and price to see a live trade summary.
            </div>
        );
    }

    return (
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--line)] text-[12px]">
            <SummaryCell label="Gross" value={formatBdt(summary.gross)} />
            <SummaryCell label={`Fees (${summary.ratePct})`} value={formatBdt(summary.fees)} muted />
            <SummaryCell
                label={netLabel}
                value={formatBdt(summary.net)}
                valueClass={netClass}
                emphasis
            />
        </dl>
    );
}

function SummaryCell({
    label,
    value,
    valueClass,
    muted,
    emphasis,
}: {
    label: string;
    value: string;
    valueClass?: string;
    muted?: boolean;
    emphasis?: boolean;
}) {
    return (
        <div className="bg-[var(--bg-surface)] px-3 py-2.5">
            <dt className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">{label}</dt>
            <dd
                className={`mt-0.5 tabular-nums ${emphasis ? "text-[15px]" : "text-[13px]"} ${muted ? "text-[var(--ink-muted)]" : "text-[var(--ink-strong)]"
                    } ${valueClass ?? ""}`}
            >
                {value}
            </dd>
        </div>
    );
}

/** Consistent field wrapper — label + optional hint, then control. */
function FieldLabel({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-[var(--ink-strong)]">{label}</span>
                {hint ? <span className="text-[12px] text-[var(--ink-muted)]">{hint}</span> : null}
            </div>
            {children}
        </label>
    );
}
