"use client";

import { SymbolField, type SymbolFieldInstrument } from "@/components/symbol-field";
import { useActionState, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { recordTransaction, type RecordState } from "../actions";
import { CommissionField } from "./commission-field";
import { Alert, Button, InputNumber, Radio } from "antd";

const initial: RecordState = {};

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

  useEffect(() => {
    if (!state.ok) return;

    const id = requestAnimationFrame(() => {
      formRef.current?.reset();
      setSide("buy");
      setQuantity("");
      setPricePerShare("");
      setSymbolInput("");
      setCommissionKey((k) => k + 1);
      // Refresh router cache so portfolio and other pages show updated data
      router.refresh();
    });

    return () => cancelAnimationFrame(id);
  }, [state.ok, router]);

  useLayoutEffect(() => {
    if (!state.error && !(state.ok && !pending)) return;
    feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [state.error, state.ok, pending]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 text-zinc-900">
      {/* Page header */}
      <header>
        <p className="text-[12px] uppercase tracking-[0.14em] text-zinc-500">
          Transaction
        </p>
        <h1 className="mt-1 text-[26px] leading-tight tracking-tight text-zinc-900">
          Record a trade
        </h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Log a buy or sell against your portfolio. Commissions default to your
          configured rate.
        </p>
      </header>

      <form
        ref={formRef}
        action={formAction}
        className="flex flex-col gap-5 rounded-xl border border-zinc-200 bg-white p-5 sm:p-6"
      >
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

        {/* Side */}
        <FieldLabel label="Side">
          <Radio.Group
            value={side}
            onChange={(e) => setSide(e.target.value === "sell" ? "sell" : "buy")}
            optionType="button"
            buttonStyle="solid"
            options={[
              { label: "Buy", value: "buy" },
              { label: "Sell", value: "sell" },
            ]}
            className="mt-1"
          />
          <input type="hidden" name="side" value={side} />
        </FieldLabel>

        {/* Quantity */}
        <FieldLabel label="Quantity" hint="Number of shares">
          <InputNumber
            value={quantity === "" ? null : Number(quantity)}
            onChange={(v) =>
              setQuantity(v === null || v === undefined ? "" : String(v))
            }
            placeholder="0"
            min={0}
            step={1}
            size="large"
            controls={false}
            className="mt-1 w-full"
          />
          <input
            type="hidden"
            name="quantity"
            value={quantity}
          />
        </FieldLabel>

        {/* Price per share */}
        <FieldLabel label="Price per share" hint="BDT">
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
          />
          <input
            type="hidden"
            name="price_per_share"
            value={pricePerShare}
          />
        </FieldLabel>

        <CommissionField
          key={commissionKey}
          quantity={quantity}
          pricePerShare={pricePerShare}
        />

        <Button
          type="primary"
          size="large"
          htmlType="submit"
          loading={pending}
          className="mt-2 w-full"
        >
          {pending ? "Saving…" : "Save transaction"}
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
    </div>
  );
}

/** Consistent field wrapper — small zinc label + optional hint, then control. */
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
        <span className="text-[13px] text-zinc-700">{label}</span>
        {hint ? <span className="text-[12px] text-zinc-500">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}
