import {
  computeTradeCommissionBdt,
  getTradeCommissionRate,
  marketValueBdt,
  roundBdt,
} from "@/lib/fees/trade-commission";

type Props = {
  quantity: string;
  pricePerShare: string;
};

export function FeeSummary({ quantity, pricePerShare }: Props) {
  const qty = Number(quantity.trim());
  const price = Number(pricePerShare.trim());
  const rate = getTradeCommissionRate();

  const valid =
    Number.isFinite(qty) &&
    Number.isFinite(price) &&
    qty > 0 &&
    price >= 0;

  const mv = valid ? roundBdt(marketValueBdt(qty, price)) : 0;
  const commission = valid ? computeTradeCommissionBdt(qty, price, rate) : 0;
  const pctLabel = `${(rate * 100).toFixed(2)}%`;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900/50">
      <p className="font-medium text-zinc-800 dark:text-zinc-200">
        Estimated commission (BDT)
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-zinc-700 dark:text-zinc-300">
        <dt className="text-zinc-500 dark:text-zinc-400">Gross (qty × price)</dt>
        <dd className="text-right tabular-nums font-medium">
          {mv.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </dd>
        <dt className="text-zinc-500 dark:text-zinc-400">Commission ({pctLabel})</dt>
        <dd className="text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-50">
          {commission.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </dd>
      </dl>
    </div>
  );
}
