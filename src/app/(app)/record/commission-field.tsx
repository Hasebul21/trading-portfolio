"use client";

import {
  computeTradeCommissionBdt,
  getTradeCommissionRate,
  marketValueBdt,
  roundBdt,
} from "@/lib/fees/trade-commission";
import { useState } from "react";

type Props = {
  quantity: string;
  pricePerShare: string;
};

export function CommissionField({ quantity, pricePerShare }: Props) {
  const qty = Number(quantity.trim());
  const price = Number(pricePerShare.trim());
  const valid =
    Number.isFinite(qty) && Number.isFinite(price) && qty > 0 && price >= 0;

  const rate = getTradeCommissionRate();
  const autoFees = valid ? computeTradeCommissionBdt(qty, price, rate) : 0;
  const autoStr = valid ? String(autoFees) : "";
  const pctLabel = `${(rate * 100).toFixed(2)}%`;

  const [userTouched, setUserTouched] = useState(false);
  const [feesInput, setFeesInput] = useState("");

  const displayFees = userTouched ? feesInput : autoStr;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 text-[15px] font-normal leading-snug dark:border-zinc-700 dark:bg-zinc-900/50">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
        <label className="block min-w-0 flex-1 text-[15px] font-normal text-zinc-600 dark:text-zinc-400">
          <span className="sr-only">Fees saved on this trade</span>
          <input
            name="fees_bdt"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={displayFees}
            onChange={(e) => {
              setUserTouched(true);
              setFeesInput(e.target.value);
            }}
            placeholder={valid ? autoStr : "0"}
            className="mt-1 box-border w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-right text-[15px] font-normal tabular-nums text-zinc-900 outline-none ring-teal-500/30 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
            aria-label={`Commission amount, default ${pctLabel} of gross`}
          />
        </label>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-teal-200/80 bg-white px-3 py-2 text-[15px] font-normal text-teal-800 shadow-sm hover:bg-teal-50 dark:border-teal-800/60 dark:bg-zinc-900 dark:text-teal-100 dark:hover:bg-teal-950/40"
          onClick={() => {
            setUserTouched(false);
            setFeesInput("");
          }}
        >
          Use auto ({pctLabel})
        </button>
      </div>
    </div>
  );
}
