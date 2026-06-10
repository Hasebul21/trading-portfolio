/**
 * Parser for LankaBangla Securities "Trade Confirmation Note" PDFs.
 *
 * The note lists trades in two sections — a Buy block and a Sale block — each
 * row being:  Symbol  Qty  Avg.Rate  Amount  Comm.  Balance
 * e.g.  `CROWNCEMNT 10 57.0000 570.0000 2.2800 572.2800`
 *
 * We map each row to a transaction: Avg.Rate → price/share, Comm. → fees_bdt.
 * The `TOTAL BUY` / `TOTAL SALE` summary lines anchor which section a row
 * belongs to, which is more robust than relying on the "Buy"/"Sale" header
 * tokens surviving PDF text extraction intact.
 *
 * This module is intentionally free of any PDF/IO dependency so it stays a
 * pure, unit-testable function. Text extraction lives in `extract.ts`.
 */

export type ParsedTrade = {
  symbol: string;
  side: "buy" | "sell";
  /** Whole shares; the note always quotes integer quantities. */
  quantity: number;
  /** Avg. Rate column — price per share in BDT. */
  pricePerShare: number;
  /** Comm. column — broker commission in BDT for this row. */
  feesBdt: number;
};

export type ParsedConfirmation = {
  /** Trading date as ISO `YYYY-MM-DD`, or null if it could not be read. */
  tradeDate: string | null;
  /** Confirmation note number (cosmetic), best-effort. */
  confirmationNo: string | null;
  trades: ParsedTrade[];
  /** Non-fatal notes surfaced to the user (e.g. nothing parsed). */
  warnings: string[];
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * A single data row within one reconstructed line: a symbol token followed by
 * exactly five numeric columns — Qty, Avg.Rate, Amount, Comm, Balance.
 *
 * Anchored to the end of the (trimmed) line so the five columns are pinned to
 * this row, but NOT to the start — a leading "Buy"/"Sale"/section label that
 * lands on the same reconstructed row is skipped, and the engine locks onto the
 * symbol that actually precedes the five numbers.
 */
const ROW_RE =
  /([A-Z][A-Z0-9.()&/_-]{0,24})\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)$/;

function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

/** Parse `10-Jun-2026` (or `10-June-26`) into an ISO `YYYY-MM-DD` date. */
export function parseTradeDate(text: string): string | null {
  const m = text.match(/Trading\s*Date[\s:]*(?:From)?\s*(\d{1,2})-([A-Za-z]{3,})-(\d{2,4})/i);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
  let year = Number(m[3]);
  if (!month || !Number.isFinite(day) || !Number.isFinite(year)) return null;
  if (year < 100) year += 2000;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function parseConfirmationNo(text: string): string | null {
  const m = text.match(/Confirmation\s*N[o.]*\s*([0-9]+\s*-?\s*[0-9]+)/i);
  if (!m) return null;
  return m[1].replace(/\s+/g, "");
}

/** Parse one reconstructed line into a trade, or null if it isn't a data row. */
function parseRow(line: string, side: "buy" | "sell"): ParsedTrade | null {
  const m = ROW_RE.exec(line.trim());
  if (!m) return null;
  const symbol = m[1].trim().toUpperCase();
  const quantity = toNumber(m[2]);
  const pricePerShare = toNumber(m[3]);
  const feesBdt = toNumber(m[5]);
  if (!symbol || !Number.isFinite(quantity) || quantity <= 0) return null;
  if (!Number.isFinite(pricePerShare) || pricePerShare < 0) return null;
  return {
    symbol,
    side,
    quantity,
    pricePerShare,
    feesBdt: Number.isFinite(feesBdt) && feesBdt >= 0 ? feesBdt : 0,
  };
}

export function parseTradeConfirmation(rawText: string): ParsedConfirmation {
  const text = rawText ?? "";
  const lines = text.split(/\r?\n/);
  const warnings: string[] = [];

  // The "TOTAL BUY" / "TOTAL SALE" summary lines bracket the two sections.
  // Buy rows precede TOTAL BUY; sell rows sit between TOTAL BUY and TOTAL SALE
  // (or before TOTAL SALE when there is no buy section). This is far more
  // reliable than the "Buy"/"Sale" header tokens.
  let buyTotalLine = -1;
  let saleTotalLine = -1;
  lines.forEach((ln, i) => {
    if (buyTotalLine < 0 && /TOTAL\s+BUY/i.test(ln)) buyTotalLine = i;
    if (saleTotalLine < 0 && /TOTAL\s+SALE/i.test(ln)) saleTotalLine = i;
  });

  const trades: ParsedTrade[] = [];
  lines.forEach((line, i) => {
    let side: "buy" | "sell" | null = null;
    if (buyTotalLine >= 0 && i < buyTotalLine) {
      side = "buy";
    } else if (saleTotalLine >= 0 && i < saleTotalLine && i > buyTotalLine) {
      side = "sell";
    }
    if (!side) return;
    const trade = parseRow(line, side);
    if (trade) trades.push(trade);
  });

  if (trades.length === 0) {
    warnings.push(
      "No buy/sell rows were recognised. This may not be a LankaBangla trade confirmation note, or the PDF text could not be read.",
    );
  }

  return {
    tradeDate: parseTradeDate(text),
    confirmationNo: parseConfirmationNo(text),
    trades,
    warnings,
  };
}
