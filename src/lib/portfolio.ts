/**
 * DSE brokerage commission rate (0.40%) applied on both buy and sell.
 * Used for break-even price calculation.
 */
export const BROKERAGE_COMMISSION_RATE = 0.004;

/** Smaller than any meaningful share count or BDT amount we care about. */
const EPSILON_SHARES = 1e-9;
const EPSILON_BDT = 1e-6;

/**
 * Rounds a price to the nearest DSE tick size (BDT 0.10).
 */
export function roundToTickSize(price: number): number {
  return Math.round(price * 10) / 10;
}

/** Round a BDT amount to the nearest paisa. Hides accumulated FP drift. */
export function roundBdt(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

/** Treat sub-paisa amounts as zero (used after subtraction-driven cancellations). */
function snapZeroBdt(amount: number): number {
  return Math.abs(amount) < EPSILON_BDT ? 0 : amount;
}

function snapZeroShares(shares: number): number {
  return Math.abs(shares) < EPSILON_SHARES ? 0 : shares;
}

/**
 * Calculates the break-even price including both buy and sell brokerage fees.
 * Formula: breakEvenPrice = avgPrice × (1 + rate) / (1 − rate)
 * where rate is BROKERAGE_COMMISSION_RATE (0.40%).
 */
export function calculateBreakEvenPrice(avgPrice: number): number {
  const rate = BROKERAGE_COMMISSION_RATE;
  return roundToTickSize((avgPrice * (1 + rate)) / (1 - rate));
}

export type TransactionRow = {
  id: string;
  created_at: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: string | number;
  price_per_share: string | number;
  category: string | null;
  /** BDT charges for this row; folded into cost basis on buys only. */
  fees_bdt?: string | number | null;
};

export type HoldingRow = {
  symbol: string;
  shares: number;
  category: string | null;
  totalCost: number;
  /** True average cost per share: (buys incl. fees − cost removed on sells) ÷ shares. */
  avgPrice: number;
  /**
   * Break-even price including both buy and sell brokerage commissions.
   * Rounded to nearest DSE tick size (BDT 0.10).
   */
  breakEvenPrice: number;
  /**
   * Commission/fees (BDT) attributed to the remaining position after proportional
   * reduction on sells. `avgPrice` already includes this spread across shares.
   */
  feesInPositionBdt: number;
};

function num(v: string | number): number {
  return typeof v === "number" ? v : Number(v);
}

/**
 * Sum of **realized** gain/loss across every sell in the ledger, in
 * chronological order.
 *
 * For each sell, using the running portfolio average cost just before the sell:
 *
 *     realizedPnL += (sell_price − avg_cost_before_sell) × sell_qty
 *
 * Buy-side `fees_bdt` are folded into `avg_cost_before_sell` inside the
 * aggregator, so they are accounted for. Sell-side `fees_bdt` are deliberately
 * **not** subtracted here — they remain a separate trading expense and never
 * touch realized G/L, which represents the gross trade gain.
 */
export function totalRealizedProfitLossBdt(rows: TransactionRow[]): number {
  type State = {
    shares: number;
    totalCost: number;
    feesInPosition: number;
    avg: number;
  };

  const bySymbol = new Map<string, State>();
  let realized = 0;

  const sorted = [...rows].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });

  for (const row of sorted) {
    const symbol = row.symbol.trim().toUpperCase();
    if (!symbol) continue;

    let state = bySymbol.get(symbol);
    if (!state) {
      state = { shares: 0, totalCost: 0, feesInPosition: 0, avg: 0 };
      bySymbol.set(symbol, state);
    }

    const qty = num(row.quantity);
    const price = num(row.price_per_share);
    const fees = Math.max(0, num(row.fees_bdt ?? 0));

    if (row.side === "buy") {
      const newShares = state.shares + qty;
      state.feesInPosition += fees;
      state.totalCost += qty * price + fees;
      state.shares = newShares;
      state.avg = newShares > EPSILON_SHARES ? state.totalCost / newShares : 0;
    } else {
      const preShares = state.shares;
      const sellQty = Math.min(qty, preShares);
      const avgCost = state.avg;

      if (preShares > EPSILON_SHARES && sellQty > 0) {
        // realizedPnL = (sellPrice − avgCost) × qty
        // Buy fees are already embedded in avgCost; sell fees are tracked
        // outside realized G/L so this represents the gross trade gain.
        realized += (price - avgCost) * sellQty;

        const soldFraction = sellQty / preShares;
        state.feesInPosition -= soldFraction * state.feesInPosition;
      }
      state.totalCost = snapZeroBdt(state.totalCost - sellQty * avgCost);
      state.shares = snapZeroShares(state.shares - sellQty);
      if (state.shares <= EPSILON_SHARES) {
        state.shares = 0;
        state.totalCost = 0;
        state.feesInPosition = 0;
        state.avg = 0;
      } else {
        state.avg = state.totalCost / state.shares;
      }
    }
  }

  return roundBdt(realized);
}

