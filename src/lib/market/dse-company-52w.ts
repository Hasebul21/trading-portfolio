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

function parseDseCompanyFundamentals(html: string): Omit<DseCompanyExtras, "week52Low" | "week52High" | "sector"> {
  // P/E — label on DSE contains a <br> tag, so [\s\S]*? in parseNumericField handles it
  const pe = parseNumericField(
    html,
    "Current P\\/E Ratio using Basic EPS",
    "P\\/E Ratio",
    "P\\/E",
  );

  // EPS — from Financial Performance table; first td = most recent year
  const eps = parseNumericField(
    html,
    "Earnings per share\\(EPS\\)",
    "EPS - Continuing Operations",
    "Earnings Per Share",
    "EPS",
  );

  // NAV Per Share — from Financial Performance table
  const nav = parseNumericField(html, "NAV Per Share", "NAV\\/Share");

  // Market Category: "Market Category" label in a table row
  const category = parseTextField(html, "Market Category", "Category");

  // Dividend Yield in % — from Financial Performance table, most recent year
  const dividendYieldPct = parseNumericField(
    html,
    "Dividend Yield in %",
    "Dividend Yield",
  );

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
