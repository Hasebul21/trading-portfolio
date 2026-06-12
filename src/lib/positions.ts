/**
 * Positions helpers — pure functions shared by the Positions UI and the server
 * actions so buy/sell plans validate and price identically on both sides
 * (symbol normalisation, quantity/price bounds, commission-adjusted amount).
 *
 * A plan is a (side, symbol, quantity_shares, target_price) row. The "amount"
 * that moves the standalone balance when the row is marked executed includes
 * trade commission: a buy costs `qty × price × (1 + rate)` (deducted), a sell
 * yields `qty × price × (1 − rate)` (added).
 */

export type PositionSide = "buy" | "sell";

/** Brokerage houses the user can place a plan through. */
export const POSITION_BROKERAGES = ["IDLC", "LankaBangla", "BRAC EPL"] as const;
export type PositionBrokerage = (typeof POSITION_BROKERAGES)[number];

export type PositionPlanRow = {
  id: string;
  side: PositionSide;
  symbol: string;
  quantity_shares: number;
  target_price: number;
  brokerage: PositionBrokerage | null;
  executed: boolean;
  created_at: string;
};

/** Sanity caps mirroring the other plan tables. */
export const POSITION_MAX_QUANTITY = 1_000_000_000;
export const POSITION_MAX_PRICE = 1_000_000;

export function normalizeBrokerage(raw: unknown): PositionBrokerage | null {
  const s = String(raw ?? "").trim();
  return (POSITION_BROKERAGES as readonly string[]).includes(s)
    ? (s as PositionBrokerage)
    : null;
}

/** Canonical trading-code form: trimmed, upper-cased (matches DSE LSP keys). */
export function normalizeSymbol(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase();
}

export type PositionPlanInput = {
  side: PositionSide;
  symbol: string;
  quantity_shares: unknown;
  target_price: unknown;
  brokerage: unknown;
};

export type PositionPlanValidation =
  | {
      ok: true;
      row: {
        side: PositionSide;
        symbol: string;
        quantity_shares: number;
        target_price: number;
        brokerage: PositionBrokerage;
      };
    }
  | { ok: false; error: string };

/** Validate one buy/sell plan before it is inserted. */
export function validatePositionPlan(raw: PositionPlanInput): PositionPlanValidation {
  if (raw.side !== "buy" && raw.side !== "sell") {
    return { ok: false, error: "Choose buy or sell." };
  }

  const symbol = normalizeSymbol(raw.symbol);
  if (!symbol) return { ok: false, error: "Stock symbol is required." };

  const qty = Number(raw.quantity_shares);
  if (!Number.isFinite(qty) || qty <= 0 || qty > POSITION_MAX_QUANTITY) {
    return { ok: false, error: "Enter a valid quantity." };
  }

  const price = Number(raw.target_price);
  if (!Number.isFinite(price) || price <= 0 || price > POSITION_MAX_PRICE) {
    return { ok: false, error: "Enter a valid target price." };
  }

  const brokerage = normalizeBrokerage(raw.brokerage);
  if (!brokerage) return { ok: false, error: "Choose a brokerage house." };

  return {
    ok: true,
    row: {
      side: raw.side,
      symbol,
      quantity_shares: Math.round(qty * 100) / 100,
      target_price: Math.round(price * 100) / 100,
      brokerage,
    },
  };
}

/**
 * Commission-adjusted amount that moves the balance when a plan is marked.
 * Buys return a positive cost (to deduct), sells a positive proceed (to add).
 */
export function planAmount(
  side: PositionSide,
  quantityShares: number,
  targetPrice: number,
  commissionRate: number | null | undefined,
): number {
  const gross = quantityShares * targetPrice;
  const rate = Number.isFinite(commissionRate) && commissionRate ? commissionRate : 0;
  const factor = side === "buy" ? 1 + rate : 1 - rate;
  return Math.round(gross * factor * 100) / 100;
}

/** Signed balance delta applied on mark: buy deducts, sell adds. */
export function planBalanceDelta(
  side: PositionSide,
  quantityShares: number,
  targetPrice: number,
  commissionRate: number | null | undefined,
): number {
  const amount = planAmount(side, quantityShares, targetPrice, commissionRate);
  return side === "buy" ? -amount : amount;
}