export function aggregateHoldings(rows: TransactionRow[]): HoldingRow[] {
  type State = {
    shares: number;
    totalCost: number;
    /** Fees attributed to shares still held (reduced proportionally on each sell). */
    feesInPosition: number;
    avg: number;
    category: string | null;
  };

  const bySymbol = new Map<string, State>();

  const sorted = [...rows].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });

  for (const row of sorted) {
    const symbol = row.symbol.trim().toUpperCase();
    if (!symbol) continue;

    let state = bySymbol.get(symbol);
    if (!state) {
      state = { shares: 0, totalCost: 0, feesInPosition: 0, avg: 0, category: null };
      bySymbol.set(symbol, state);
    }

    if (row.category?.trim()) {
      state.category = row.category.trim();
    }

    const qty = num(row.quantity);
    const price = num(row.price_per_share);

    const fees = Math.max(0, num(row.fees_bdt ?? 0));

    if (row.side === "buy") {
      const newShares = state.shares + qty;
      state.feesInPosition += fees;
      state.totalCost += qty * price + fees;
      state.shares = newShares;
      state.avg = newShares > EPSILON_SHARES ? state.totalCost / newShares : 0;
    } else {
      const preShares = state.shares;
      const sellQty = Math.min(qty, preShares);
      if (preShares > EPSILON_SHARES && sellQty > 0) {
        const soldFraction = sellQty / preShares;
        state.feesInPosition -= soldFraction * state.feesInPosition;
      }
      state.totalCost = snapZeroBdt(state.totalCost - sellQty * state.avg);
      state.shares = snapZeroShares(state.shares - sellQty);
      if (state.shares <= EPSILON_SHARES) {
        state.shares = 0;
        state.totalCost = 0;
        state.feesInPosition = 0;
        state.avg = 0;
      } else {
        state.avg = state.totalCost / state.shares;
      }
    }
  }

  return [...bySymbol.entries()]
    .filter(([, s]) => s.shares > EPSILON_SHARES)
    .map(([symbol, s]) => ({
      symbol,
      shares: s.shares,
      category: s.category,
      totalCost: roundBdt(s.totalCost),
      avgPrice: s.avg,
      breakEvenPrice: calculateBreakEvenPrice(s.avg),
      feesInPositionBdt: roundBdt(Math.max(0, s.feesInPosition)),
    }));
}

/** Largest total cost (book value) first; then symbol A–Z for ties. */
export function sortHoldingsByTotalInvestedDesc(
  holdings: HoldingRow[],
): HoldingRow[] {
  return [...holdings].sort((a, b) => {
    if (b.totalCost !== a.totalCost) {
      return b.totalCost - a.totalCost;
    }
    return a.symbol.localeCompare(b.symbol);
  });
}

