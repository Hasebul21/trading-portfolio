/**
 * Oracle Trade Desk — deterministic scoring engine.
 *
 * Scores DSE stocks using only data available from the DSE company page
 * (P/E, Price/NAV, dividend yield, 52w position, category, listing age, beta).
 * All components rescale to 100 pts. Threshold: 65/100.
 */

import type { DseCompanyExtras } from "./dse-company-52w";
import type { DseLspQuote } from "./dse-lsp-quotes";

// ─── Scoring weights (must sum to 100) ───────────────────────────────────────
const W_PE = 20;
const W_PNAV = 15;
const W_DIVYIELD = 15;
const W_52W = 20;
const W_DIVCONSISTENCY = 10;
const W_LISTAGE = 8;
const W_BETA = 7;
const W_CATEGORY = 5;
// W_PE + W_PNAV + W_DIVYIELD + W_52W + W_DIVCONSISTENCY + W_LISTAGE + W_BETA + W_CATEGORY = 100

export const ORACLE_THRESHOLD = 35;
export const ORACLE_WATCHLIST_MIN = 25;
const MAX_PICKS = 8;
const SECTOR_CAP = 2;

// ─── Gate reasons ─────────────────────────────────────────────────────────────
export type GateReason =
  | "Non-A category"
  | "Overvalued (P/E > 40)"
  | "Loss-making (EPS ≤ 0)"
  | "Extreme Price/NAV (> 5)"
  | "Free Float < 15%"
  | "AGM overdue (> 15 months)";

// ─── Output types ─────────────────────────────────────────────────────────────
export type ConvictionTier = "High Conviction" | "Strong Buy" | "Buy";
export type HorizonTier = "Long (1Y+)" | "Medium (3–12M)" | "Short (1–3M)";

export type OracleReasonTag =
  | "Undervalued"
  | "Dividend King"
  | "Value Pick"
  | "Sweet Spot Entry"
  | "Defensive"
  | "Dividend Aristocrat"
  | "Long Track Record"
  | "Low Debt";

export type ScoreBreakdown = {
  pe: number;
  priceNav: number;
  divYield: number;
  position52w: number;
  divConsistency: number;
  listingAge: number;
  beta: number;
  category: number;
  total: number;
};

export type OraclePickResult = {
  symbol: string;
  sector: string | null;
  score: number;
  conviction: ConvictionTier;
  currentPrice: number;
  buyZoneLow: number;
  buyZoneHigh: number;
  targetPrice: number | null;
  upsidePct: number | null;
  stopLoss: number;
  downsidePct: number;
  horizon: HorizonTier;
  allocationPct: number;
  reasonTags: OracleReasonTag[];
  breakdown: ScoreBreakdown;
  pe: number | null;
  priceNav: number | null;
  divYieldPct: number | null;
  position52wPct: number | null;
  beta: number | null;
};

export type OracleGateReject = {
  symbol: string;
  reason: GateReason;
};

export type OracleWatchlistItem = {
  symbol: string;
  sector: string | null;
  score: number;
  currentPrice: number;
  trigger: string;
};

export type OracleSentiment = "Bullish" | "Neutral" | "Cautious";

export type OracleResult = {
  generatedAt: string;
  sentiment: OracleSentiment;
  sentimentReason: string;
  picks: OraclePickResult[];
  watchlist: OracleWatchlistItem[];
  avoided: OracleGateReject[];
  disclaimer: string;
};

// ─── Gate check ───────────────────────────────────────────────────────────────
function checkGates(
  extras: DseCompanyExtras,
): GateReason | null {
  const cat = extras.category?.trim().toUpperCase() ?? null;
  if (cat && !["A", ""].includes(cat) && cat !== "N" && !cat.startsWith("A")) {
    // Reject B/Z categories; allow A, N (newly listed) tentatively
    if (cat === "B" || cat === "Z") return "Non-A category";
  }
  if (extras.pe !== null && extras.pe > 40) return "Overvalued (P/E > 40)";
  if (extras.eps !== null && extras.eps <= 0) return "Loss-making (EPS ≤ 0)";
  if (extras.nav !== null && extras.pe !== null) {
    const ltp = null; // price nav needs ltp — handled in computeOracleScore
    void ltp;
  }
  if (extras.freeFloat !== null && extras.freeFloat < 15) return "Free Float < 15%";
  if (extras.lastAgmMonthsAgo !== null && extras.lastAgmMonthsAgo > 15) return "AGM overdue (> 15 months)";
  return null;
}

