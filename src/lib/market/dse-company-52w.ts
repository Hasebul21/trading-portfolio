/**
 * 52-week range, sector, and fundamental data from the DSE company page.
 * Unofficial HTML parse; layout may change.
 */
import { cacheLife, cacheTag } from "next/cache";

/** Apex host first, www mirror tried when the apex fails to connect. */
const COMPANY_BASE_MIRRORS = [
  "https://dsebd.org/displayCompany.php",
  "https://www.dsebd.org/displayCompany.php",
] as const;

const FETCH_TIMEOUT_MS = 22_000;

/** DSE rejects the default undici User-Agent on some endpoints; mimic a browser. */
const COMPANY_FETCH_HEADERS = {
  Accept: "text/html,*/*",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
} as const;

function parseRangeCell(raw: string): { low: number; high: number } | null {
  const t = raw.replace(/,/g, "").trim();
  if (!t || /^(n\/a|--|—)$/i.test(t)) return null;
  const parts = t.split(/\s*-\s*/);
  if (parts.length !== 2) return null;
  const low = Number(parts[0].trim());
  const high = Number(parts[1].trim());
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  return { low, high };
}

function parseTextCell(raw: string): string | null {
  const text = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || /^(n\/a|--|—)$/i.test(text)) return null;
  return text;
}

/**
 * Find the first numeric <td> value immediately after a <th> or <td> whose
 * text contains the label. Uses [\s\S]*? so labels with <br> tags still match.
 */
