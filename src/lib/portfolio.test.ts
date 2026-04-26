import { describe, it, expect } from "vitest";
import {
  calculateBreakEvenPrice,
  BROKERAGE_COMMISSION_RATE,
  aggregateHoldings,
  type TransactionRow,
} from "./portfolio";

describe("calculateBreakEvenPrice", () => {
  it("returns correct break-even price with default rate (100 → ~100.80)", () => {
    const result = calculateBreakEvenPrice(100);
    // Formula: 100 * (1 + 0.004) / (1 - 0.004) = 100.4 / 0.996 ≈ 100.8032
    expect(result).toBeCloseTo(100.8032, 2);
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
    // 1.5 * 1.004 / 0.996 ≈ 1.512
    expect(result).toBeCloseTo(1.512, 3);
  });

  it("handles high commission rate", () => {
    const result = calculateBreakEvenPrice(100, 0.05);
    // 100 * 1.05 / 0.95 ≈ 110.526
    expect(result).toBeCloseTo(110.526, 2);
  });

  it("returns avgBuyPrice unchanged when commission rate is invalid", () => {
    expect(calculateBreakEvenPrice(100, -0.01)).toBe(100);
    expect(calculateBreakEvenPrice(100, 1)).toBe(100);
    expect(calculateBreakEvenPrice(100, NaN)).toBe(100);
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
    // breakEvenPrice = 50 * 1.004 / 0.996 ≈ 50.4016
    expect(holdings[0]!.breakEvenPrice).toBeCloseTo(50.4016, 2);
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
    // breakEvenPrice ≈ 50.4016
    expect(holdings[0]!.breakEvenPrice).toBeCloseTo(50.4016, 2);
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
