import { describe, it, expect } from "vitest";
import {
  aggregateHoldings,
  calculateBreakEvenPrice,
  computePortfolioSummary,
  sharesAvailableForSymbol,
  totalInvestedBdt,
  totalRealizedProfitLossBdt,
  unrealizedGainLossBdt,
  type TransactionRow,
} from "./portfolio";

function buy(
  id: string,
  symbol: string,
  quantity: number,
  price: number,
  fees = 0,
  daysOffset = 0,
): TransactionRow {
  const ts = new Date(2026, 0, 1 + daysOffset, 10).toISOString();
  return {
    id,
    created_at: ts,
    symbol,
    side: "buy",
    quantity,
    price_per_share: price,
    category: null,
    fees_bdt: fees,
  };
}

function sell(
  id: string,
  symbol: string,
  quantity: number,
  price: number,
  fees = 0,
  daysOffset = 1,
): TransactionRow {
  const ts = new Date(2026, 0, 1 + daysOffset, 10).toISOString();
  return {
    id,
    created_at: ts,
    symbol,
    side: "sell",
    quantity,
    price_per_share: price,
    category: null,
    fees_bdt: fees,
  };
}

describe("aggregateHoldings", () => {
  it("should show 0 shares when all sold", () => {
    const rows: TransactionRow[] = [
      {
        id: "1",
        created_at: "2026-04-01T10:00:00Z",
        symbol: "LINDEBD",
        side: "buy",
        quantity: 5,
        price_per_share: 640,
        category: null,
        fees_bdt: 12.8,
      },
      {
        id: "2",
        created_at: "2026-04-30T18:03:00Z",
        symbol: "LINDEBD",
        side: "sell",
        quantity: 3,
        price_per_share: 642.6,
        category: null,
        fees_bdt: 7.71,
      },
      {
        id: "3",
        created_at: "2026-04-30T18:06:00Z",
        symbol: "LINDEBD",
        side: "sell",
        quantity: 2,
        price_per_share: 643,
        category: null,
        fees_bdt: 5.14,
      },
    ];

    const holdings = aggregateHoldings(rows);
    const lindebd = holdings.find((h) => h.symbol === "LINDEBD");
    expect(lindebd).toBeUndefined(); // Should not appear since 0 shares
  });

  it("should correctly calculate remaining shares after partial sell", () => {
    const rows: TransactionRow[] = [
      {
        id: "1",
        created_at: "2026-04-01T10:00:00Z",
        symbol: "LINDEBD",
        side: "buy",
        quantity: 8,
        price_per_share: 640,
        category: null,
        fees_bdt: 20.48,
      },
      {
        id: "2",
        created_at: "2026-04-30T18:03:00Z",
        symbol: "LINDEBD",
        side: "sell",
        quantity: 3,
        price_per_share: 642.6,
        category: null,
        fees_bdt: 7.71,
      },
      {
        id: "3",
        created_at: "2026-04-30T18:06:00Z",
        symbol: "LINDEBD",
        side: "sell",
        quantity: 2,
        price_per_share: 643,
        category: null,
        fees_bdt: 5.14,
      },
    ];

    const holdings = aggregateHoldings(rows);
    const lindebd = holdings.find((h) => h.symbol === "LINDEBD");
    expect(lindebd).toBeDefined();
    expect(lindebd!.shares).toBe(3); // 8 - 3 - 2 = 3
  });
});

describe("calculateBreakEvenPrice", () => {
  it("should calculate break-even including buy and sell fees", () => {
    // avgPrice = 100, rate = 0.4%
    // breakEven = 100 * 1.004 / 0.996 = 100.80...
    const be = calculateBreakEvenPrice(100);
    expect(be).toBeCloseTo(100.8, 1);
  });
});

