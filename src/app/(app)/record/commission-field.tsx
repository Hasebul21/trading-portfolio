"use client";

import {
 computeTradeCommissionBdt,
 getTradeCommissionRate,
} from "@/lib/fees/trade-commission";
import { Button, InputNumber } from "antd";
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
 const pctLabel = `${(rate * 100).toFixed(2)}%`;

 const [userTouched, setUserTouched] = useState(false);
 const [feesInput, setFeesInput] = useState("");

 const displayFees: number | null = userTouched
 ? feesInput === ""
 ? null
 : Number(feesInput)
 : valid
 ? autoFees
 : null;

 const submitValue = userTouched ? feesInput : valid ? String(autoFees) : "";

 return (
 <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-surface-soft)] p-4">
 <div className="flex items-baseline justify-between gap-3">
 <span className="text-[13px] text-[var(--ink-strong)]">Commission (BDT)</span>
 <span className="text-[12px] text-[var(--ink-muted)]">Auto {pctLabel} of gross</span>
 </div>

 <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
 <InputNumber
 value={displayFees}
 onChange={(v) => {
 setUserTouched(true);
 setFeesInput(v === null || v === undefined ? "" : String(v));
 }}
 placeholder={valid ? String(autoFees) : "0"}
 min={0}
 step={1}
 size="middle"
 controls={false}
 className="w-full sm:flex-1"
 aria-label={`Commission amount, default ${pctLabel} of gross`}
 />
 <Button
 type="default"
 size="middle"
 onClick={() => {
 setUserTouched(false);
 setFeesInput("");
 }}
 className="shrink-0"
 >
 Use auto ({pctLabel})
 </Button>
 </div>

 <input type="hidden" name="fees_bdt" value={submitValue} />
 </div>
 );
}
