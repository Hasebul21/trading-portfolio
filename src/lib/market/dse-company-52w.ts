/**
 * 52-week range, sector, and fundamental data from the DSE company page.
 * Unofficial HTML parse; layout may change.
 */
import { cache } from "react";

const DEFAULT_COMPANY_BASE = "https://dsebd.org/displayCompany.php";
const SECTOR_REVALIDATE_SECONDS = 60 * 60 * 24;

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

function parseNumericField(html: string, ...labelPatterns: string[]): number | null {
  for (const label of labelPatterns) {
    const re = new RegExp(
      label + `[^<]*<\\/(?:th|td)>\\s*<td[^>]*>\\s*([^<]+?)<\\/td>`,
      "i",
    );
    const m = html.match(re);
    if (!m) continue;
    const raw = m[1].replace(/,/g, "").replace(/%/g, "").trim();
    if (!raw || /^(n\/a|--|—)$/i.test(raw)) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseTextField(html: string, ...labelPatterns: string[]): string | null {
  for (const label of labelPatterns) {
    const re = new RegExp(
      label + `[^<]*<\\/(?:th|td)>\\s*<td[^>]*>\\s*([\\s\\S]*?)<\\/td>`,
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
  const pe = parseNumericField(html, "P\\/E Ratio", "P\\/E", "PE Ratio");
  const eps = parseNumericField(html, "EPS", "Earnings Per Share");
  const nav = parseNumericField(html, "NAV Per Share", "NAV\\/Share", "NAV");
  const category = parseTextField(html, "Category");
  const freeFloat = parseNumericField(html, "Free Float", "Float");
  const betaFloat = parseNumericField(html, "Beta");
  const dividendYieldPct = parseNumericField(html, "Dividend Yield", "Div\\. Yield", "Yield");

  // Market cap: listed as crore or full BDT; normalise to crore
  const rawMcap = parseNumericField(html, "Market Capitalization", "Market Cap");
  const marketCapCr = rawMcap !== null
    ? rawMcap > 1e7 ? rawMcap / 1e7 : rawMcap  // if looks like full BDT, convert to crore
    : null;

  // Listed date
  const listedDateStr = parseTextField(html, "Listed Since", "Listing Date", "Date of Listing");
  const listedYears = listedDateStr ? yearsAgo(listedDateStr) : null;

  // Last AGM
  const agmDateStr = parseTextField(html, "Last AGM", "AGM Date");
  const lastAgmMonthsAgo = agmDateStr ? monthsAgo(agmDateStr) : null;

  return { pe, eps, nav, category, freeFloat, betaFloat, dividendYieldPct, marketCapCr, listedYears, lastAgmMonthsAgo };
}

export const fetchDseCompanyExtras = cache(async (
  symbol: string,
): Promise<DseCompanyExtras> => {
  const sym = symbol.trim();
  const nullResult: DseCompanyExtras = {
    week52Low: null, week52High: null, sector: null, category: null,
    pe: null, eps: null, nav: null, marketCapCr: null, listedYears: null,
    betaFloat: null, freeFloat: null, dividendYieldPct: null, lastAgmMonthsAgo: null,
  };
  if (!sym) return nullResult;

  const base =
    process.env.DSE_COMPANY_URL_BASE?.trim() || DEFAULT_COMPANY_BASE;
  const url = `${base}?name=${encodeURIComponent(sym)}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "text/html,*/*" },
      next: { revalidate: SECTOR_REVALIDATE_SECONDS },
    });
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
});

export const fetchDseCompanyExtrasMap = cache(async (
  symbols: string[],
): Promise<Map<string, DseCompanyExtras>> => {
  const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
  const entries = await Promise.all(
    uniqueSymbols.map(async (symbol) => [symbol, await fetchDseCompanyExtras(symbol)] as const),
  );
  return new Map(entries);
});