// ─── Sub-scorers (each returns 0 – max, already in final-weight space) ───────

function scorePE(pe: number | null): number {
  if (pe === null) return W_PE * 0.5; // no data → neutral 50%
  if (pe <= 8) return W_PE;
  if (pe <= 12) return W_PE * 0.8;
  if (pe <= 18) return W_PE * 0.6;
  if (pe <= 25) return W_PE * 0.3;
  return 0;
}

function scorePriceNav(priceNav: number | null): number {
  if (priceNav === null) return W_PNAV * 0.5;
  if (priceNav <= 1.0) return W_PNAV;
  if (priceNav <= 1.5) return W_PNAV * 0.8;
  if (priceNav <= 2.5) return W_PNAV * 0.53;
  if (priceNav <= 4.0) return W_PNAV * 0.13;
  return 0;
}

function scoreDivYield(yieldPct: number | null): number {
  if (yieldPct === null) return 0;
  if (yieldPct >= 7) return W_DIVYIELD;
  if (yieldPct >= 5) return W_DIVYIELD * 0.71;
  if (yieldPct >= 3) return W_DIVYIELD * 0.43;
  if (yieldPct > 0) return W_DIVYIELD * 0.14;
  return 0;
}

function score52wPosition(pct: number | null): number {
  if (pct === null) return W_52W * 0.4; // no 52w data → conservative
  if (pct >= 0.30 && pct <= 0.60) return W_52W; // sweet spot
  if (pct > 0.60 && pct <= 0.75) return W_52W * 0.625;
  if (pct >= 0.15 && pct < 0.30) return W_52W * 0.5;
  if (pct > 0.75 && pct <= 0.90) return W_52W * 0.25;
  return 0;
}

function scoreDivConsistency(yieldPct: number | null): number {
  // We only have current yield, not history — use it as a proxy:
  // yield > 0 means at least 1 year dividend paid
  if (yieldPct === null) return 0;
  if (yieldPct >= 5) return W_DIVCONSISTENCY;
  if (yieldPct >= 3) return W_DIVCONSISTENCY * 0.6;
  if (yieldPct > 0) return W_DIVCONSISTENCY * 0.2;
  return 0;
}

function scoreListingAge(listedYears: number | null): number {
  if (listedYears === null) return W_LISTAGE * 0.25;
  if (listedYears >= 20) return W_LISTAGE;
  if (listedYears >= 10) return W_LISTAGE * 0.75;
  if (listedYears >= 5) return W_LISTAGE * 0.5;
  if (listedYears >= 3) return W_LISTAGE * 0.25;
  return 0;
}

function scoreBeta(beta: number | null): number {
  if (beta === null) return W_BETA * 0.5;
  if (beta >= 0.7 && beta <= 1.1) return W_BETA;
  if ((beta >= 0.5 && beta < 0.7) || (beta > 1.1 && beta <= 1.5)) return W_BETA * 0.67;
  return 0;
}

function scoreCategory(category: string | null): number {
  if (!category) return W_CATEGORY * 0.5;
  const cat = category.trim().toUpperCase();
  if (cat === "A" || cat.startsWith("A")) return W_CATEGORY;
  return W_CATEGORY * 0.25;
}

// ─── Derived output fields ────────────────────────────────────────────────────

function conviction(score: number): ConvictionTier {
  if (score >= 85) return "High Conviction";
  if (score >= 75) return "Strong Buy";
  return "Buy";
}

