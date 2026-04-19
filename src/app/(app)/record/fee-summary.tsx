import {
  BD_CHARGES,
  computeTransactionFeesBdt,
  marketValueBdt,
  roundBdt,
  type TradeFeeFlags,
} from "@/lib/fees/bd-charges";

type Props = {
  side: "buy" | "sell";
  quantity: string;
  pricePerShare: string;
  flags: TradeFeeFlags;
};

export function FeeSummary({ side, quantity, pricePerShare, flags }: Props) {
  const qty = Number(quantity.trim());
  const price = Number(pricePerShare.trim());

  const valid =
    Number.isFinite(qty) &&
    Number.isFinite(price) &&
    qty > 0 &&
    price >= 0;

  const mv = valid ? roundBdt(marketValueBdt(qty, price)) : 0;
  const fees = valid ? computeTransactionFeesBdt(side, qty, price, flags) : 0;

  const transferLabel =
    side === "buy"
      ? `Transfer-In (${(BD_CHARGES.transferInRate * 100).toFixed(4)}% of MV)`
      : `Transfer-Out (${(BD_CHARGES.transferOutRate * 100).toFixed(3)}% of MV)`;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900/50">
      <p className="font-medium text-zinc-800 dark:text-zinc-200">
        Estimated charges (BDT)
      </p>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Default includes {transferLabel}. Optional items match your charge sheet;
        account opening (BDT {BD_CHARGES.accountOpeningBdt}) and annual BO (BDT{" "}
        {BD_CHARGES.annualBoMaintenanceBdt}) are not per trade—add under extra if
        you want to book them here.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-zinc-700 dark:text-zinc-300">
        <dt className="text-zinc-500 dark:text-zinc-400">Market value</dt>
        <dd className="text-right tabular-nums font-medium">
          {mv.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </dd>
        <dt className="text-zinc-500 dark:text-zinc-400">Total fees (this trade)</dt>
        <dd className="text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-50">
          {fees.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </dd>
      </dl>
    </div>
  );
}