function parseNumericField(html: string, ...labelPatterns: string[]): number | null {
  for (const label of labelPatterns) {
    const re = new RegExp(
      `${label}[\\s\\S]*?<\\/(?:th|td)>\\s*<td[^>]*>\\s*([^<]+?)\\s*<\\/td>`,
      "i",
    );
    const m = html.match(re);
    if (!m) continue;
    const raw = m[1].replace(/,/g, "").replace(/%/g, "").trim();
    if (!raw || /^(n\/a|--|—|\*+)$/i.test(raw)) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseTextField(html: string, ...labelPatterns: string[]): string | null {
  for (const label of labelPatterns) {
    const re = new RegExp(
      `${label}[\\s\\S]*?<\\/(?:th|td)>\\s*<td[^>]*>\\s*([\\s\\S]*?)<\\/td>`,
      "i",
    );
    const m = html.match(re);
    if (!m) continue;
    const val = parseTextCell(m[1]);
    if (val) return val;
  }
  return null;
}

export function parseDseCompany52WeekRange(html: string): {
  low: number;
  high: number;
} | null {
  const m = html.match(
    /52\s*Weeks'[^<]*Moving\s*Range<\/th>\s*<td[^>]*>\s*([^<]+?)<\/td>/i,
  );
  if (!m) return null;
  return parseRangeCell(m[1]);
}

export function parseDseCompanySector(html: string): string | null {
  const m = html.match(/Sector<\/(?:th|td)>\s*<td[^>]*>\s*([\s\S]*?)<\/td>/i);
  if (!m) return null;
  return parseTextCell(m[1]);
}

/** Number of years since a date string like "01 Jan 2005" or "2005-01-01". */
function yearsAgo(dateStr: string): number | null {
  const cleaned = dateStr.replace(/\s+/g, " ").trim();
  // Try ISO format
  let d = new Date(cleaned);
  if (!Number.isFinite(d.getTime())) {
    // Try "DD Mon YYYY"
    const parts = cleaned.split(/[\s/,-]+/);
    if (parts.length === 3) {
      d = new Date(`${parts[1]} ${parts[0]}, ${parts[2]}`);
    }
  }
  if (!Number.isFinite(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  return diffMs / (1000 * 60 * 60 * 24 * 365.25);
}

/** Months since a date string. */
function monthsAgo(dateStr: string): number | null {
  const years = yearsAgo(dateStr);
  return years !== null ? years * 12 : null;
}

export type DseCompanyExtras = {
  week52Low: number | null;
  week52High: number | null;
  sector: string | null;
  /** Category from DSE: A, B, N, Z, etc. */
  category: string | null;
  pe: number | null;
  eps: number | null;
  nav: number | null;
  /** Market cap in crore BDT */
  marketCapCr: number | null;
  listedYears: number | null;
  betaFloat: number | null;
  freeFloat: number | null;
  /** Latest year's dividend yield % from the year-end P/E table. */
  dividendYieldPct: number | null;
  /**
   * Simple arithmetic mean of dividend yield % across the most recent up-to-5
   * year rows in the DSE year-end table. Smooths one-off skip years for the
   * portfolio's Unrealized Dividend KPI. Null when no usable data is found.
   */
  dividendYieldAvg5YPct: number | null;
  /** Months since last AGM; null if unknown */
  lastAgmMonthsAgo: number | null;
};

/**
 * Parse DSE's Financial Performance / Year-End tables on the company page.
 *
 * The page contains *several* tables that mention "EPS":
 *   • Interim/quarterly results (Q1/Q2/Half/Q3/9M/Annual) — first match, NOT what we want.
 *   • Annual EPS/NAV table — has "NAV Per Share" header. Per-row layout:
 *       [year, EPS-Basic-Orig, EPS-Basic-Restated, EPS-Diluted-Orig, …, NAV-Orig, NAV-Restated, …]
 *     Most cells are "-" with the actual value sitting in the "continuing operations
 *     original" slot. Strategy: collect all non-dash numerics in the latest year row
 *     and take [0] = EPS, [1] = NAV (profit/OCI cells trail after).
 *   • Year-end P/E + Dividend Yield table — has "Dividend Yield in %" header. Per-row:
 *       [year, PE-Basic-Orig, PE-Basic-Restated, …, Dividend %, Dividend Yield %]
 *     Numerics in latest year row: [PE, Div%, DivYield%]. Take [0] = PE, last = DivYield.
 */

// Extract text from a single <td> / <th> inner HTML.
function cellText(inner: string): string {
  return inner
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function rowCells(row: string): string[] {
  return [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) => cellText(m[1]));
}

/** Pull all `<table>` HTML blobs from the document (non-greedy, no nesting). */
function allTables(html: string): string[] {
  return [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)].map((m) => m[0]);
}

/** Pull all `<tr>` blobs from a table HTML blob. */
function allRows(tbl: string): string[] {
  return [...tbl.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
}

/**
 * Return numeric values from year rows of a table, newest first.
 * A "year row" is any row whose first non-empty cell parses to a 4-digit year
 * in 2000–2099. Skips cells that are dashes / asterisks / blanks. Caller
 * decides whether to take just the first entry or average over several.
 */
function yearRowsNumerics(tbl: string): Array<{ year: number; numerics: number[] }> {
  const rows = allRows(tbl);
  const out: Array<{ year: number; numerics: number[] }> = [];
  for (const r of rows) {
    const cells = rowCells(r).filter((c) => c.length > 0);
    if (cells.length < 2) continue;
    let yearIdx = -1;
    let year = -1;
    for (let i = 0; i < Math.min(4, cells.length); i++) {
      const n = Number(cells[i]);
      if (Number.isInteger(n) && n >= 2000 && n <= 2099) {
        yearIdx = i;
        year = n;
        break;
      }
    }
    if (yearIdx < 0) continue;
    const numerics: number[] = [];
    for (let i = yearIdx + 1; i < cells.length; i++) {
      const raw = cells[i];
      if (!raw || /^[-—–*\s]+$/.test(raw)) continue;
      const n = Number(raw.replace(/,/g, "").replace(/%/g, "").trim());
      if (Number.isFinite(n)) numerics.push(n);
    }
    if (numerics.length === 0) continue;
    out.push({ year, numerics });
  }
  out.sort((a, b) => b.year - a.year);
  return out;
}

function latestYearRowNumerics(tbl: string): { year: number; numerics: number[] } | null {
  const rows = yearRowsNumerics(tbl);
  return rows[0] ?? null;
}

function parseFinancialPerformanceTable(html: string): {
  eps: number | null;
  nav: number | null;
  dividendYieldPct: number | null;
  dividendYieldAvg5YPct: number | null;
  pe: number | null;
} {
  const EMPTY = {
    eps: null,
    nav: null,
    dividendYieldPct: null,
    dividendYieldAvg5YPct: null,
    pe: null,
  };

  const tables = allTables(html);
  // Annual EPS/NAV table — uniquely identified by "NAV Per Share" header.
  const navTable = tables.find((t) => /NAV Per Share/i.test(t)) ?? null;
  // Year-end P/E + Dividend Yield table — uniquely identified by "Dividend Yield in %".
  const yieldTable = tables.find((t) => /Dividend Yield in %/i.test(t)) ?? null;

  const navData = navTable ? latestYearRowNumerics(navTable) : null;
  const yieldRows = yieldTable ? yearRowsNumerics(yieldTable) : [];
  const yldData = yieldRows[0] ?? null;

  // Latest-year EPS & NAV: first two non-dash numerics in the data row.
  const eps = navData?.numerics[0] ?? null;
  const nav = navData?.numerics[1] ?? null;

  // Latest-year P/E & Dividend Yield: PE = first numeric, DivYield% = last numeric.
  const pe = yldData?.numerics[0] ?? null;
  const dividendYieldPct =
    yldData && yldData.numerics.length > 0
      ? yldData.numerics[yldData.numerics.length - 1] ?? null
      : null;

  // 5-year average dividend yield: take the last numeric (= div yield %) from
  // each of the most recent 5 year rows. A row where the dividend-yield cell is
  // a dash gets dropped entirely (its `numerics[]` would only hold the P/E),
  // so we guard with a `numerics.length >= 2` check to avoid counting a
  // PE-only row as a 0% yield.
  let dividendYieldAvg5YPct: number | null = null;
  const sampleYears = yieldRows.slice(0, 5);
  const yields: number[] = [];
  for (const row of sampleYears) {
    if (row.numerics.length >= 2) {
      const y = row.numerics[row.numerics.length - 1];
      if (Number.isFinite(y)) yields.push(y);
    }
  }
  if (yields.length > 0) {
    const sum = yields.reduce((a, b) => a + b, 0);
    dividendYieldAvg5YPct = Math.round((sum / yields.length) * 100) / 100;
  }

  if (
    eps === null &&
    nav === null &&
    pe === null &&
    dividendYieldPct === null &&
    dividendYieldAvg5YPct === null
  ) {
    return EMPTY;
  }
  return { eps, nav, dividendYieldPct, dividendYieldAvg5YPct, pe };
}

function parseDseCompanyFundamentals(html: string): Omit<DseCompanyExtras, "week52Low" | "week52High" | "sector"> {
  // Market Category: key-value row, not in the financial table
  const category = parseTextField(html, "Market Category", "Category");

  // P/E: try company info section first, fall back to financial table
  const peInfo = parseNumericField(html, "Current P\\/E Ratio using Basic EPS", "P\\/E Ratio");

  // EPS, NAV, DividendYield, P/E (year-end) from the Financial Performance table
  const fin = parseFinancialPerformanceTable(html);

  const pe = peInfo ?? fin.pe;
  const eps = fin.eps;
  const nav = fin.nav;
  const dividendYieldPct = fin.dividendYieldPct;
  const dividendYieldAvg5YPct = fin.dividendYieldAvg5YPct;

  // Market Capitalization (mn) — convert mn BDT → crore BDT (1 crore = 10 mn)
  const mcapMn = parseNumericField(
    html,
    "Market Capitalization \\(mn\\)",
    "Market Capitalization",
  );
  const marketCapCr = mcapMn !== null ? mcapMn / 10 : null;

  // Free Float as % = Free Float Market Cap (mn) / Market Cap (mn) × 100
  const freeFloatMcapMn = parseNumericField(
    html,
    "Free Float Market Cap\\. \\(mn\\)",
    "Free Float Market Cap",
  );
  const freeFloat =
    freeFloatMcapMn !== null && mcapMn !== null && mcapMn > 0
      ? (freeFloatMcapMn / mcapMn) * 100
      : null;

  // Listing Year — DSE shows just the year (e.g. "1995")
  const listingYearStr = parseTextField(html, "Listing Year", "Listed Since", "Date of Listing");
  let listedYears: number | null = null;
  if (listingYearStr) {
    const yr = Number(listingYearStr.replace(/\D/g, ""));
    if (yr > 1970 && yr <= new Date().getFullYear()) {
      listedYears = new Date().getFullYear() - yr;
    } else {
      listedYears = yearsAgo(listingYearStr);
    }
  }

  // Last AGM: "Last AGM held on: <i>DD-MM-YYYY</i>"
  let lastAgmMonthsAgo: number | null = null;
  const agmMatch = html.match(/Last\s+AGM\s+held\s+on\s*:\s*<[^>]+>\s*([^<]+?)\s*<\/[^>]+>/i);
  if (agmMatch) {
    const raw = agmMatch[1].trim();
    // DSE date format: DD-MM-YYYY
    const parts = raw.split(/[-\/]/);
    if (parts.length === 3) {
      const [d, mo, yr] = parts;
      const dt = new Date(`${yr}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`);
      if (Number.isFinite(dt.getTime())) {
        lastAgmMonthsAgo = (Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      }
    }
    if (lastAgmMonthsAgo === null) {
      // Fallback: generic date parse
      lastAgmMonthsAgo = monthsAgo(raw);
    }
  }

  // Beta not published by DSE; always null
  return {
    pe, eps, nav, category, freeFloat, betaFloat: null,
    dividendYieldPct, dividendYieldAvg5YPct,
    marketCapCr, listedYears, lastAgmMonthsAgo,
  };
}

export async function fetchDseCompanyExtras(
  symbol: string,
): Promise<DseCompanyExtras> {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 86400, expire: 90000 });
  cacheTag(`dse-company-${symbol.trim().toLowerCase()}`);

  const sym = symbol.trim();
  const nullResult: DseCompanyExtras = {
    week52Low: null, week52High: null, sector: null, category: null,
    pe: null, eps: null, nav: null, marketCapCr: null, listedYears: null,
    betaFloat: null, freeFloat: null,
    dividendYieldPct: null, dividendYieldAvg5YPct: null,
    lastAgmMonthsAgo: null,
  };
  if (!sym) return nullResult;

  const customBase = process.env.DSE_COMPANY_URL_BASE?.trim();
  const bases = customBase ? [customBase] : [...COMPANY_BASE_MIRRORS];

  for (const base of bases) {
    const url = `${base}?name=${encodeURIComponent(sym)}`;
    try {
      const res = await fetch(url, {
        headers: COMPANY_FETCH_HEADERS,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const w52 = parseDseCompany52WeekRange(html);
      const sector = parseDseCompanySector(html);
      const fundamentals = parseDseCompanyFundamentals(html);
      return {
        week52Low: w52?.low ?? null,
        week52High: w52?.high ?? null,
        sector,
        ...fundamentals,
      };
    } catch {
      // Connection failed on this mirror — try the next one.
    }
  }
  return nullResult;
}

export async function fetchDseCompanyExtrasMap(
  symbols: string[],
  options: { concurrency?: number } = {},
): Promise<Map<string, DseCompanyExtras>> {
  const uniqueSymbols = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (uniqueSymbols.length === 0) return new Map();

  const out = new Map<string, DseCompanyExtras>();
  // Default: no concurrency cap (preserves existing callers' behaviour). When
  // scanning the full DSE universe pass e.g. `{ concurrency: 10 }` to avoid
  // hammering the source with 400+ parallel HTTP requests.
  const limit = Math.max(
    1,
    Math.min(options.concurrency ?? uniqueSymbols.length, uniqueSymbols.length),
  );

  let idx = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (true) {
        const my = idx++;
        if (my >= uniqueSymbols.length) return;
        const sym = uniqueSymbols[my]!;
        const extras = await fetchDseCompanyExtras(sym);
        out.set(sym, extras);
      }
    }),
  );
  return out;
}
