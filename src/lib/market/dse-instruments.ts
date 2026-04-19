/**
 * DSE trading codes from the exchange data file (official source).
 * @see https://dsebd.org/datafile/quotes.txt
 */

import { unstable_cache } from "next/cache";

export type DseInstrument = {
  /** DSE trading / scrip code (e.g. GP, BRACBANK, AMCL(PRAN)). */
  symbol: string;
};

const QUOTES_URLS = [
  "https://dsebd.org/datafile/quotes.txt",
  "https://dsebd.com.bd/datafile/quotes.txt",
] as const;

/** Line after the "Instr. Code" header: trading code, whitespace, last price. */
const ROW_RE = /^(\S+)\s+([\d.]+)\s*$/;

function parseQuotesTxt(text: string): DseInstrument[] {
  const lines = text.split(/\r?\n/);
  let afterHeader = false;
  const seen = new Set<string>();
  const out: DseInstrument[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^Instr\.?\s*Code/i.test(trimmed)) {
      afterHeader = true;
      continue;
    }
    if (!afterHeader) continue;

    const m = trimmed.match(ROW_RE);
    if (!m) continue;

    const symbol = m[1].trim();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({ symbol });
  }

  out.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return out;
}

async function fetchQuotesFromUrls(): Promise<{ instruments: DseInstrument[]; error: string | null }> {
  let lastErr = "No response";

  for (const url of QUOTES_URLS) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "text/plain,*/*" },
        next: { revalidate: 900 },
      });
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      const text = await res.text();
      const instruments = parseQuotesTxt(text);
      if (instruments.length === 0) {
        lastErr = "No instruments parsed";
        continue;
      }
      return { instruments, error: null };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "Unknown error";
    }
  }

  return { instruments: [], error: lastErr };
}

/** Cached ~15m; safe to call from server components / server actions context. */
export const getCachedDseInstruments = unstable_cache(
  fetchQuotesFromUrls,
  ["dse-quotes-instruments-v1"],
  { revalidate: 900 },
);
