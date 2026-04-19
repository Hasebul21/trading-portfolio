/**
 * Today's LTP / high / low from DSE latest share price page (all listed equities).
 * Unofficial HTML parse; layout may change.
 */

const DEFAULT_LSP_URLS = [
  "https://dsebd.org/latest_share_price_scroll_l.php",
  "https://dsebd.com.bd/latest_share_price_scroll_l.php",
] as const;

export type DseLspQuote = {
  ltp: number;
  dayHigh: number;
  dayLow: number;
  /** Closing / reference price column (CLOSEP); used with H/L for floor pivot. */
  closep: number;
};

function parseBdtCell(raw: string): number | null {
  const n = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

/** Rows use `class='ab1'` on the main price table (avoids duplicate marquee links). */
function parseLspHtml(html: string): Map<string, DseLspQuote> {
  const bySymbol = new Map<string, DseLspQuote>();
  const re =
    /href="displayCompany\.php\?name=([^"&]+)" class='ab1'[^>]*>[\s\S]*?<\/a>\s*<\/td>\s*<td[^>]*>\s*([^<]+?)<\/td>\s*<td[^>]*>\s*([^<]+?)<\/td>\s*<td[^>]*>\s*([^<]+?)<\/td>\s*<td[^>]*>\s*([^<]+?)<\/td>/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const sym = decodeURIComponent(m[1]).trim().toUpperCase();
    const ltp = parseBdtCell(m[2]);
    const dayHigh = parseBdtCell(m[3]);
    const dayLow = parseBdtCell(m[4]);
    const closep = parseBdtCell(m[5]);
    if (!sym || ltp === null || dayHigh === null || dayLow === null) continue;
    const closeForPivot = closep ?? ltp;
    bySymbol.set(sym, {
      ltp,
      dayHigh,
      dayLow,
      closep: closeForPivot,
    });
  }

  return bySymbol;
}

export async function fetchDseLspQuoteMap(): Promise<{
  bySymbol: Map<string, DseLspQuote>;
  error: string | null;
}> {
  const urls = process.env.DSE_LSP_URL?.trim()
    ? [process.env.DSE_LSP_URL.trim()]
    : [...DEFAULT_LSP_URLS];

  let lastErr = "No response";

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "text/html,*/*" },
        next: { revalidate: 60 },
      });
      if (!res.ok) {
        lastErr = `DSE LSP HTTP ${res.status}`;
        continue;
      }
      const html = await res.text();
      const bySymbol = parseLspHtml(html);
      if (bySymbol.size === 0) {
        lastErr = "No price rows parsed from DSE LSP";
        continue;
      }
      return { bySymbol, error: null };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "Unknown error";
    }
  }

  return { bySymbol: new Map(), error: lastErr };
}

/** Same as {@link fetchDseLspQuoteMap} but bypasses cache for live polling (API / client refresh). */
export async function fetchDseLspQuoteMapFresh(): Promise<{
  bySymbol: Map<string, DseLspQuote>;
  error: string | null;
}> {
  const urls = process.env.DSE_LSP_URL?.trim()
    ? [process.env.DSE_LSP_URL.trim()]
    : [...DEFAULT_LSP_URLS];

  let lastErr = "No response";

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "text/html,*/*" },
        cache: "no-store",
      });
      if (!res.ok) {
        lastErr = `DSE LSP HTTP ${res.status}`;
        continue;
      }
      const html = await res.text();
      const bySymbol = parseLspHtml(html);
      if (bySymbol.size === 0) {
        lastErr = "No price rows parsed from DSE LSP";
        continue;
      }
      return { bySymbol, error: null };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "Unknown error";
    }
  }

  return { bySymbol: new Map(), error: lastErr };
}
