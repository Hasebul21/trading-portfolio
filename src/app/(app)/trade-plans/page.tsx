import { addTradePlan, deleteTradePlan } from "../planning-actions";
import { createClient } from "@/lib/supabase/server";
import { formatBdt } from "@/lib/format-bdt";

export default async function TradePlansPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("immediate_trade_plans")
    .select("id, created_at, symbol, side, target_price, notes")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Trade plans
        </h1>
        <p
          className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error.message}
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Run{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
            supabase/migrations/20260209120000_planning_tables.sql
          </code>{" "}
          if tables are missing.
        </p>
      </div>
    );
  }

  const list = rows ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Immediate buy / sell plans
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Stocks you want to trade soon, with a target price (ideas only—use Record
        when you actually execute).
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Add plan
        </h2>
        <form
          action={addTradePlan}
          className="mt-4 flex max-w-md flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Symbol
            <input
              name="symbol"
              placeholder="BRACBANK"
              required
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 uppercase text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Action
            <select
              name="side"
              required
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Target price (BDT)
            <input
              name="target_price"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              required
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Notes <span className="font-normal text-zinc-500">(optional)</span>
            <input
              name="notes"
              placeholder="Trigger, size, deadline…"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Add plan
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Active plans ({list.length})
        </h2>
        {list.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            No plans yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                    Symbol
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                    Side
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                    Target price
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                    Notes
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                    {" "}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {list.map((r) => (
                  <tr key={r.id} className="bg-white dark:bg-zinc-950">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                      {r.symbol}
                    </td>
                    <td className="px-4 py-3 capitalize text-zinc-800 dark:text-zinc-200">
                      {r.side}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-800 dark:text-zinc-200">
                      {formatBdt(Number(r.target_price))}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {r.notes ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteTradePlan} className="inline">
                        <input type="hidden" name="id" value={r.id} />
                        <button
                          type="submit"
                          className="text-sm text-red-700 underline-offset-2 hover:underline dark:text-red-400"
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
