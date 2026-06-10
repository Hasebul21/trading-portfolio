/**
 * Sell-plan helpers — pure functions shared by the settings UI and the server
 * action so the same rules apply on both sides (symbol normalisation, dedup,
 * quantity bounds).
 *
 * A sell plan is a list of (symbol, quantity_shares) rows: the shares the user
 * intends to sell. Proceeds are deliberately NOT stored — they are computed
 * live from the current DSE last-traded price (LTP) so the plan always tracks
 * today's market. See {@link computeSellPlanProceeds}.
 */

export type SellPlanRow = {
  symbol: string;
  quantity_shares: number;
};

/** Same row cap as the other bulk-edited settings tables. */
export const SELL_PLAN_MAX_ROWS = 100;

/** Sanity cap so a fat-fingered entry can't store an absurd quantity. */
export const SELL_PLAN_MAX_QUANTITY = 1_000_000_000;

/** Canonical trading-code form: trimmed, upper-cased (matches DSE LSP keys). */
export function normalizeSymbol(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase();
}

export type SellPlanValidation =
  | { ok: true; rows: SellPlanRow[] }
  | { ok: false; error: string };

/**
 * Validate a list of edited sell-plan rows. Caps total rows, rejects
 * non-positive / out-of-range quantities, deduplicates by upper-cased symbol,
 * and returns the canonical rows.
 */
export function validateSellPlans(
  raw: ReadonlyArray<{ symbol: string; quantity_shares: unknown }>,
): SellPlanValidation {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Invalid payload." };
  }
  if (raw.length > SELL_PLAN_MAX_ROWS) {
    return { ok: false, error: `Too many stocks (max ${SELL_PLAN_MAX_ROWS}).` };
  }

  const seen = new Set<string>();
  const rows: SellPlanRow[] = [];

  for (const row of raw) {
    const symbol = normalizeSymbol(row.symbol);
    if (!symbol) {
      return { ok: false, error: "Stock symbol is required." };
    }
    if (seen.has(symbol)) {
      return { ok: false, error: `Duplicate stock "${symbol}".` };
    }
    seen.add(symbol);

    const qty = Number(row.quantity_shares);
    if (!Number.isFinite(qty) || qty <= 0 || qty > SELL_PLAN_MAX_QUANTITY) {
      return {
        ok: false,
        error: `${symbol}: quantity must be between 1 and ${SELL_PLAN_MAX_QUANTITY.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
      };
    }
    rows.push({ symbol, quantity_shares: Math.round(qty * 100) / 100 });
  }

  return { ok: true, rows };
}

/** Per-stock proceeds = quantity × LTP, rounded to 2 dp. Null when no LTP. */
export function rowProceeds(
  quantityShares: number,
  ltp: number | null | undefined,
): number | null {
  if (ltp === null || ltp === undefined || !Number.isFinite(ltp)) return null;
  if (!Number.isFinite(quantityShares) || quantityShares <= 0) return null;
  return Math.round(quantityShares * ltp * 100) / 100;
}
