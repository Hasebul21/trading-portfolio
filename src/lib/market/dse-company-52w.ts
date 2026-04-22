/**
 * 52-week range from DSE company page.
 * Unofficial HTML parse; layout may change.
 */

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

export type DseCompanyExtras = {
  week52Low: number | null;
  week52High: number | null;
};

export async function fetchDseCompanyExtras(
  symbol: string,
): Promise<DseCompanyExtras> {
  const sym = symbol.trim();
  if (!sym) {
    return { week52Low: null, week52High: null };
  }

  const base =
    process.env.DSE_COMPANY_URL_BASE?.trim() || DEFAULT_COMPANY_BASE;
  const url = `${base}?name=${encodeURIComponent(sym)}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "text/html,*/*" },
      cache: "no-store",
    });
    if (!res.ok) {
      return { week52Low: null, week52High: null };
    }
    const html = await res.text();
    const w52 = parseDseCompany52WeekRange(html);
    return {
      week52Low: w52?.low ?? null,
      week52High: w52?.high ?? null,
    };
  } catch {
    return { week52Low: null, week52High: null };
  }
}
