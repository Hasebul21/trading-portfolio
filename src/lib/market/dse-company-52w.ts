/**
 * 52-week range and sector from the DSE company page.
 * Unofficial HTML parse; layout may change.
 */

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

export type DseCompanyExtras = {
  week52Low: number | null;
  week52High: number | null;
  sector: string | null;
};

export async function fetchDseCompanyExtras(
  symbol: string,
): Promise<DseCompanyExtras> {
  const sym = symbol.trim();
  if (!sym) {
    return { week52Low: null, week52High: null, sector: null };
  }

  const base =
    process.env.DSE_COMPANY_URL_BASE?.trim() || DEFAULT_COMPANY_BASE;
  const url = `${base}?name=${encodeURIComponent(sym)}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "text/html,*/*" },
      cache: "force-cache",
      next: { revalidate: SECTOR_REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      return { week52Low: null, week52High: null, sector: null };
    }
    const html = await res.text();
    const w52 = parseDseCompany52WeekRange(html);
    const sector = parseDseCompanySector(html);
    return {
      week52Low: w52?.low ?? null,
      week52High: w52?.high ?? null,
      sector,
    };
  } catch {
    return { week52Low: null, week52High: null, sector: null };
  }
}

export async function fetchDseCompanyExtrasMap(
  symbols: string[],
): Promise<Map<string, DseCompanyExtras>> {
  const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
  const entries = await Promise.all(
    uniqueSymbols.map(async (symbol) => [symbol, await fetchDseCompanyExtras(symbol)] as const),
  );
  return new Map(entries);
}
