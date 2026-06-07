"use client";

import { fetchSellPlanLtps, saveSellPlans } from "@/app/(app)/sell-plan-actions";
import { SymbolField, type SymbolFieldInstrument } from "@/components/symbol-field";
import { formatBdt } from "@/lib/format-bdt";
import {
  SELL_PLAN_MAX_ROWS,
  normalizeSymbol,
  rowProceeds,
  type SellPlanRow,
} from "@/lib/sell-plans";
import { Alert, Button, Card, InputNumber } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DraftRow = {
  /** Stable key for React; preserves identity across edits. */
  key: string;
  symbol: string;
  /** Empty string = "no quantity" (row dropped on save). */
  quantity: string;
};

function fromServer(rows: SellPlanRow[]): DraftRow[] {
  return rows.map((r, i) => ({
    key: r.symbol || `row-${i}`,
    symbol: r.symbol,
    quantity: String(r.quantity_shares),
  }));
}

export function SellPlansForm({
  initialRows,
  instruments,
  instrumentsLoadError,
}: {
  initialRows: SellPlanRow[];
  instruments: SymbolFieldInstrument[];
  instrumentsLoadError?: string | null;
}) {
  const newRowSeq = useRef(0);
  const [draft, setDraft] = useState<DraftRow[]>(() => fromServer(initialRows));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Live last-traded prices keyed by upper-cased symbol. Merged on each fetch
  // so a symbol that briefly has no published price keeps its prior value.
  const [ltpBySymbol, setLtpBySymbol] = useState<Record<string, number>>({});
  const [ltpLoading, setLtpLoading] = useState(false);
  const [ltpError, setLtpError] = useState<string | null>(null);

  const loadLtps = useCallback(async (symbols: ReadonlyArray<string>) => {
    const unique = Array.from(
      new Set(symbols.map((s) => normalizeSymbol(s)).filter(Boolean)),
    );
    if (unique.length === 0) return;
    setLtpLoading(true);
    setLtpError(null);
    try {
      const res = await fetchSellPlanLtps(unique);
      setLtpBySymbol((prev) => ({ ...prev, ...res.ltpBySymbol }));
      setLtpError(res.error);
    } catch (e) {
      setLtpError(e instanceof Error ? e.message : "Could not load prices.");
    } finally {
      setLtpLoading(false);
    }
  }, []);

  // Fetch prices for the saved symbols once on mount. Deferred through a timer
  // so we don't call setState synchronously inside the effect body.
  useEffect(() => {
    const symbols = initialRows.map((r) => r.symbol).filter(Boolean);
    if (symbols.length === 0) return;
    const t = window.setTimeout(() => void loadLtps(symbols), 0);
    return () => window.clearTimeout(t);
    // Run once for the initial set; refreshes afterwards are user-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ltpFor = useCallback(
    (symbol: string): number | null => {
      const v = ltpBySymbol[normalizeSymbol(symbol)];
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    },
    [ltpBySymbol],
  );

  const totalProceeds = useMemo(() => {
    let s = 0;
    for (const row of draft) {
      const qty = Number(row.quantity);
      const proceeds = rowProceeds(qty, ltpFor(row.symbol));
      if (proceeds !== null) s += proceeds;
    }
    return Math.round(s * 100) / 100;
  }, [draft, ltpFor]);

  const setQuantity = useCallback((key: string, value: string) => {
    setError(null);
    setOk(false);
    setDraft((prev) =>
      prev.map((row) => (row.key === key ? { ...row, quantity: value } : row)),
    );
  }, []);

  const setSymbol = useCallback((key: string, value: string) => {
    setError(null);
    setOk(false);
    setDraft((prev) =>
      prev.map((row) => (row.key === key ? { ...row, symbol: value } : row)),
    );
  }, []);

  // When a symbol field loses focus, pull its price if we don't have one yet.
  const fetchIfMissing = useCallback(
    (symbol: string) => {
      const key = normalizeSymbol(symbol);
      if (key && ltpBySymbol[key] === undefined) void loadLtps([key]);
    },
    [ltpBySymbol, loadLtps],
  );

  const removeRow = useCallback((key: string) => {
    setError(null);
    setOk(false);
    setDraft((prev) => prev.filter((row) => row.key !== key));
  }, []);

  const addRow = useCallback(() => {
    setError(null);
    setOk(false);
    if (draft.length >= SELL_PLAN_MAX_ROWS) return;
    const seq = ++newRowSeq.current;
    setDraft((prev) => [...prev, { key: `new::${seq}`, symbol: "", quantity: "" }]);
  }, [draft.length]);

  const refreshPrices = useCallback(() => {
    void loadLtps(draft.map((row) => row.symbol));
  }, [draft, loadLtps]);

  const handleSave = useCallback(async () => {
    setError(null);
    setOk(false);

    const seen = new Set<string>();
    const payload: Array<{ symbol: string; quantity_shares: number }> = [];
    for (const row of draft) {
      const symbol = normalizeSymbol(row.symbol);
      const qtyStr = row.quantity.trim();
      if (!symbol && !qtyStr) continue;
      if (!symbol) {
        setError("Each row needs a stock symbol.");
        return;
      }
      if (seen.has(symbol)) {
        setError(`Duplicate stock "${symbol}".`);
        return;
      }
      seen.add(symbol);
      const qty = Number(qtyStr);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(`${symbol}: quantity must be a positive number of shares.`);
        return;
      }
      payload.push({ symbol, quantity_shares: qty });
    }

    setSaving(true);
    try {
      const res = await saveSellPlans(payload);
      if (!res.ok) {
        setError(res.error);
      } else {
        setOk(true);
        setTimeout(() => setOk(false), 3000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save sell plan.");
    } finally {
      setSaving(false);
    }
  }, [draft]);

  const handleReset = useCallback(() => {
    setError(null);
    setOk(false);
    setDraft(fromServer(initialRows));
  }, [initialRows]);

  return (
    <Card
      variant="outlined"
      className="rounded-xl"
      styles={{ body: { padding: "20px 24px" } }}
    >
      <div className="space-y-4">
        <div>
          <h3 className="text-[14px] text-[var(--ink-strong)]">Sell plan</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-[13px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                <th className="py-2 font-normal">Stock</th>
                <th className="py-2 text-right font-normal">Shares</th>
                <th className="py-2 text-right font-normal">LTP&nbsp;(BDT)</th>
                <th className="py-2 text-right font-normal">Proceeds&nbsp;(BDT)</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {draft.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-4 text-center text-[13px] text-[var(--ink-muted)]"
                  >
                    No stocks yet. Add one below to plan a sell.
                  </td>
                </tr>
              ) : null}
              {draft.map((row) => {
                const ltp = ltpFor(row.symbol);
                const proceeds = rowProceeds(Number(row.quantity), ltp);
                return (
                  <tr key={row.key} className="border-t border-[var(--line)]">
                    <td className="py-1.5 pr-2 align-middle">
                      <SymbolField
                        instruments={instruments}
                        loadError={instrumentsLoadError}
                        name={`sell-symbol-${row.key}`}
                        aria-label="Stock symbol"
                        value={row.symbol}
                        onValueChange={(value) => setSymbol(row.key, value)}
                        onBlur={() => fetchIfMissing(row.symbol)}
                        placeholder="e.g. GP"
                        size="sm"
                      />
                    </td>
                    <td className="py-1.5 pr-2 align-middle text-right">
                      <InputNumber
                        value={row.quantity === "" ? null : Number(row.quantity)}
                        onChange={(val) =>
                          setQuantity(
                            row.key,
                            val === null || val === undefined ? "" : String(val),
                          )
                        }
                        placeholder="—"
                        min={0}
                        step={1}
                        size="middle"
                        className="w-full max-w-[8rem] rounded-md"
                        controls
                      />
                    </td>
                    <td className="py-1.5 pr-2 align-middle text-right tabular-nums text-[var(--ink-strong)]">
                      {ltp !== null ? formatBdt(ltp) : "—"}
                    </td>
                    <td className="py-1.5 pr-2 align-middle text-right tabular-nums text-[var(--ink-strong)]">
                      {proceeds !== null ? `৳${formatBdt(proceeds)}` : "—"}
                    </td>
                    <td className="py-1.5 align-middle text-right">
                      <Button
                        type="link"
                        size="small"
                        danger
                        onClick={() => removeRow(row.key)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="dashed"
              size="middle"
              onClick={addRow}
              disabled={draft.length >= SELL_PLAN_MAX_ROWS}
            >
              + Add stock
            </Button>
            <Button
              type="default"
              size="middle"
              onClick={refreshPrices}
              loading={ltpLoading}
              disabled={ltpLoading || draft.length === 0}
            >
              Refresh prices
            </Button>
          </div>
          <div className="text-right">
            <div className="text-[13px] tabular-nums text-[var(--ink-strong)]">
              ৳{formatBdt(totalProceeds)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="primary"
            size="large"
            loading={saving}
            disabled={saving}
            onClick={() => void handleSave()}
          >
            Save sell plan
          </Button>
          <Button
            type="default"
            size="large"
            disabled={saving}
            onClick={handleReset}
          >
            Reset
          </Button>
        </div>

        {ltpError ? (
          <Alert
            type="warning"
            showIcon
            message="Could not refresh some prices"
            description={ltpError}
          />
        ) : null}
        {error ? (
          <Alert type="error" showIcon message="Could not save" description={error} />
        ) : null}
        {ok ? (
          <Alert
            type="success"
            showIcon
            message="Saved"
            description="Sell plan updated. The picked stocks are flagged in your portfolio."
          />
        ) : null}
      </div>
    </Card>
  );
}
