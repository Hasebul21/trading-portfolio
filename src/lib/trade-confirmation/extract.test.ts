import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractPdfText } from "./extract";
import { parseTradeConfirmation } from "./parse";

/**
 * Reproduces the real-world failure: a table PDF whose cells are emitted in a
 * scrambled content-stream order (NOT row-by-row), as the LankaBangla note
 * does. Coordinate-based extraction must still rebuild the correct rows.
 */

// Column x-positions mimic the note's layout: Symbol, Qty, Rate, Amount, Comm, Bal.
const COL = { sym: 40, qty: 150, rate: 210, amount: 290, comm: 380, bal: 460 };

type Cell = { x: number; y: number; text: string };

const HEADER_Y = 740;
const cells: Cell[] = [
  { x: COL.sym, y: HEADER_Y, text: "Instrument Name Total Qty. Avg. Rate Amount Comm. Balance" },
  { x: COL.sym, y: 720, text: "Buy" },
  // Buy rows
  ...row(700, "CROWNCEMNT", "10", "57.0000", "570.0000", "2.2800", "572.2800"),
  ...row(684, "MARICO", "1", "2,754.1000", "2,754.1000", "11.0164", "2,765.1164"),
  { x: COL.amount, y: 664, text: "TOTAL BUY: (TK.) 3,324.10" },
  { x: COL.sym, y: 644, text: "Sale" },
  // Sale rows
  ...row(624, "DSSL", "225", "9.8667", "2,220.0000", "8.8800", "2,211.1200"),
  ...row(608, "ENVOYTEX", "76", "50.3000", "3,822.8000", "15.2912", "3,807.5088"),
  ...row(592, "FEKDIL", "90", "15.8000", "1,422.0000", "5.6880", "1,416.3120"),
  ...row(576, "KTL", "300", "10.1500", "3,045.0000", "12.1800", "3,032.8200"),
  { x: COL.amount, y: 556, text: "TOTAL SALE: (TK.) 10,509.80" },
  { x: COL.sym, y: 766, text: "Trading Date: From 10-Jun-2026 To 10-Jun-2026" },
];

function row(
  y: number,
  sym: string,
  qty: string,
  rate: string,
  amount: string,
  comm: string,
  bal: string,
): Cell[] {
  return [
    { x: COL.sym, y, text: sym },
    { x: COL.qty, y, text: qty },
    { x: COL.rate, y, text: rate },
    { x: COL.amount, y, text: amount },
    { x: COL.comm, y, text: comm },
    { x: COL.bal, y, text: bal },
  ];
}

/** Deterministic, non-row-order shuffle (column-major-ish) — no Math.random. */
function scramble<T>(arr: T[]): T[] {
  const out: T[] = [];
  for (let step = 0; step < 7; step += 1) {
    for (let i = step; i < arr.length; i += 7) out.push(arr[i]);
  }
  return out;
}

async function buildScrambledPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const c of scramble(cells)) {
    page.drawText(c.text, { x: c.x, y: c.y, size: 8, font });
  }
  return doc.save();
}

describe("coordinate-based extraction survives scrambled stream order", () => {
  it("rebuilds rows and parses all six trades with correct columns", async () => {
    const text = await extractPdfText(await buildScrambledPdf());
    const parsed = parseTradeConfirmation(text);

    expect(parsed.tradeDate).toBe("2026-06-10");
    expect(parsed.trades).toHaveLength(6);

    const byKey = Object.fromEntries(parsed.trades.map((t) => [t.symbol, t]));
    expect(byKey.CROWNCEMNT).toMatchObject({
      side: "buy", quantity: 10, pricePerShare: 57, feesBdt: 2.28,
    });
    expect(byKey.MARICO).toMatchObject({
      side: "buy", quantity: 1, pricePerShare: 2754.1, feesBdt: 11.0164,
    });
    expect(byKey.DSSL).toMatchObject({
      side: "sell", quantity: 225, pricePerShare: 9.8667, feesBdt: 8.88,
    });
    expect(byKey.ENVOYTEX).toMatchObject({
      side: "sell", quantity: 76, pricePerShare: 50.3, feesBdt: 15.2912,
    });
    expect(byKey.FEKDIL).toMatchObject({
      side: "sell", quantity: 90, pricePerShare: 15.8, feesBdt: 5.688,
    });
    expect(byKey.KTL).toMatchObject({
      side: "sell", quantity: 300, pricePerShare: 10.15, feesBdt: 12.18,
    });
  });
});