describe("sell accounting", () => {
  it("profit case: deducts only cost basis from totalInvested and adds (sell − buy) × qty to realized G/L", () => {
    // Spec example: buyPrice=10, sellPrice=12, quantitySold=20.
    // realizedPnL = (12 − 10) × 20 = +40, deductionAmount = 10 × 20 = 200.
    const rows = [buy("1", "ABC", 20, 10), sell("2", "ABC", 20, 12)];

    const holdings = aggregateHoldings(rows);
    expect(holdings.find((h) => h.symbol === "ABC")).toBeUndefined();

    expect(totalInvestedBdt(holdings)).toBe(0);
    expect(totalRealizedProfitLossBdt(rows)).toBe(40);
  });

  it("loss case: still deducts only cost basis from totalInvested even when realized G/L is negative", () => {
    // Spec example: buyPrice=10, sellPrice=8, quantitySold=20.
    // realizedPnL = (8 − 10) × 20 = −40, deductionAmount = 10 × 20 = 200.
    const rows = [buy("1", "ABC", 20, 10), sell("2", "ABC", 20, 8)];

    const holdings = aggregateHoldings(rows);
    expect(holdings.find((h) => h.symbol === "ABC")).toBeUndefined();

    expect(totalInvestedBdt(holdings)).toBe(0);
    expect(totalRealizedProfitLossBdt(rows)).toBe(-40);
  });

  it("partial sell: leaves remaining shares with the same average cost and only deducts the sold portion", () => {
    const rows = [buy("1", "ABC", 20, 10), sell("2", "ABC", 8, 12)];

    const holdings = aggregateHoldings(rows);
    const abc = holdings.find((h) => h.symbol === "ABC");
    expect(abc).toBeDefined();
    expect(abc!.shares).toBe(12);
    expect(abc!.avgPrice).toBeCloseTo(10, 5);
    expect(abc!.totalCost).toBeCloseTo(120, 5);

    expect(totalInvestedBdt(holdings)).toBeCloseTo(120, 5);
    // (12 − 10) × 8 = 16
    expect(totalRealizedProfitLossBdt(rows)).toBe(16);
  });

  it("full sell removes the holding even when more shares are listed than owned", () => {
    // sharesAvailableForSymbol guards against this in the action layer too.
    const rows = [buy("1", "ABC", 20, 10), sell("2", "ABC", 20, 11)];
    expect(sharesAvailableForSymbol([rows[0]!], "ABC")).toBe(20);
    const holdings = aggregateHoldings(rows);
    expect(holdings.length).toBe(0);
  });

  it("multiple symbols: realized P/L and invested capital track each symbol independently", () => {
    const rows = [
      buy("1", "ABC", 10, 10, 0, 0),
      buy("2", "XYZ", 5, 50, 0, 0),
      sell("3", "ABC", 10, 12, 0, 1),
      // XYZ is still open with 5 @ 50 → totalCost 250.
    ];

    const holdings = aggregateHoldings(rows);
    expect(holdings.find((h) => h.symbol === "ABC")).toBeUndefined();
    const xyz = holdings.find((h) => h.symbol === "XYZ");
    expect(xyz).toBeDefined();
    expect(xyz!.shares).toBe(5);
    expect(xyz!.totalCost).toBe(250);

    expect(totalInvestedBdt(holdings)).toBe(250);
    expect(totalRealizedProfitLossBdt(rows)).toBe(20);
  });

  it("realized P/L is never folded back into totalInvested (multi-step sequence)", () => {
    // Scenario: buy 20 @ 10 → sell 20 @ 15 (profit). Then buy 5 @ 8.
    // After everything: invested = 5 × 8 = 40, realized = 100, net later
    // depends only on market price for the remaining 5 shares.
    const rows = [
      buy("1", "ABC", 20, 10, 0, 0),
      sell("2", "ABC", 20, 15, 0, 1),
      buy("3", "ABC", 5, 8, 0, 2),
    ];

    const holdings = aggregateHoldings(rows);
    const abc = holdings.find((h) => h.symbol === "ABC");
    expect(abc).toBeDefined();
    expect(abc!.shares).toBe(5);
    expect(abc!.totalCost).toBe(40);

    expect(totalInvestedBdt(holdings)).toBe(40);
    expect(totalRealizedProfitLossBdt(rows)).toBe(100);
  });
});

describe("computePortfolioSummary", () => {
  it("returns the recommended structure with netGainLoss = realized + unrealized", () => {
    const rows = [
      buy("1", "ABC", 10, 10, 0, 0),
      sell("2", "ABC", 5, 12, 0, 1),
    ];
    const holdings = aggregateHoldings(rows);
    const realized = totalRealizedProfitLossBdt(rows);

    const ltp = new Map<string, number | null>([["ABC", 14]]);
    const summary = computePortfolioSummary(holdings, realized, ltp);

    // Active capital: 5 @ 10 = 50.
    expect(summary.totalInvested).toBe(50);
    // Realized: (12 − 10) × 5 = 10.
    expect(summary.realizedGainLoss).toBe(10);
    // Unrealized vs break-even of 10 (rounded to 0.1) → 10.0 → (14 − 10.0) × 5 = 20.
    expect(summary.unrealizedGainLoss).toBeGreaterThan(19);
    expect(summary.unrealizedGainLoss).toBeLessThan(21);
    expect(summary.netGainLoss).toBeCloseTo(
      summary.realizedGainLoss + summary.unrealizedGainLoss,
      5,
    );
    expect(summary.quotedPositionCount).toBe(1);
  });

  it("skips positions without a market quote when computing unrealized G/L", () => {
    const rows = [buy("1", "ABC", 10, 10), buy("2", "XYZ", 5, 20)];
    const holdings = aggregateHoldings(rows);
    const ltp = new Map<string, number | null>([
      ["ABC", 12],
      ["XYZ", null],
    ]);
    const { value, quotedCount } = unrealizedGainLossBdt(holdings, ltp);
    expect(quotedCount).toBe(1);
    // Only ABC contributes — break-even ~10.1, so ~ (12 − 10.1) × 10 ≈ 19.
    expect(value).toBeGreaterThan(0);
  });

  it("netGainLoss is exactly realized + unrealized (no double-rounding drift)", () => {
    const rows = [buy("1", "ABC", 17, 13.37, 0, 0), sell("2", "ABC", 5, 14.21, 0, 1)];
    const holdings = aggregateHoldings(rows);
    const realized = totalRealizedProfitLossBdt(rows);
    const ltp = new Map<string, number | null>([["ABC", 13.55]]);
    const summary = computePortfolioSummary(holdings, realized, ltp);
    // Fundamental invariant: net = realized + unrealized to within 1 paisa.
    expect(Math.abs(summary.netGainLoss - (summary.realizedGainLoss + summary.unrealizedGainLoss)))
      .toBeLessThanOrEqual(0.01);
  });
});

