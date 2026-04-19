import { RecordForm } from "./record-form";

export default function RecordPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Record trade
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Add a buy or sell in BDT, including applicable charges. New buys appear on
        Portfolio automatically; selling your entire position removes that line.
      </p>
      <div className="mt-8">
        <RecordForm />
      </div>
    </div>
  );
}