function horizon(score: number, beta: number | null): HorizonTier {
  const b = beta ?? 1.0;
  if (score >= 80 && b < 1.0) return "Long (1Y+)";
  if (score >= 65) return "Medium (3–12M)";
  return "Short (1–3M)";
}

function reasonTags(
  pe: number | null,
  priceNav: number | null,
  divYieldPct: number | null,
  pos52w: number | null,
  beta: number | null,
  listedYears: number | null,
): OracleReasonTag[] {
  const tags: OracleReasonTag[] = [];
  if (pe !== null && pe <= 10) tags.push("Undervalued");
  else if (pe !== null && pe <= 15) tags.push("Value Pick");
  if (divYieldPct !== null && divYieldPct >= 7) tags.push("Dividend King");
  if (divYieldPct !== null && divYieldPct >= 3) tags.push("Dividend Aristocrat");
  if (pos52w !== null && pos52w >= 0.30 && pos52w <= 0.60) tags.push("Sweet Spot Entry");
  if (beta !== null && beta < 0.8) tags.push("Defensive");
  if (listedYears !== null && listedYears >= 15) tags.push("Long Track Record");
  // dedupe and cap at 4
  return [...new Set(tags)].slice(0, 4);
}

// ─── Main score computation ───────────────────────────────────────────────────

export function computeOracleScore(
  symbol: string,
  extras: DseCompanyExtras,
  quote: DseLspQuote | null,
): { type: "pick"; result: Omit<OraclePickResult, "allocationPct"> } | { type: "gate"; reason: GateReason } | { type: "noPrice" } {
  if (!quote) return { type: "noPrice" };

  const ltp = quote.ltp;

  // Gate check (Price/NAV gate needs ltp)
  const basicGate = checkGates(extras);
  if (basicGate) return { type: "gate", reason: basicGate };

  const priceNav = (extras.nav !== null && extras.nav > 0) ? ltp / extras.nav : null;
  if (priceNav !== null && priceNav > 5) return { type: "gate", reason: "Extreme Price/NAV (> 5)" };

  const pos52w =
    extras.week52Low !== null && extras.week52High !== null && extras.week52High > extras.week52Low
      ? (ltp - extras.week52Low) / (extras.week52High - extras.week52Low)
      : null;

  const peScore = scorePE(extras.pe);
  const pnavScore = scorePriceNav(priceNav);
  const divScore = scoreDivYield(extras.dividendYieldPct);
  const posScore = score52wPosition(pos52w);
  const divConScore = scoreDivConsistency(extras.dividendYieldPct);
  const ageScore = scoreListingAge(extras.listedYears);
  const betaScore = scoreBeta(extras.betaFloat);
  const catScore = scoreCategory(extras.category);

  const total = Math.round(peScore + pnavScore + divScore + posScore + divConScore + ageScore + betaScore + catScore);

  const breakdown: ScoreBreakdown = {
    pe: Math.round(peScore),
    priceNav: Math.round(pnavScore),
    divYield: Math.round(divScore),
    position52w: Math.round(posScore),
    divConsistency: Math.round(divConScore),
    listingAge: Math.round(ageScore),
    beta: Math.round(betaScore),
    category: Math.round(catScore),
    total,
  };

  // Derived fields
  const buyZoneLow = Math.round(ltp * 0.97 * 10) / 10;
  const buyZoneHigh = Math.round(ltp * 1.02 * 10) / 10;
  const stopLoss = Math.round(Math.max(ltp * 0.92, (extras.week52Low ?? ltp * 0.85) * 1.02) * 10) / 10;

  // Target price: fair P/E approach, or NAV-based
  let targetPrice: number | null = null;
  if (extras.eps !== null && extras.eps > 0 && extras.pe !== null) {
    const fairPe = Math.min(extras.pe, 15);
    const forwardEps = extras.eps * 1.1;
    targetPrice = Math.round(forwardEps * fairPe * 10) / 10;
  } else if (extras.nav !== null && extras.nav > 0) {
    targetPrice = Math.round(extras.nav * 1.5 * 10) / 10;
  }
  const upsidePct = targetPrice !== null ? Math.round((targetPrice / ltp - 1) * 1000) / 10 : null;
  const downsidePct = Math.round((1 - stopLoss / ltp) * 1000) / 10;

  const tags = reasonTags(extras.pe, priceNav, extras.dividendYieldPct, pos52w, extras.betaFloat, extras.listedYears);

  return {
    type: "pick",
    result: {
      symbol,
      sector: extras.sector,
      score: total,
      conviction: conviction(total),
      currentPrice: ltp,
      buyZoneLow,
      buyZoneHigh,
      targetPrice,
      upsidePct,
      stopLoss,
      downsidePct,
      horizon: horizon(total, extras.betaFloat),
      reasonTags: tags,
      breakdown,
      pe: extras.pe,
      priceNav,
      divYieldPct: extras.dividendYieldPct,
      position52wPct: pos52w !== null ? Math.round(pos52w * 1000) / 10 : null,
      beta: extras.betaFloat,
    },
  };
}

