"use client";

import { addLongTermHolding } from "@/app/(app)/planning-actions";
import { SymbolField } from "@/components/symbol-field";
import type { SymbolFieldInstrument } from "@/components/symbol-field";
import { Alert, Button } from "antd";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

const symbolInputClass =
  "box-border h-9 w-full rounded border border-zinc-300/90 bg-white px-2 font-mono text-[15px] font-normal leading-none text-zinc-900 outline-none ring-teal-500/30 focus:ring-1 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

export function AddLongTermForm({
  instruments,
  instrumentsError,
  toolbarShell,
}: {
  instruments: SymbolFieldInstrument[];
  instrumentsError: string | null;
  toolbarShell: string;
}) {
  const router = useRouter();
  const [symbol, setSymbol] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) {
      setError("Enter a DSE trading code.");
      return;
    }
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("symbol", sym);
    const res = await addLongTermHolding(fd);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSymbol("");
    router.refresh();
  }, [router, symbol]);

  return (
    <div className={toolbarShell}>
      <div className="flex flex-col gap-2">
        {error ? (
          <Alert type="error" showIcon className="text-left" title={error} />
        ) : null}
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 basis-[8rem] sm:max-w-xs">
            <SymbolField
              instruments={instruments}
              loadError={instrumentsError}
              required
              name="symbol"
              aria-label="Symbol (DSE code)"
              placeholder="Symbol (e.g. BATBC)"
              size="sm"
              value={symbol}
              onValueChange={setSymbol}
              className={symbolInputClass}
            />
          </div>
          <Button type="primary" size="middle" className="h-9 shrink-0 px-4 text-[15px] font-normal" loading={busy} onClick={() => void submit()}>
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
