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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icons, SCard, SCardBody, SCardHead, SErr, SOk, SStat, SStats, SWarn } from "./settings-ui";

type DraftRow = { key: string; symbol: string; quantity: string };

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

  const [ltpBySymbol, setLtpBySymbol] = useState<Record<string, number>>({});
  const [ltpLoading, setLtpLoading] = useState(false);
  const [ltpError, setLtpError] = useState<string | null>(null);

  const loadLtps = useCallback(async (symbols: ReadonlyArray<string>) => {
    const unique = Array.from(new Set(symbols.map((s) => normalizeSymbol(s)).filter(Boolean)));
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

  useEffect(() => {
    const symbols = initialRows.map((r) => r.symbol).filter(Boolean);
    if (symbols.length === 0) return;
    const t = window.setTimeout(() => void loadLtps(symbols), 0);
    return () => window.clearTimeout(t);
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
      const proceeds = rowProceeds(Number(row.quantity), ltpFor(row.symbol));
      if (proceeds !== null) s += proceeds;
    }
    return Math.round(s * 100) / 100;
  }, [draft, ltpFor]);

  const stagedCount = useMemo(() => draft.filter((r) => normalizeSymbol(r.symbol)).length, [draft]);
  const pricedCount = useMemo(() => draft.filter((r) => ltpFor(r.symbol) !== null).length, [draft, ltpFor]);

  const setQuantity = useCallback((key: string, value: string) => {
    setError(null);
    setOk(false);
    setDraft((prev) => prev.map((row) => (row.key === key ? { ...row, quantity: value } : row)));
  }, []);

  const setSymbol = useCallback((key: string, value: string) => {
    setError(null);
    setOk(false);
    setDraft((prev) => prev.map((row) => (row.key === key ? { ...row, symbol: value } : row)));
  }, []);

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
      if (!res.ok) setError(res.error);
      else {
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
    <>
      <SStats>
        <SStat k="Stocks staged" v={stagedCount} />
        <SStat k="Est. proceeds" v={`৳${formatBdt(totalProceeds)}`} tone="gain" d="at last traded price" />
        <SStat k="Priced" v={`${pricedCount}/${stagedCount}`} d="DSE live feed" small />
      </SStats>

      <SCard>
        <SCardHead
          tone="gain"
          icon={Icons.sell()}
          title="Sell plan"
          desc="Stage the shares you intend to sell. Picked stocks are flagged in your portfolio, and estimated proceeds use the latest traded price."
        />
        <SCardBody>
          <table className="tbl">
            <thead>
              <tr>
                <th>Stock</th>
                <th className="r">Shares</th>
                <th className="r">LTP&nbsp;(BDT)</th>
                <th className="r">Proceeds&nbsp;(BDT)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {draft.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-row">No stocks yet. Add one below to plan a sell.</div>
                  </td>
                </tr>
              ) : null}
              {draft.map((row) => {
                const ltp = ltpFor(row.symbol);
                const proceeds = rowProceeds(Number(row.quantity), ltp);
                return (
                  <tr key={row.key}>
                    <td style={{ maxWidth: 220 }}>
                      <SymbolField
                        instruments={instruments}
                        loadError={instrumentsLoadError}
                        name={`sell-symbol-${row.key}`}
                        aria-label="Stock symbol"
                        value={row.symbol}
                        onValueChange={(value) => setSymbol(row.key, value)}
                        onBlur={() => fetchIfMissing(row.symbol)}
                        placeholder="e.g. GP"
                        className="inp mono"
                      />
                    </td>
                    <td className="td-r">
                      <div className="inp-affix num-inp" style={{ display: "inline-flex" }}>
                        <input
                          inputMode="numeric"
                          value={row.quantity}
                          onChange={(e) => setQuantity(row.key, e.target.value)}
                          placeholder="—"
                        />
                      </div>
                    </td>
                    <td className="td-r mono" style={{ color: "var(--ink-default)" }}>
                      {ltp !== null ? formatBdt(ltp) : "—"}
                    </td>
                    <td className="td-r mono" style={{ color: "var(--ink-strong)" }}>
                      {proceeds !== null ? `৳${formatBdt(proceeds)}` : "—"}
                    </td>
                    <td className="td-r">
                      <button className="btn-link" onClick={() => removeRow(row.key)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="foot-row">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn-dashed" onClick={addRow} disabled={draft.length >= SELL_PLAN_MAX_ROWS}>
                + Add stock
              </button>
              <button
                className="btn-dashed"
                style={{ borderStyle: "solid" }}
                onClick={refreshPrices}
                disabled={ltpLoading || draft.length === 0}
              >
                {ltpLoading ? "Refreshing…" : "↻ Refresh prices"}
              </button>
            </div>
            <div className="total">
              Total proceeds: <b className="ok">৳{formatBdt(totalProceeds)}</b>
            </div>
          </div>

          <div className="btn-row">
            <button className="btn btn-primary" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Saving…" : "Save sell plan"}
            </button>
            <button className="btn btn-default" disabled={saving} onClick={handleReset}>
              Reset
            </button>
          </div>

          {ltpError ? <SWarn title="Could not refresh some prices">{ltpError}</SWarn> : null}
          {error ? <SErr>{error}</SErr> : null}
          {ok ? <SOk>Sell plan updated. The picked stocks are flagged in your portfolio.</SOk> : null}
        </SCardBody>
      </SCard>
    </>
  );
}
