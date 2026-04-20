"use client";

import { SymbolField, type SymbolFieldInstrument } from "@/components/symbol-field";
import { useActionState, useEffect, useRef, useState } from "react";
import { recordTransaction, type RecordState } from "../actions";
import { FeeSummary } from "./fee-summary";

const initial: RecordState = {};

type Props = {
  instruments: SymbolFieldInstrument[];
  instrumentsError?: string | null;
};

export function RecordForm({ instruments, instrumentsError }: Props) {
  const [state, formAction, pending] = useActionState(recordTransaction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [pricePerShare, setPricePerShare] = useState("");
  const [symbolInput, setSymbolInput] = useState("");

  useEffect(() => {
    if (!state.ok) return;

    const id = requestAnimationFrame(() => {
      formRef.current?.reset();
      setSide("buy");
      setQuantity("");
      setPricePerShare("");
      setSymbolInput("");
    });

    return () => cancelAnimationFrame(id);
  }, [state.ok]);

  return (
    <div className="max-w-lg">
      {state.error ? (
        <p
          className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      {state.ok && !pending ? (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          Saved.
        </p>
      ) : null}
      <form
        ref={formRef}
        action={formAction}
        className="flex flex-col gap-5 rounded-2xl border border-teal-200/50 bg-white/90 p-6 shadow-lg shadow-teal-950/5 ring-1 ring-black/[0.03] backdrop-blur-sm dark:border-teal-900/40 dark:bg-zinc-900/75 dark:shadow-black/30 dark:ring-white/[0.05]"
      >
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Side
          <select
            name="side"
            required
            value={side}
            onChange={(e) =>
              setSide(e.target.value === "sell" ? "sell" : "buy")
            }
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Price per share (BDT)
          <input
            name="price_per_share"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            required
            value={pricePerShare}
            onChange={(e) => setPricePerShare(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>

        <FeeSummary quantity={quantity} pricePerShare={pricePerShare} />

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-teal-600/30 transition hover:brightness-110 disabled:opacity-60 dark:from-teal-500 dark:to-emerald-500"
        >
          {pending ? "Saving…" : "Save transaction"}
        </button>
      </form>
    </div>
  );
}
