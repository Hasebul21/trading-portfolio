/**
 * 52-week range, sector, and fundamental data from the DSE company page.
 * Unofficial HTML parse; layout may change.
 */
import { cacheLife, cacheTag } from "next/cache";

const DEFAULT_COMPANY_BASE = "https://dsebd.org/displayCompany.php";

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
  dividendYieldPct: number | null;
  /** Months since last AGM; null if unknown */
  lastAgmMonthsAgo: number | null;
};

/**
 * Parse DSE's Financial Performance table.
 *
 * The table uses column headers in the first row (Year, EPS, NAV, DivYield, P/E…)
 * and data rows below for each year.  EPS cells contain "Basic: X.XX | Diluted: Y.YY".
 * We read the first data row (most recent year) for each column we need.
 */
function parseFinancialPerformanceTable(html: string): {
  eps: number | null;
  nav: number | null;
  dividendYieldPct: number | null;
  pe: number | null;
} {
  const EMPTY = { eps: null, nav: null, dividendYieldPct: null, pe: null };

  // Find the table that holds EPS/NAV columns
  const tblMatch = html.match(/<table[\s\S]*?Earnings per share[\s\S]*?<\/table>/i);
  if (!tblMatch) return EMPTY;
  const tbl = tblMatch[0];

  // Collect all <tr> inner contents
  const rows: string[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(tbl)) !== null) rows.push(rm[1]);
  if (rows.length < 2) return EMPTY;

  // Strip HTML from a cell's inner content
  function cellText(inner: string): string {
    return inner
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Extract all th/td cells from a row
  function parseCells(row: string): string[] {
    return [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(m => cellText(m[1]));
  }

  const headers = parseCells(rows[0]).map(h => h.toLowerCase());

  // Column index helpers
  const epsContIdx = headers.findIndex(h => h.includes("continuing"));
  const epsIdx     = headers.findIndex(h => h.includes("earnings per share") || (h.includes("eps") && !h.includes("continuing")));
  const navIdx     = headers.findIndex(h => h.includes("nav") && (h.includes("per share") || h.includes("/share") || h.includes("per")));
  const divYldIdx  = headers.findIndex(h => h.includes("dividend yield"));
  const peIdx      = headers.findIndex(h => h.includes("p/e") || h.includes("price earning"));

  // First data row (most recent year — skip pure-header rows)
  let cells: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const c = parseCells(rows[i]).filter(x => x.length > 0);
    if (c.length > 2) { cells = c; break; }
  }

  function extractNum(idx: number): number | null {
    if (idx < 0 || idx >= cells.length) return null;
    const raw = cells[idx];
    if (!raw || /^[-—–n\/a*\s]+$/i.test(raw)) return null;
    // "Basic: 6.95 | Diluted: —" format — extract after "Basic:"
    const basicMatch = raw.match(/Basic\s*:\s*([\d,.]+)/i);
    if (basicMatch) {
      const n = Number(basicMatch[1].replace(/,/g, ""));
      if (Number.isFinite(n)) return n;
    }
    // Plain number
    const n = Number(raw.replace(/,/g, "").replace(/%/g, "").split(/\s/)[0].trim());
    return Number.isFinite(n) ? n : null;
  }

  return {
    eps:             extractNum(epsContIdx >= 0 ? epsContIdx : epsIdx),
    nav:             extractNum(navIdx),
    dividendYieldPct: extractNum(divYldIdx),
    pe:              extractNum(peIdx),
  };
}

function parseDseCompanyFundamentals(html: string): Omit<DseCompanyExtras, "week52Low" | "week52High" | "sector"> {
  // Market Category: key-value row, not in the financial table
  const category = parseTextField(html, "Market Category", "Category");

  // P/E: try company info section first, fall back to financial table
  const peInfo = parseNumericField(html, "Current P\\/E Ratio using Basic EPS", "P\\/E Ratio");

  // EPS, NAV, DividendYield, P/E (year-end) from the Financial Performance table
  const fin = parseFinancialPerformanceTable(html);

  const pe             = peInfo ?? fin.pe;
  const eps            = fin.eps;
  const nav            = fin.nav;
  const dividendYieldPct = fin.dividendYieldPct;

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
    dividendYieldPct, marketCapCr, listedYears, lastAgmMonthsAgo,
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
    betaFloat: null, freeFloat: null, dividendYieldPct: null, lastAgmMonthsAgo: null,
  };
  if (!sym) return nullResult;

  const base = process.env.DSE_COMPANY_URL_BASE?.trim() || DEFAULT_COMPANY_BASE;
  const url = `${base}?name=${encodeURIComponent(sym)}`;

  try {
    const res = await fetch(url, { headers: { Accept: "text/html,*/*" } });
    if (!res.ok) return nullResult;
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
    return nullResult;
  }
}

export async function fetchDseCompanyExtrasMap(
  symbols: string[],
): Promise<Map<string, DseCompanyExtras>> {
  const uniqueSymbols = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const entries = await Promise.all(
    uniqueSymbols.map(async (sym) => [sym, await fetchDseCompanyExtras(sym)] as const),
  );
  return new Map(entries);
}
