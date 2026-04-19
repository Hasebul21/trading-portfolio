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
  avgPrice: number;
};

function num(v: string | number): number {
  return typeof v === "number" ? v : Number(v);
}

export function aggregateHoldings(rows: TransactionRow[]): HoldingRow[] {
  type State = {
    shares: number;
    totalCost: number;
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
      state = { shares: 0, totalCost: 0, avg: 0, category: null };
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
      state.totalCost += qty * price + fees;
      state.shares = newShares;
      state.avg = newShares > 0 ? state.totalCost / newShares : 0;
    } else {
      const sellQty = Math.min(qty, state.shares);
      state.totalCost -= sellQty * state.avg;
      state.shares -= sellQty;
      if (state.shares <= 0) {
        state.shares = 0;
        state.totalCost = 0;
        state.avg = 0;
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
