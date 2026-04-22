/**
 * DSE trading codes from the exchange data file (official source).
 * @see https://dsebd.org/datafile/quotes.txt
 */

export type DseInstrument = {
  /** DSE trading / scrip code (e.g. GP, BRACBANK, AMCL(PRAN)). */
  symbol: string;
};

/** Primary + www mirror; `dsebd.com.bd` is last — it often fails DNS outside BD. */
const DEFAULT_QUOTES_URLS = [
  "https://dsebd.org/datafile/quotes.txt",
  "https://www.dsebd.org/datafile/quotes.txt",
  "https://dsebd.com.bd/datafile/quotes.txt",
] as const;

const FETCH_TIMEOUT_MS = 22_000;
const MIN_INSTRUMENTS = 30;

/** Line after the "Instr. Code" header: trading code, whitespace, last price. */
const ROW_RE = /^(\S+)\s+([\d.]+)\s*$/;

function quotesTxtUrlList(): readonly string[] {
  const custom = process.env.DSE_QUOTES_TXT_URL?.trim();
  if (custom) return [custom];
  return DEFAULT_QUOTES_URLS;
}

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
  const urls = quotesTxtUrlList();
  let lastErr = "No response";

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "text/plain,*/*",
          // Some DSE endpoints reject the default undici User-Agent.
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: "no-store",
      });
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      const text = await res.text();
      const instruments = parseQuotesTxt(text);
      if (instruments.length < MIN_INSTRUMENTS) {
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

export async function getCachedDseInstruments(): Promise<{
  instruments: DseInstrument[];
  error: string | null;
}> {
  const { instruments, error } = await fetchQuotesFromUrls();
  return { instruments, error };
}
