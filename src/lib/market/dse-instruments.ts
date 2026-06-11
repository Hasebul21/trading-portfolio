/**
 * DSE trading codes from the exchange data file (official source).
 * @see https://dsebd.org/datafile/quotes.txt
 */
import { cache } from "react";
import { fetchDseLspQuoteMap } from "@/lib/market/dse-lsp-quotes";
import { ensureDseTlsTrust } from "@/lib/market/dse-tls";

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
/** Trading-code list is essentially static day-to-day; cache for 6h on the data layer. */
const INSTRUMENTS_REVALIDATE_SECONDS = 60 * 60 * 6;

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
  ensureDseTlsTrust();
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
        next: { revalidate: INSTRUMENTS_REVALIDATE_SECONDS },
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

/**
 * Fallback symbol source: the DSE latest-share-price feed lists every trading
 * code and tends to stay reachable even when `quotes.txt` is down. We only need
 * the codes here, so we discard the price data.
 */
async function fetchInstrumentsFromLsp(): Promise<DseInstrument[]> {
  const { bySymbol } = await fetchDseLspQuoteMap();
  const out = [...bySymbol.keys()]
    .map((symbol) => symbol.trim())
    .filter(Boolean)
    .map((symbol) => ({ symbol }));
  out.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return out;
}

export const getCachedDseInstruments = cache(async (): Promise<{
  instruments: DseInstrument[];
  error: string | null;
}> => {
  const { instruments, error } = await fetchQuotesFromUrls();
  if (instruments.length >= MIN_INSTRUMENTS) {
    return { instruments, error: null };
  }

  // `quotes.txt` failed — derive codes from the latest-share-price feed so the
  // symbol picker stays usable instead of dropping to "type code manually".
  try {
    const fromLsp = await fetchInstrumentsFromLsp();
    if (fromLsp.length >= MIN_INSTRUMENTS) {
      return { instruments: fromLsp, error: null };
    }
  } catch {
    // Ignore and surface the original quotes.txt error below.
  }

  return { instruments, error };
});
