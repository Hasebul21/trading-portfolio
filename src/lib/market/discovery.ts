import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { fetchDseCompanyExtrasMap } from "@/lib/market/dse-company-52w";
import {
  computeOracleScore,
  selectDiscoveryPicks,
  type OraclePickResult,
} from "@/lib/market/oracle-scoring";
import type { DseLspQuote } from "@/lib/market/dse-lsp-quotes";

const DISCOVERY_FETCH_CONCURRENCY = 10;
const DISCOVERY_UNIVERSE_CAP = 600; // safety bound

/**
 * Scans the wider DSE universe (minus the user's known symbols) and returns
 * the top-scoring picks that the user might have missed. Fundamentals are
 * fetched with capped concurrency to avoid hammering dsebd.org; subsequent
 * calls are served from the per-symbol 24h `"use cache"` layer.
 */
export async function computeDiscoveryPicks(args: {
  bySymbol: Map<string, DseLspQuote>;
  excludeSymbols: Iterable<string>;
}): Promise<{ picks: OraclePickResult[]; scanned: number; error: string | null }> {
  const { bySymbol, excludeSymbols } = args;
  if (bySymbol.size === 0) return { picks: [], scanned: 0, error: "No DSE price data" };

  const { instruments, error } = await getCachedDseInstruments();
  if (instruments.length === 0) return { picks: [], scanned: 0, error };

  const exclude = new Set(
    [...excludeSymbols].map((s) => s.trim().toUpperCase()).filter(Boolean),
  );

  // Only consider symbols that actually trade today (we have a live LTP for
  // them) — skips illiquid / suspended names entirely.
  const universe = instruments
    .map((i) => i.symbol.trim().toUpperCase())
    .filter((sym) => sym && !exclude.has(sym) && bySymbol.has(sym))
    .slice(0, DISCOVERY_UNIVERSE_CAP);

  if (universe.length === 0) return { picks: [], scanned: 0, error: null };

  const extrasMap = await fetchDseCompanyExtrasMap(universe, {
    concurrency: DISCOVERY_FETCH_CONCURRENCY,
  });

  const scored: Parameters<typeof selectDiscoveryPicks>[0] = [];
  for (const sym of universe) {
    const extras = extrasMap.get(sym);
    const quote = bySymbol.get(sym);
    if (!extras || !quote) continue;
    const result = computeOracleScore(sym, extras, quote);
    if (result.type !== "pick") continue;
    scored.push({
      symbol: sym,
      score: result.result.score,
      sector: result.result.sector,
      result: result.result,
    });
  }

  const picks = selectDiscoveryPicks(scored);
  return { picks, scanned: universe.length, error: null };
}
