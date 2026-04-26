"use client";

import { SymbolField, type SymbolFieldInstrument } from "@/components/symbol-field";
import { useActionState, useEffect, useLayoutEffect, useRef, useState } from "react";
import { recordTransaction, type RecordState } from "../actions";
import { CommissionField } from "./commission-field";
import { Alert } from "antd";

const initial: RecordState = {};

type Props = {
  instruments: SymbolFieldInstrument[];
  instrumentsError?: string | null;
};

export function RecordForm({ instruments, instrumentsError }: Props) {
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
    });

    return () => cancelAnimationFrame(id);
  }, [state.ok]);

  useLayoutEffect(() => {
    if (!state.error && !(state.ok && !pending)) return;
    feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [state.error, state.ok, pending]);

  return (
    <div className="min-w-0 max-w-lg">
      <form
        ref={formRef}
        action={formAction}
        className="flex flex-col gap-5 rounded-2xl border border-teal-200/50 bg-white/90 p-6 shadow-lg shadow-teal-950/5 ring-1 ring-black/[0.03] backdrop-blur-sm dark:border-teal-900/40 dark:bg-zinc-900/75 dark:shadow-black/30 dark:ring-white/[0.05]"
      >
        <label className="block text-[15px] font-normal text-zinc-700 dark:text-zinc-300">
          Symbol (DSE trading code)
          <SymbolField
            instruments={instruments}
            loadError={instrumentsError}
            required
            placeholder="e.g. GP, BRACBANK"
            value={symbolInput}
            onValueChange={setSymbolInput}
          />
        </label>
        <label className="block text-[15px] font-normal text-zinc-700 dark:text-zinc-300">
          Side
          <select
            name="side"
            required
            value={side}
            onChange={(e) =>
              setSide(e.target.value === "sell" ? "sell" : "buy")
            }
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[15px] font-normal text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </label>
        <label className="block text-[15px] font-normal text-zinc-700 dark:text-zinc-300">
          Quantity (shares)
          <input
            name="quantity"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[15px] font-normal text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="block text-[15px] font-normal text-zinc-700 dark:text-zinc-300">
          Price per share
          <input
            name="price_per_share"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            required
            value={pricePerShare}
            onChange={(e) => setPricePerShare(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[15px] font-normal text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>

        <CommissionField key={commissionKey} quantity={quantity} pricePerShare={pricePerShare} />

        <button
          type="submit"
          disabled={pending}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-3 text-[15px] font-normal text-white shadow-md shadow-teal-600/30 transition hover:brightness-110 disabled:opacity-60 dark:from-teal-500 dark:to-emerald-500"
        >
          {pending ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : null}
          {pending ? "Saving…" : "Save transaction"}
        </button>

        <div ref={feedbackRef} className="min-h-0 scroll-mt-24">
          {state.error ? (
            <Alert
              type="error"
              showIcon
              title="Could not save"
              description={state.error}
              className="text-left"
              role="alert"
            />
          ) : null}
          {state.ok && !pending ? (
            <Alert
              type="success"
              showIcon
              title="Saved"
              description={state.summary ?? "Transaction was recorded."}
              className="text-left"
            />
          ) : null}
        </div>
      </form>
    </div>
  );
}
