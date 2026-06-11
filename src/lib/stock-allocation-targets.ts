/**
 * Per-stock allocation-target helpers — pure functions shared by the portfolio
 * page UI and the server action so the same rules apply on both sides.
 *
 * A "stock allocation target" is the share of a *sector's* investment the user
 * wants in one symbol — e.g. inside Bank: BRACBANK 30%, EBL 20%. Targets are
 * relative to the sector and should sum to 100% per sector, but we don't force
 * it; the UI nudges and allows partial allocations.
 */

import { normalizeSymbol } from "@/lib/sell-plans";

export type StockAllocationRow = {
  symbol: string;
  /** Informational — the sector the symbol was in when the target was saved. */
  sector: string;
  target_percent: number;
};

export const STOCK_ALLOCATION_MAX_ROWS = 300;

export type StockAllocationValidation =
  | { ok: true; rows: StockAllocationRow[] }
  | { ok: false; error: string };

/**
 * Validate a list of edited per-stock target rows. Caps total rows, rejects
 * bad percentages, deduplicates by upper-cased symbol, and returns the
 * canonical rows. Blank/omitted targets are expected to be filtered out by the
 * caller before validation (they map to "no target" → delete).
 */
export function validateStockAllocations(
  raw: ReadonlyArray<{ symbol: string; sector?: unknown; target_percent: unknown }>,
): StockAllocationValidation {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Invalid payload." };
  }
  if (raw.length > STOCK_ALLOCATION_MAX_ROWS) {
    return {
      ok: false,
      error: `Too many stocks (max ${STOCK_ALLOCATION_MAX_ROWS}).`,
    };
  }

  const seen = new Set<string>();
  const rows: StockAllocationRow[] = [];

  for (const row of raw) {
    const symbol = normalizeSymbol(row.symbol);
    if (!symbol) {
      return { ok: false, error: "Symbol is required." };
    }
    if (seen.has(symbol)) {
      return { ok: false, error: `Duplicate symbol "${symbol}".` };
    }
    seen.add(symbol);

    const num = Number(row.target_percent);
    if (!Number.isFinite(num) || num < 0 || num > 100) {
      return {
        ok: false,
        error: `${symbol}: target must be between 0 and 100.`,
      };
    }
    const sector = String(row.sector ?? "").trim();
    rows.push({
      symbol,
      sector,
      target_percent: Math.round(num * 100) / 100,
    });
  }

  return { ok: true, rows };
}