describe("transaction edit/delete behavior", () => {
  it("deleting a sell transaction restores shares, totalCost, and realized G/L", () => {
    const beforeDelete = [buy("1", "ABC", 20, 10), sell("2", "ABC", 8, 12)];
    const afterDelete = [buy("1", "ABC", 20, 10)];

    const before = aggregateHoldings(beforeDelete).find((h) => h.symbol === "ABC");
    const after = aggregateHoldings(afterDelete).find((h) => h.symbol === "ABC");

    expect(before?.shares).toBe(12);
    expect(after?.shares).toBe(20);
    expect(after?.totalCost).toBe(200);

    expect(totalRealizedProfitLossBdt(beforeDelete)).toBe(16);
    expect(totalRealizedProfitLossBdt(afterDelete)).toBe(0);
  });

  it("deleting a buy transaction recomputes the average correctly from the remaining buys", () => {
    // 10 @ 10 and 10 @ 20 → avg 15. Delete the 10 @ 20 buy → avg back to 10.
    const before = [buy("1", "ABC", 10, 10, 0, 0), buy("2", "ABC", 10, 20, 0, 1)];
    const after = [buy("1", "ABC", 10, 10, 0, 0)];

    const beforeAvg = aggregateHoldings(before).find((h) => h.symbol === "ABC")?.avgPrice;
    const afterAvg = aggregateHoldings(after).find((h) => h.symbol === "ABC")?.avgPrice;
    expect(beforeAvg).toBeCloseTo(15, 5);
    expect(afterAvg).toBeCloseTo(10, 5);
  });

  it("realized P/L is order-independent: same total regardless of input row order", () => {
    const a = [buy("1", "ABC", 10, 10, 0, 0), sell("2", "ABC", 5, 12, 0, 1)];
    const b = [a[1]!, a[0]!]; // reversed
    expect(totalRealizedProfitLossBdt(a)).toBe(totalRealizedProfitLossBdt(b));
  });
});

describe("floating-point precision", () => {
  it("fully-sold position cleans up to exactly zero with non-integer quantities", () => {
    // 0.1 + 0.2 ≠ 0.3 in IEEE 754 — make sure totals don't leak through.
    const rows = [
      buy("1", "ABC", 0.1, 100, 0, 0),
      buy("2", "ABC", 0.2, 100, 0, 1),
      sell("3", "ABC", 0.3, 110, 0, 2),
    ];
    const holdings = aggregateHoldings(rows);
    expect(holdings.find((h) => h.symbol === "ABC")).toBeUndefined();
  });

  it("totalCost in the output is rounded to paisa (no 1e-13 leftovers)", () => {
    const rows = [buy("1", "ABC", 7, 14.37), sell("2", "ABC", 3, 14.4)];
    const holding = aggregateHoldings(rows).find((h) => h.symbol === "ABC")!;
    // Output should be representable with at most 2 decimals.
    expect(holding.totalCost).toBeCloseTo(Math.round(holding.totalCost * 100) / 100, 6);
  });
});

describe("multiple buys then sells", () => {
  it("partial sell uses the running weighted average and leaves it unchanged", () => {
    // Buy 10 @ 10, buy 10 @ 20 → avg 15. Sell 5 @ 25.
    // Realized = (25 − 15) × 5 = 50. Remaining: 15 sh, totalCost = 225, avg = 15.
    const rows = [
      buy("1", "ABC", 10, 10, 0, 0),
      buy("2", "ABC", 10, 20, 0, 1),
      sell("3", "ABC", 5, 25, 0, 2),
    ];

    const holding = aggregateHoldings(rows).find((h) => h.symbol === "ABC")!;
    expect(holding.shares).toBe(15);
    expect(holding.totalCost).toBeCloseTo(225, 5);
    expect(holding.avgPrice).toBeCloseTo(15, 5);
    expect(totalRealizedProfitLossBdt(rows)).toBe(50);
  });

  it("buy fees are folded into avg cost and into realized P/L through the average", () => {
    // Buy 10 @ 100 with 5 BDT fees → totalCost 1005, avg 100.5.
    // Sell 10 @ 100. Realized = (100 − 100.5) × 10 = −5 (= the buy fee absorbed).
    const rows = [buy("1", "ABC", 10, 100, 5, 0), sell("2", "ABC", 10, 100, 0, 1)];
    expect(totalRealizedProfitLossBdt(rows)).toBeCloseTo(-5, 5);
    expect(aggregateHoldings(rows).length).toBe(0);
  });
});
