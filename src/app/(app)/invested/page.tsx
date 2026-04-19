import {
  addCapitalContribution,
  deleteCapitalContribution,
} from "../planning-actions";
import { createClient } from "@/lib/supabase/server";
import { formatBdt } from "@/lib/format-bdt";

export default async function InvestedPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("capital_contributions")
    .select("id, created_at, amount_bdt, note")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Invested capital
        </h1>
        <p
          className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error.message}
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Run the latest SQL in{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
            supabase/schema.sql
          </code>{" "}
          or{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
            supabase/migrations/20260209120000_planning_tables.sql
          </code>
          .
        </p>
      </div>
    );
  }

  const list = rows ?? [];
  const total = list.reduce(
    (s, r) => s + Number(r.amount_bdt),
    0,
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Invested capital
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Log each amount you put into the market (deposits / fresh capital). Total
        invested is the sum of all entries.
      </p>

      <section className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          Total invested
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
          {formatBdt(total)}
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {list.length} contribution{list.length === 1 ? "" : "s"}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Add contribution
        </h2>
        <form
          action={addCapitalContribution}
          className="mt-4 flex max-w-md flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Amount (BDT)
            <input
              name="amount_bdt"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              required
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Note <span className="font-normal text-zinc-500">(optional)</span>
            <input
              name="note"
              placeholder="e.g. Jan deposit, bonus"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Save
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          History
        </h2>
        {list.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            No entries yet. Add your first contribution above.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {list.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 dark:bg-zinc-950"
              >
                <div>
                  <p className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
                    {formatBdt(Number(r.amount_bdt))}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(r.created_at).toLocaleString()}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                </div>
                <form action={deleteCapitalContribution}>
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    className="text-sm text-red-700 underline-offset-2 hover:underline dark:text-red-400"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
