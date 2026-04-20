import { computeFloorPivot } from "@/lib/pivot-floor";
import type { DseLspQuote } from "@/lib/market/dse-lsp-quotes";

/** First Buy Zone = floor pivot S1; sell reference = mean of R1 and R2 (same inputs as portfolio table). */
export type DseSessionZones = {
  firstBuyZone: number;
  /** Average of first and second resistance (R1 + R2) / 2. */
  sellZoneBlend: number;
};

export function zoneLevelsFromLspQuote(q: DseLspQuote): DseSessionZones | null {
  const p = computeFloorPivot(q.dayHigh, q.dayLow, q.closep);
  if (!p) return null;
  const sellZoneBlend = Math.round(((p.r1 + p.r2) / 2) * 100) / 100;
  return { firstBuyZone: p.s1, sellZoneBlend };
}
