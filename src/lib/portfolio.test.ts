import { describe, it, expect } from "vitest";
import { aggregateHoldings, calculateBreakEvenPrice, type TransactionRow } from "./portfolio";

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
