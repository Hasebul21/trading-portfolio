import { describe, it, expect } from "vitest";
import {
  calculateBreakEvenPrice,
  roundToNearestTen,
  BROKERAGE_COMMISSION_RATE,
  aggregateHoldings,
  type TransactionRow,
} from "./portfolio";

describe("roundToNearestTen", () => {
  it("rounds 270.77 to 270.8", () => {
    expect(roundToNearestTen(270.77)).toBe(270.8);
  });

  it("rounds 100.84 to 100.8", () => {
    expect(roundToNearestTen(100.84)).toBe(100.8);
  });

  it("rounds 100.85 to 100.9", () => {
    expect(roundToNearestTen(100.85)).toBe(100.9);
  });
});

describe("calculateBreakEvenPrice", () => {
  it("returns correct break-even price with default rate (100 → 100.8)", () => {
    const result = calculateBreakEvenPrice(100);
    // Formula: 100 * (1 + 0.004) / (1 - 0.004) = 100.4 / 0.996 ≈ 100.8032 → rounded to 100.8
    expect(result).toBe(100.8);
  });

  it("returns 0 for zero or negative avgBuyPrice", () => {
    expect(calculateBreakEvenPrice(0)).toBe(0);
    expect(calculateBreakEvenPrice(-50)).toBe(0);
  });

  it("returns 0 for NaN or Infinity avgBuyPrice", () => {
    expect(calculateBreakEvenPrice(NaN)).toBe(0);
    expect(calculateBreakEvenPrice(Infinity)).toBe(0);
    expect(calculateBreakEvenPrice(-Infinity)).toBe(0);
  });

  it("handles small prices correctly", () => {
    const result = calculateBreakEvenPrice(1.5);
    // 1.5 * 1.004 / 0.996 ≈ 1.512 → rounded to 1.5
    expect(result).toBe(1.5);
  });

  it("handles high commission rate", () => {
    const result = calculateBreakEvenPrice(100, 0.05);
    // 100 * 1.05 / 0.95 ≈ 110.526 → rounded to 110.5
    expect(result).toBe(110.5);
  });

  it("returns avgBuyPrice rounded when commission rate is invalid", () => {
    expect(calculateBreakEvenPrice(100.77, -0.01)).toBe(100.8);
    expect(calculateBreakEvenPrice(100, 1)).toBe(100);
    expect(calculateBreakEvenPrice(100.77, NaN)).toBe(100.8);
  });

  it("uses BROKERAGE_COMMISSION_RATE constant (0.004)", () => {
    expect(BROKERAGE_COMMISSION_RATE).toBe(0.004);
  });
});

describe("aggregateHoldings", () => {
  it("computes breakEvenPrice for a simple buy", () => {
    const rows: TransactionRow[] = [
      {
        id: "1",
        created_at: "2024-01-01T10:00:00Z",
        symbol: "TEST",
        side: "buy",
        quantity: 100,
        price_per_share: 50,
        category: "Tech",
      },
    ];

    const holdings = aggregateHoldings(rows);
    expect(holdings).toHaveLength(1);
    expect(holdings[0]!.symbol).toBe("TEST");
    expect(holdings[0]!.avgPrice).toBe(50);
    // breakEvenPrice = 50 * 1.004 / 0.996 ≈ 50.4016 → rounded to 50.4
    expect(holdings[0]!.breakEvenPrice).toBe(50.4);
  });

  it("computes weighted average then breakEvenPrice for multiple buys", () => {
    const rows: TransactionRow[] = [
      {
        id: "1",
        created_at: "2024-01-01T10:00:00Z",
        symbol: "TEST",
        side: "buy",
        quantity: 100,
        price_per_share: 40,
        category: null,
      },
      {
        id: "2",
        created_at: "2024-01-02T10:00:00Z",
        symbol: "TEST",
        side: "buy",
        quantity: 100,
        price_per_share: 60,
        category: null,
      },
    ];

    const holdings = aggregateHoldings(rows);
    expect(holdings).toHaveLength(1);
    // Weighted avg = (100*40 + 100*60) / 200 = 50
    expect(holdings[0]!.avgPrice).toBe(50);
    // breakEvenPrice ≈ 50.4016 → rounded to 50.4
    expect(holdings[0]!.breakEvenPrice).toBe(50.4);
  });

  it("returns empty array for fully sold position", () => {
    const rows: TransactionRow[] = [
      {
        id: "1",
        created_at: "2024-01-01T10:00:00Z",
        symbol: "TEST",
        side: "buy",
        quantity: 100,
        price_per_share: 50,
        category: null,
      },
      {
        id: "2",
        created_at: "2024-01-02T10:00:00Z",
        symbol: "TEST",
        side: "sell",
        quantity: 100,
        price_per_share: 60,
        category: null,
      },
    ];

    const holdings = aggregateHoldings(rows);
    expect(holdings).toHaveLength(0);
  });
});