export function sharesAvailableForSymbol(
  rows: TransactionRow[],
  symbol: string,
): number {
  const sym = symbol.trim().toUpperCase();
  const holdings = aggregateHoldings(rows);
  const row = holdings.find((h) => h.symbol === sym);
  return row?.shares ?? 0;
}

/**
 * Total invested capital across the currently open positions only.
 *
 * Sells deduct cost basis (`avgPrice × sellQty`) inside {@link aggregateHoldings},
 * so realized profit/loss never leaks into this number — fully sold positions
 * collapse to zero and are filtered out.
 */
export function totalInvestedBdt(holdings: HoldingRow[]): number {
  let sum = 0;
  for (const h of holdings) {
    if (Number.isFinite(h.totalCost) && h.totalCost > 0) sum += h.totalCost;
  }
  return roundBdt(sum);
}

/**
 * Unrealized P/L on currently open positions, using break-even (incl. buy+sell
 * brokerage) as the comparison price. Symbols without a market quote are
 * skipped so totals do not include "0" entries from missing prices.
 */
export function unrealizedGainLossBdt(
  holdings: HoldingRow[],
  ltpBySymbol: ReadonlyMap<string, number | null | undefined>,
): { value: number; quotedCount: number } {
  let value = 0;
  let quotedCount = 0;
  for (const h of holdings) {
    const ltp = ltpBySymbol.get(h.symbol);
    if (ltp !== null && ltp !== undefined && Number.isFinite(ltp)) {
      value += (ltp - h.breakEvenPrice) * h.shares;
      quotedCount += 1;
    }
  }
  return { value: roundBdt(value), quotedCount };
}

export type PortfolioSummary = {
  /** Currently active capital — never includes realized profit/loss. */
  totalInvested: number;
  /** Net realized gain/loss from completed (sell) transactions. */
  realizedGainLoss: number;
  /** Mark-to-market gain/loss on still-open positions (vs break-even price). */
  unrealizedGainLoss: number;
  /**
   * Net of user-entered cash adjustments (deposits add, withdrawals subtract).
   * Folded directly into {@link netGainLoss}.
   */
  cashAdjustments: number;
  /** `realizedGainLoss + unrealizedGainLoss + cashAdjustments` (rounded to cents). */
  netGainLoss: number;
  /** Number of open positions that contributed to {@link unrealizedGainLoss}. */
  quotedPositionCount: number;
};

/**
 * Recommended portfolio structure required by the sell-accounting spec:
 * `{ totalInvested, realizedGainLoss, unrealizedGainLoss, cashAdjustments, netGainLoss }`.
 *
 * `netGainLoss = realizedGainLoss + unrealizedGainLoss + cashAdjustments`.
 * Realized P/L is kept strictly outside `totalInvested` (which only reflects
 * active holdings). `cashAdjustments` is the signed net of manual entries
 * the user records under Settings → Cash adjustments (positive = deposits,
 * negative = withdrawals).
 */
export function computePortfolioSummary(
  holdings: HoldingRow[],
  realizedGainLoss: number,
  ltpBySymbol: ReadonlyMap<string, number | null | undefined>,
  cashAdjustmentsBdt: number = 0,
): PortfolioSummary {
  const totalInvested = totalInvestedBdt(holdings);
  const { value: unrealizedGainLoss, quotedCount } = unrealizedGainLossBdt(
    holdings,
    ltpBySymbol,
  );
  const realized = roundBdt(realizedGainLoss);
  const adjustments = roundBdt(
    Number.isFinite(cashAdjustmentsBdt) ? cashAdjustmentsBdt : 0,
  );
  const net = roundBdt(realized + unrealizedGainLoss + adjustments);
  return {
    totalInvested,
    realizedGainLoss: realized,
    unrealizedGainLoss,
    cashAdjustments: adjustments,
    netGainLoss: net,
    quotedPositionCount: quotedCount,
  };
}
