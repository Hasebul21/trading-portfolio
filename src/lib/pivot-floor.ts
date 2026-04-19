/**
 * Classic floor pivot (P, R1, R2, S1, S2) from one period's high, low, close.
 * Matches common DSE / AmarStock-style tables when H/L/C are from the same snapshot.
 */

export type FloorPivot = {
  pivot: number;
  s1: number;
  s2: number;
  r1: number;
  r2: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeFloorPivot(
  high: number,
  low: number,
  close: number,
): FloorPivot | null {
  if (![high, low, close].every((x) => Number.isFinite(x))) return null;
  if (high < low) return null;

  const p = (high + low + close) / 3;
  const r1 = 2 * p - low;
  const s1 = 2 * p - high;
  const r2 = p + (high - low);
  const s2 = p - (high - low);

  return {
    pivot: round2(p),
    s1: round2(s1),
    s2: round2(s2),
    r1: round2(r1),
    r2: round2(r2),
  };
}
