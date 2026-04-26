/**
 * DSE brokerage commission rate (0.40%).
 * Applied on both buy and sell transactions.
 */
export const BROKERAGE_COMMISSION_RATE = 0.004;

/**
 * Calculate break-even sell price that covers buy-side and sell-side brokerage commissions.
 * Formula: breakEvenPrice = avgBuyPrice * (1 + rate) / (1 - rate)
 *
 * @param avgBuyPrice - Average cost per share including buy fees
 * @param commissionRate - Commission rate (defaults to BROKERAGE_COMMISSION_RATE)
 * @returns Minimum sell price to break even after all fees
 */
export function calculateBreakEvenPrice(
  avgBuyPrice: number,
  commissionRate: number = BROKERAGE_COMMISSION_RATE,
): number {
  if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) return 0;
  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate >= 1) {
    return avgBuyPrice;
  }
  return (avgBuyPrice * (1 + commissionRate)) / (1 - commissionRate);
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
   * Minimum sell price per share to break even after both buy and sell brokerage fees.
   * Computed as: avgPrice * (1 + commissionRate) / (1 - commissionRate)
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
 * Sum of **sell-only** gain/loss from the ledger, in chronological order.
 * For each sell row (after buys have built the book): take **portfolio average
 * cost per share** just before that sell, **sell quantity** and **sell price**
 * from the row. Each sell adds:
 *
 * `(sell_price × sell_qty) − (avg_at_sell × sell_qty) − sell_fees`
 *
 * (same as net proceeds minus cost of shares sold). Buy-side `fees_bdt` are
 * already inside `avg` via {@link aggregateHoldings} rules.
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
      state.avg = newShares > 0 ? state.totalCost / newShares : 0;
    } else {
      const preShares = state.shares;
      const sellQty = Math.min(qty, preShares);
      const avgCost = state.avg;

      if (preShares > 0 && sellQty > 0) {
        const costBasisSold = sellQty * avgCost;
        const proceedsNet = sellQty * price - fees;
        realized += proceedsNet - costBasisSold;
      }

      if (preShares > 0 && sellQty > 0) {
        const soldFraction = sellQty / preShares;
        state.feesInPosition -= soldFraction * state.feesInPosition;
      }
      state.totalCost -= sellQty * avgCost;
      state.shares -= sellQty;
      if (state.shares <= 0) {
        state.shares = 0;
        state.totalCost = 0;
        state.feesInPosition = 0;
        state.avg = 0;
      } else {
        state.avg = state.totalCost / state.shares;
      }
    }
  }

  return Math.round(realized * 100) / 100;
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
      state.avg = newShares > 0 ? state.totalCost / newShares : 0;
    } else {
      const preShares = state.shares;
      const sellQty = Math.min(qty, preShares);
      if (preShares > 0 && sellQty > 0) {
        const soldFraction = sellQty / preShares;
        state.feesInPosition -= soldFraction * state.feesInPosition;
      }
      state.totalCost -= sellQty * state.avg;
      state.shares -= sellQty;
      if (state.shares <= 0) {
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
    .filter(([, s]) => s.shares > 0)
    .map(([symbol, s]) => ({
      symbol,
      shares: s.shares,
      category: s.category,
      totalCost: s.totalCost,
      avgPrice: s.avg,
      breakEvenPrice: calculateBreakEvenPrice(s.avg),
      feesInPositionBdt:
        Math.round(Math.max(0, s.feesInPosition) * 100) / 100,
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