// ─── Rank and select ──────────────────────────────────────────────────────────

export function rankAndSelect(
  scored: { symbol: string; score: number; sector: string | null; result: Omit<OraclePickResult, "allocationPct"> }[],
): { picks: OraclePickResult[]; watchlist: OracleWatchlistItem[] } {
  const sorted = [...scored].sort((a, b) => b.score - a.score);

  const picks: OraclePickResult[] = [];
  const sectorCount: Record<string, number> = {};

  const watchlistCandidates: typeof scored = [];

  for (const item of sorted) {
    if (item.score < ORACLE_WATCHLIST_MIN) continue;
    if (item.score < ORACLE_THRESHOLD) {
      watchlistCandidates.push(item);
      continue;
    }
    if (picks.length >= MAX_PICKS) continue;
    const sectorKey = item.sector?.toLowerCase() ?? "__unknown__";
    const count = sectorCount[sectorKey] ?? 0;
    if (count >= SECTOR_CAP) continue;
    sectorCount[sectorKey] = count + 1;
    picks.push({ ...item.result, allocationPct: 0 });
  }

  // Compute allocation weights
  const totalScore = picks.reduce((s, p) => s + p.score, 0);
  if (totalScore > 0) {
    for (const pick of picks) {
      let raw = Math.round((pick.score / totalScore) * 100);
      raw = Math.max(5, Math.min(25, raw));
      pick.allocationPct = raw;
    }
    // Redistribute to sum to 100
    const sum = picks.reduce((s, p) => s + p.allocationPct, 0);
    if (sum !== 100 && picks.length > 0) {
      picks[0].allocationPct += 100 - sum;
    }
  }

  const watchlist: OracleWatchlistItem[] = watchlistCandidates.map((item) => ({
    symbol: item.symbol,
    sector: item.sector,
    score: item.score,
    currentPrice: item.result.currentPrice,
    trigger: `Score ${item.score}/100 — needs 65+ to enter picks`,
  }));

  return { picks, watchlist };
}

// ─── Market sentiment (simple rule-based) ────────────────────────────────────

export function computeSentiment(
  picksCount: number,
  avgScore: number,
): { sentiment: OracleSentiment; reason: string } {
  if (picksCount === 0) {
    return { sentiment: "Cautious", reason: "No stocks passed the quality threshold — market may be overheated or data is limited" };
  }
  if (avgScore >= 75) {
    return { sentiment: "Bullish", reason: `${picksCount} high-quality picks averaging ${Math.round(avgScore)}/100` };
  }
  if (avgScore >= 60) {
    return { sentiment: "Neutral", reason: `${picksCount} picks with moderate conviction (avg ${Math.round(avgScore)}/100)` };
  }
  return { sentiment: "Cautious", reason: "Low-conviction environment — consider waiting for better entry points" };
}

export const ORACLE_DISCLAIMER =
  "This is algorithmic analytical output, not licensed investment advice. DSE carries circuit-breaker, liquidity, and political risk. Verify with your broker. Past performance does not guarantee future results.";
