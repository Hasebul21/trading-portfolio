"use client";

import { BD_CHARGES, type TradeFeeFlags } from "@/lib/fees/bd-charges";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { recordTransaction, type RecordState } from "../actions";
import { FeeSummary } from "./fee-summary";

const initial: RecordState = {};

export function RecordForm() {
  const [state, formAction, pending] = useActionState(recordTransaction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [pricePerShare, setPricePerShare] = useState("");
  const [applyTransfer, setApplyTransfer] = useState(true);
  const [applyDemat, setApplyDemat] = useState(false);
  const [applyRemat, setApplyRemat] = useState(false);
  const [applyPledge, setApplyPledge] = useState(false);
  const [applyUnpledge, setApplyUnpledge] = useState(false);
  const [extraFeesBdt, setExtraFeesBdt] = useState("");

  useEffect(() => {
    if (!state.ok) return;

    const id = requestAnimationFrame(() => {
      formRef.current?.reset();
      setSide("buy");
      setQuantity("");
      setPricePerShare("");
      setApplyTransfer(true);
      setApplyDemat(false);
      setApplyRemat(false);
      setApplyPledge(false);
      setApplyUnpledge(false);
      setExtraFeesBdt("");
    });

    return () => cancelAnimationFrame(id);
  }, [state.ok]);

  const feeFlags: TradeFeeFlags = useMemo(
    () => ({
      applyTransfer,
      applyDemat,
      applyRemat,
      applyPledge,
      applyUnpledge,
      extraFeesBdt: Math.max(
        0,
        Number(extraFeesBdt.trim()) || 0,
      ),
    }),
    [
      applyTransfer,
      applyDemat,
      applyRemat,
      applyPledge,
      applyUnpledge,
      extraFeesBdt,
    ],
  );

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
          Transaction saved. Portfolio updated.
        </p>
      ) : null}
      <form
        ref={formRef}
        action={formAction}
        className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Symbol
          <input
            name="symbol"
            placeholder="GP"
            required
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 uppercase text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
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
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Category <span className="font-normal text-zinc-500">(optional)</span>
          <input
            name="category"
            placeholder="Bank, Pharma, …"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>

        <fieldset className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <legend className="px-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Charges (BDT)
          </legend>
          <p className="mb-3 text-xs text-zinc-600 dark:text-zinc-400">
            Buy-side fees increase your book cost. Sell fees are stored on the trade
            but do not change average cost of shares you still hold.
          </p>
          <ul className="mb-3 list-inside list-disc space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            <li>
              Transfer-In: {(BD_CHARGES.transferInRate * 100).toFixed(4)}% of MV ·
              Transfer-Out: {(BD_CHARGES.transferOutRate * 100).toFixed(3)}% of MV
            </li>
            <li>
              Demat: {(BD_CHARGES.dematRate * 100).toFixed(3)}% of MV + BDT{" "}
              {BD_CHARGES.dematPerScripBdt} per scrip
            </li>
            <li>
              Remat: BDT {BD_CHARGES.rematPerSecurityBdt} × quantity + BDT{" "}
              {BD_CHARGES.rematPerScripBdt} per scrip
            </li>
            <li>Pledge: {(BD_CHARGES.pledgeRate * 100).toFixed(2)}% of MV</li>
            <li>Unpledge: {(BD_CHARGES.unpledgeRate * 100).toFixed(3)}% of MV</li>
            <li>
              Cheque dishonor BDT {BD_CHARGES.chequeDishonorBdt}; wealth certificate BDT{" "}
              {BD_CHARGES.wealthCertificateEachBdt} each — use extra fees
            </li>
          </ul>
          <div className="flex flex-col gap-2.5">
            <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="hidden"
                name="apply_transfer"
                value={applyTransfer ? "on" : "off"}
              />
              <input
                type="checkbox"
                checked={applyTransfer}
                onChange={(e) => setApplyTransfer(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Apply transfer charge (Transfer-In on buy, Transfer-Out on sell)
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="hidden" name="apply_demat" value={applyDemat ? "on" : "off"} />
              <input
                type="checkbox"
                checked={applyDemat}
                onChange={(e) => setApplyDemat(e.target.checked)}
                className="mt-0.5"
              />
              <span>Demat (this trade)</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="hidden" name="apply_remat" value={applyRemat ? "on" : "off"} />
              <input
                type="checkbox"
                checked={applyRemat}
                onChange={(e) => setApplyRemat(e.target.checked)}
                className="mt-0.5"
              />
              <span>Remat (this trade)</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="hidden" name="apply_pledge" value={applyPledge ? "on" : "off"} />
              <input
                type="checkbox"
                checked={applyPledge}
                onChange={(e) => setApplyPledge(e.target.checked)}
                className="mt-0.5"
              />
              <span>Pledge of securities</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="hidden"
                name="apply_unpledge"
                value={applyUnpledge ? "on" : "off"}
              />
              <input
                type="checkbox"
                checked={applyUnpledge}
                onChange={(e) => setApplyUnpledge(e.target.checked)}
                className="mt-0.5"
              />
              <span>Unpledge of securities</span>
            </label>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Extra fees (BDT){" "}
              <span className="font-normal text-zinc-500">
                e.g. cheque dishonor, wealth certificates, one-offs
              </span>
              <input
                name="extra_fees_bdt"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="0"
                value={extraFeesBdt}
                onChange={(e) => setExtraFeesBdt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </label>
          </div>
        </fieldset>

        <FeeSummary
          side={side}
          quantity={quantity}
          pricePerShare={pricePerShare}
          flags={feeFlags}
        />

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Saving…" : "Save transaction"}
        </button>
      </form>
    </div>
  );
}
