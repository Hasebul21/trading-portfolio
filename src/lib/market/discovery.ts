import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { fetchDseCompanyExtrasMap } from "@/lib/market/dse-company-52w";
import {
    computeOracleScore,
    selectDiscoveryPicks,
    type OraclePickResult,
} from "@/lib/market/oracle-scoring";
import type { DseLspQuote } from "@/lib/market/dse-lsp-quotes";

const DISCOVERY_FETCH_CONCURRENCY = 16;
const DISCOVERY_UNIVERSE_CAP = 600; // safety bound

/** Per-symbol scoring outcome from a full DSE universe scan. */
export type ScoredUniverseItem = {
    symbol: string;
    score: number;
    sector: string | null;
    result: Omit<OraclePickResult, "allocationPct">;
};

/**
 * Score every tradeable DSE symbol with the Oracle engine and return the
 * full ranked list (no caps, no min-score). The caller decides how to slice
 * the result (top-N, filter by sector, partition by user membership, etc.).
 *
 * Fundamentals are fetched with capped concurrency to avoid hammering
 * dsebd.org; subsequent calls hit the per-symbol 24h `"use cache"` layer.
 */
export async function scoreDseUniverse(args: {
    bySymbol: Map<string, DseLspQuote>;
}): Promise<{ scored: ScoredUniverseItem[]; scanned: number; error: string | null }> {
    const { bySymbol } = args;
    if (bySymbol.size === 0) return { scored: [], scanned: 0, error: "No DSE price data" };

    const { instruments, error } = await getCachedDseInstruments();
    if (instruments.length === 0) return { scored: [], scanned: 0, error };

    // Only consider symbols that actually trade today (we have a live LTP).
    const universe = instruments
        .map((i) => i.symbol.trim().toUpperCase())
        .filter((sym) => sym && bySymbol.has(sym))
        .slice(0, DISCOVERY_UNIVERSE_CAP);

    if (universe.length === 0) return { scored: [], scanned: 0, error: null };

    const extrasMap = await fetchDseCompanyExtrasMap(universe, {
        concurrency: DISCOVERY_FETCH_CONCURRENCY,
    });

    const scored: ScoredUniverseItem[] = [];
    for (const sym of universe) {
        const extras = extrasMap.get(sym);
        const quote = bySymbol.get(sym);
        if (!extras || !quote) continue;
        const result = computeOracleScore(sym, extras, quote);
        if (result.type !== "pick") continue; // gated-out names are excluded from the ranking
        scored.push({
            symbol: sym,
            score: result.result.score,
            sector: result.result.sector,
            result: result.result,
        });
    }

    scored.sort((a, b) => b.score - a.score);
    return { scored, scanned: universe.length, error: null };
}

/**
 * Scans the wider DSE universe (minus the user's known symbols) and returns
 * the top-scoring picks that the user might have missed. Kept as a thin
 * wrapper around `scoreDseUniverse` for backwards compatibility.
 */
export async function computeDiscoveryPicks(args: {
    bySymbol: Map<string, DseLspQuote>;
    excludeSymbols: Iterable<string>;
}): Promise<{ picks: OraclePickResult[]; scanned: number; error: string | null }> {
    const { bySymbol, excludeSymbols } = args;
    const { scored, scanned, error } = await scoreDseUniverse({ bySymbol });
    if (scored.length === 0) return { picks: [], scanned, error };

    const exclude = new Set(
        [...excludeSymbols].map((s) => s.trim().toUpperCase()).filter(Boolean),
    );
    const filtered = scored.filter((s) => !exclude.has(s.symbol));
    const picks = selectDiscoveryPicks(filtered);
    return { picks, scanned, error };
}
