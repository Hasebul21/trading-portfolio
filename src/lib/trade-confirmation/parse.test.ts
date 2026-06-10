import { describe, it, expect } from "vitest";
import { parseTradeConfirmation, parseTradeDate } from "./parse";

// Representative of the text extracted from a LankaBangla trade confirmation
// note (the columns collapse onto rows of: Symbol Qty Rate Amount Comm Balance).
const SAMPLE = `
LankaBangla Securities PLC TRADE CONFIRMATION NOTE(SUM
Confirmation N 26- 3483
Client Cod E12297 Name Hasebul Hassan Chowdhury
Trading Date: From 10-Jun-2026 To 10-Jun-2026
Market : PUBLIC
Buy
CROWNCEMNT 10 57.0000 570.0000 2.2800 572.2800
MARICO 1 2,754.1000 2,754.1000 11.0164 2,765.1164
TOTAL BUY: (TK.) 3,324.10
Add Comm.: 13.30
Receivable from Client: 3,337.40
Sale
DSSL 225 9.8667 2,220.0000 8.8800 2,211.1200
ENVOYTEX 76 50.3000 3,822.8000 15.2912 3,807.5088
FEKDIL 90 15.8000 1,422.0000 5.6880 1,416.3120
KTL 300 10.1500 3,045.0000 12.1800 3,032.8200
TOTAL SALE: (TK.) 10,509.80
Less Comm.: 42.04
Payable to Client: 10,467.76
`;

describe("parseTradeConfirmation", () => {
  const result = parseTradeConfirmation(SAMPLE);

  it("reads the trade date as ISO", () => {
    expect(result.tradeDate).toBe("2026-06-10");
  });

  it("reads the confirmation number", () => {
    expect(result.confirmationNo).toBe("26-3483");
  });

  it("extracts all six trades", () => {
    expect(result.trades).toHaveLength(6);
    expect(result.warnings).toHaveLength(0);
  });

  it("classifies buys and sells by section", () => {
    const buys = result.trades.filter((t) => t.side === "buy").map((t) => t.symbol);
    const sells = result.trades.filter((t) => t.side === "sell").map((t) => t.symbol);
    expect(buys).toEqual(["CROWNCEMNT", "MARICO"]);
    expect(sells).toEqual(["DSSL", "ENVOYTEX", "FEKDIL", "KTL"]);
  });

  it("maps rate to price/share and comm to fees, handling commas", () => {
    const marico = result.trades.find((t) => t.symbol === "MARICO");
    expect(marico).toMatchObject({
      side: "buy",
      quantity: 1,
      pricePerShare: 2754.1,
      feesBdt: 11.0164,
    });
    const crown = result.trades.find((t) => t.symbol === "CROWNCEMNT");
    expect(crown).toMatchObject({ quantity: 10, pricePerShare: 57, feesBdt: 2.28 });
    const ktl = result.trades.find((t) => t.symbol === "KTL");
    expect(ktl).toMatchObject({ side: "sell", quantity: 300, pricePerShare: 10.15, feesBdt: 12.18 });
  });
});

describe("parseTradeDate", () => {
  it("handles 2-digit years and long month names", () => {
    expect(parseTradeDate("Trading Date: From 01-January-26 To ...")).toBe("2026-01-01");
  });
  it("returns null when absent", () => {
    expect(parseTradeDate("no date here")).toBeNull();
  });
});

describe("parseTradeConfirmation — edge cases", () => {
  it("warns when nothing matches", () => {
    const r = parseTradeConfirmation("just some unrelated text");
    expect(r.trades).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("handles a sell-only note", () => {
    const r = parseTradeConfirmation(
      "Sale\nKTL 300 10.1500 3,045.0000 12.1800 3,032.8200\nTOTAL SALE: (TK.) 3,032.82",
    );
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0]).toMatchObject({ side: "sell", symbol: "KTL" });
  });
});
