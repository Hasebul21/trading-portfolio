/**
 * Oracle — professional 5-pillar scoring engine. Powers the per-row Signal
 * column on the portfolio table and the advanced metrics on the calculator.
 *
 * Pillar A — Valuation   (30 pts): P/E, Graham Number MoS, Earnings Yield
 * Pillar B — Quality     (25 pts): ROE, Dividend Yield, Payout Sustainability
 * Pillar C — Safety      (20 pts): Market Cap, Free Float, Listing Age, Category
 * Pillar D — Technical   (25 pts): 52W Position, Drawdown Recovery, Price/NAV
 *
 * Advanced metrics (hard to find for retail investors):
 *   Graham Number  = √(22.5 × EPS × NAV)  — Benjamin Graham intrinsic value ceiling
 *   Earnings Yield = EPS / LTP × 100       — compare vs Bangladesh risk-free ~9.5%
 *   ROE            = EPS / NAV × 100       — equity capital efficiency
 *   Margin of Safety = (Graham − LTP) / Graham × 100
 *   Dividend Payout  = DPS / EPS × 100     — sustainability check
 *   Drawdown from Peak / Recovery from Low — technical entry signals
 */

import type { DseCompanyExtras } from "./dse-company-52w";
import type { DseLspQuote } from "./dse-lsp-quotes";

// ─── Weights (must sum to 100) ────────────────────────────────────────────────
// Pillar A — Valuation (30)
const W_PE = 10;
const W_GRAHAM = 12;
const W_EY = 8;
// Pillar B — Quality (25)
const W_ROE = 12;
const W_DIV = 8;
const W_PAYOUT = 5;
// Pillar C — Safety (20)
const W_MCAP = 6;
const W_FLOAT = 5;
const W_AGE = 5;
const W_CATEGORY = 4;
// Pillar D — Technical (25)
const W_52W = 12;
const W_DRAWDOWN = 8;
const W_PNAV = 5;

/** Bangladesh 10Y T-bill proxy — used for Earnings Yield comparison. */
const BD_RISK_FREE = 0.095;

export const ORACLE_THRESHOLD = 55;
export const ORACLE_WATCHLIST_MIN = 40;
const MAX_PICKS = 8;
const SECTOR_CAP = 2;

// ─── Gate reasons ─────────────────────────────────────────────────────────────
export type GateReason =
  | "Non-A category"
  | "Loss-making (EPS ≤ 0)"
  | "Overvalued (P/E > 50)"
  | "Negative Book Value"
  | "Extreme Price/NAV (> 6)"
  | "Low Free Float (< 10%)"
  | "AGM overdue (> 18 months)";

// ─── Output types ─────────────────────────────────────────────────────────────
export type ConvictionTier = "High Conviction" | "Strong Buy" | "Buy";
export type ValuationSignal = "Deep Value" | "Undervalued" | "Fair Value" | "Overvalued";
export type HoldingSignal = "Strong Add" | "Add" | "Hold" | "Trim" | "Exit";
export type OracleSentiment = "Bullish" | "Neutral" | "Cautious";

export type OracleReasonTag =
  | "Graham Undervalued"
  | "Deep Value"
  | "High Earnings Yield"
  | "Dividend King"
  | "Sustainable Dividend"
  | "Strong ROE"
  | "Sweet Spot Entry"
  | "Long Track Record"
  | "Large Cap Safety";

export type ScoreBreakdown = {
  peScore: number;
  grahamScore: number;
  earningsYieldScore: number;
  roeScore: number;
  divYieldScore: number;
  divPayoutScore: number;
  marketCapScore: number;
  freeFloatScore: number;
  listingAgeScore: number;
  categoryScore: number;
  position52wScore: number;
  drawdownScore: number;
  priceNavScore: number;
  total: number;
};

/** Advanced metrics that are genuinely hard to compute for a retail investor. */
export type AdvancedMetrics = {
  /** √(22.5 × EPS × NAV) — Benjamin Graham's intrinsic value ceiling */
  grahamNumber: number | null;
  /** (grahamNumber − LTP) / grahamNumber × 100; positive = undervalued */
  marginOfSafety: number | null;
  /** EPS / LTP × 100; compare to Bangladesh risk-free benchmark (9.5%) */
  earningsYield: number | null;
  /** EPS / NAV × 100; quality of equity capital deployment */
  roe: number | null;
  /** DPS / EPS × 100; < 75% = sustainable, > 100% = paying from capital */
  dividendPayoutRatio: number | null;
  /** (LTP − 52W High) / 52W High × 100; negative = % below peak */
  drawdownFromHigh: number | null;
  /** (LTP − 52W Low) / 52W Low × 100; positive = recovered from trough */
  recoveryFromLow: number | null;
  /** Qualitative valuation signal relative to Graham Number or P/NAV */
  valuationSignal: ValuationSignal | null;
  /** Best-estimate fair value (Graham Number preferred, else EPS×15 or NAV×1.2) */
  fairValue: number | null;
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
  horizon: string;
  allocationPct: number;
  reasonTags: OracleReasonTag[];
  breakdown: ScoreBreakdown;
  pe: number | null;
  priceNav: number | null;
  divYieldPct: number | null;
  position52wPct: number | null;
  beta: number | null;
  advanced: AdvancedMetrics;
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
  divYieldPct: number | null;
  trigger: string;
  advanced: Pick<AdvancedMetrics, "grahamNumber" | "marginOfSafety" | "earningsYield" | "roe">;
};

export type HoldingInput = {
  symbol: string;
  shares: number;
  avgPrice: number;
  breakEvenPrice: number;
  totalCost: number;
};

export type OracleHoldingAnalysis = {
  symbol: string;
  sector: string | null;
  score: number;
  currentPrice: number | null;
  avgCost: number;
  breakEven: number;
  shares: number;
  currentValue: number | null;
  unrealizedPL: number | null;
  unrealizedPLPct: number | null;
  distanceFromBreakEven: number | null;
  divYieldPct: number | null;
  signal: HoldingSignal;
  signalReason: string;
  advanced: Partial<AdvancedMetrics>;
};

export type OracleResult = {
  generatedAt: string;
  sentiment: OracleSentiment;
  sentimentReason: string;
  picks: OraclePickResult[];
  watchlist: OracleWatchlistItem[];
  avoided: OracleGateReject[];
  holdings: OracleHoldingAnalysis[];
  discovery: OraclePickResult[];
  disclaimer: string;
};

// ─── Advanced metrics computation ─────────────────────────────────────────────
export function computeAdvancedMetrics(extras: DseCompanyExtras, ltp: number): AdvancedMetrics {
  const { eps, nav, dividendYieldPct, week52Low, week52High } = extras;

  const grahamNumber =
    eps !== null && eps > 0 && nav !== null && nav > 0
      ? Math.round(Math.sqrt(22.5 * eps * nav) * 10) / 10
      : null;

  const marginOfSafety =
    grahamNumber !== null && grahamNumber > 0
      ? Math.round(((grahamNumber - ltp) / grahamNumber) * 1000) / 10
      : null;

  const earningsYield =
    eps !== null && ltp > 0
      ? Math.round((eps / ltp) * 1000) / 10
      : null;

  const roe =
    eps !== null && nav !== null && nav > 0
      ? Math.round((eps / nav) * 1000) / 10
      : null;

  let dividendPayoutRatio: number | null = null;
  if (dividendYieldPct !== null && dividendYieldPct > 0 && eps !== null && eps > 0) {
    const dps = (dividendYieldPct / 100) * ltp;
    dividendPayoutRatio = Math.round((dps / eps) * 1000) / 10;
  }

  const drawdownFromHigh =
    week52High !== null && week52High > 0
      ? Math.round(((ltp - week52High) / week52High) * 1000) / 10
      : null;

  const recoveryFromLow =
    week52Low !== null && week52Low > 0
      ? Math.round(((ltp - week52Low) / week52Low) * 1000) / 10
      : null;

  const priceNav = nav !== null && nav > 0 ? ltp / nav : null;

  let valuationSignal: ValuationSignal | null = null;
  if (grahamNumber !== null) {
    if (ltp < grahamNumber * 0.7) valuationSignal = "Deep Value";
    else if (ltp < grahamNumber) valuationSignal = "Undervalued";
    else if (ltp < grahamNumber * 1.3) valuationSignal = "Fair Value";
    else valuationSignal = "Overvalued";
  } else if (priceNav !== null) {
    if (priceNav < 1.0) valuationSignal = "Deep Value";
    else if (priceNav < 1.5) valuationSignal = "Undervalued";
    else if (priceNav < 2.5) valuationSignal = "Fair Value";
    else valuationSignal = "Overvalued";
  }

  let fairValue: number | null = null;
  if (grahamNumber !== null) {
    fairValue = grahamNumber;
  } else if (eps !== null && eps > 0) {
    fairValue = Math.round(eps * 15 * 10) / 10;
  } else if (nav !== null && nav > 0) {
    fairValue = Math.round(nav * 1.2 * 10) / 10;
  }

  return {
    grahamNumber,
    marginOfSafety,
    earningsYield,
    roe,
    dividendPayoutRatio,
    drawdownFromHigh,
    recoveryFromLow,
    valuationSignal,
    fairValue,
  };
}

// ─── Gate check ───────────────────────────────────────────────────────────────
function checkGates(extras: DseCompanyExtras, ltp: number): GateReason | null {
  const cat = extras.category?.trim().toUpperCase() ?? null;
  if (cat === null || !(cat === "A" || cat.startsWith("A"))) return "Non-A category";
  if (extras.eps !== null && extras.eps <= 0) return "Loss-making (EPS ≤ 0)";
  if (extras.pe !== null && extras.pe > 50) return "Overvalued (P/E > 50)";
  if (extras.nav !== null && extras.nav < 0) return "Negative Book Value";
  const pnav = extras.nav !== null && extras.nav > 0 ? ltp / extras.nav : null;
  if (pnav !== null && pnav > 6) return "Extreme Price/NAV (> 6)";
  if (extras.freeFloat !== null && extras.freeFloat < 10) return "Low Free Float (< 10%)";
  if (extras.lastAgmMonthsAgo !== null && extras.lastAgmMonthsAgo > 18) return "AGM overdue (> 18 months)";
  return null;
}

// ─── Sub-scorers ──────────────────────────────────────────────────────────────
function scorePE(pe: number | null): number {
  if (pe === null) return 2;
  if (pe <= 8) return W_PE;
  if (pe <= 12) return Math.round(W_PE * 0.8);
  if (pe <= 15) return Math.round(W_PE * 0.6);
  if (pe <= 20) return Math.round(W_PE * 0.4);
  if (pe <= 30) return Math.round(W_PE * 0.2);
  return 0;
}

function scoreGraham(mos: number | null): number {
  if (mos === null) return 0;
  if (mos >= 50) return W_GRAHAM;
  if (mos >= 30) return Math.round(W_GRAHAM * 0.83);
  if (mos >= 15) return Math.round(W_GRAHAM * 0.58);
  if (mos >= 0) return Math.round(W_GRAHAM * 0.33);
  return 0;
}

function scoreEY(ey: number | null): number {
  if (ey === null) return 0;
  const d = ey / 100;
  if (d >= 0.14) return W_EY;
  if (d >= BD_RISK_FREE + 0.035) return Math.round(W_EY * 0.75);
  if (d >= BD_RISK_FREE) return Math.round(W_EY * 0.5);
  if (d >= 0.06) return Math.round(W_EY * 0.25);
  return 0;
}

function scoreROE(roe: number | null): number {
  if (roe === null) return 1;
  if (roe >= 20) return W_ROE;
  if (roe >= 15) return Math.round(W_ROE * 0.75);
  if (roe >= 10) return Math.round(W_ROE * 0.5);
  if (roe >= 5) return Math.round(W_ROE * 0.25);
  return 0;
}

function scoreDivYield(yld: number | null): number {
  if (!yld) return 0;
  if (yld >= 8) return W_DIV;
  if (yld >= 6) return Math.round(W_DIV * 0.75);
  if (yld >= 4) return Math.round(W_DIV * 0.5);
  if (yld >= 2) return Math.round(W_DIV * 0.25);
  return 0;
}

function scorePayout(payout: number | null, yld: number | null): number {
  if (!yld) return 0;
  if (payout === null) return Math.round(W_PAYOUT * 0.4);
  if (payout <= 40) return W_PAYOUT;
  if (payout <= 60) return Math.round(W_PAYOUT * 0.8);
  if (payout <= 80) return Math.round(W_PAYOUT * 0.6);
  if (payout <= 100) return Math.round(W_PAYOUT * 0.2);
  return 0;
}

function scoreMcap(cr: number | null): number {
  if (cr === null) return 1;
  if (cr >= 1000) return W_MCAP;
  if (cr >= 500) return Math.round(W_MCAP * 0.83);
  if (cr >= 200) return Math.round(W_MCAP * 0.67);
  if (cr >= 100) return Math.round(W_MCAP * 0.5);
  if (cr >= 50) return Math.round(W_MCAP * 0.17);
  return 0;
}

function scoreFloat(ff: number | null): number {
  if (ff === null) return 1;
  if (ff >= 40) return W_FLOAT;
  if (ff >= 30) return Math.round(W_FLOAT * 0.8);
  if (ff >= 20) return Math.round(W_FLOAT * 0.4);
  if (ff >= 10) return Math.round(W_FLOAT * 0.2);
  return 0;
}

function scoreAge(yrs: number | null): number {
  if (yrs === null) return 1;
  if (yrs >= 25) return W_AGE;
  if (yrs >= 15) return Math.round(W_AGE * 0.8);
  if (yrs >= 10) return Math.round(W_AGE * 0.6);
  if (yrs >= 5) return Math.round(W_AGE * 0.4);
  if (yrs >= 2) return Math.round(W_AGE * 0.2);
  return 0;
}

function scoreCat(cat: string | null): number {
  if (!cat) return 1;
  const c = cat.trim().toUpperCase();
  if (c === "A" || c.startsWith("A")) return W_CATEGORY;
  if (c === "N") return Math.round(W_CATEGORY * 0.5);
  return 0;
}

function score52w(pos: number | null): number {
  if (pos === null) return Math.round(W_52W * 0.25);
  if (pos >= 0.25 && pos <= 0.65) return W_52W;
  if (pos >= 0.15 && pos <= 0.75) return Math.round(W_52W * 0.67);
  if (pos >= 0.05 && pos <= 0.85) return Math.round(W_52W * 0.33);
  return 0;
}

function scoreDrawdown(dd: number | null): number {
  // dd is negative (e.g. -22 = 22% below 52W high); healthy pullback = good entry
  if (dd === null) return Math.round(W_DRAWDOWN * 0.25);
  if (dd >= -5) return Math.round(W_DRAWDOWN * 0.25); // near peak, less upside
  if (dd >= -20) return W_DRAWDOWN;                     // ideal pullback zone
  if (dd >= -35) return Math.round(W_DRAWDOWN * 0.75);
  if (dd >= -50) return Math.round(W_DRAWDOWN * 0.4);
  return Math.round(W_DRAWDOWN * 0.1);
}

function scorePNAV(pnav: number | null): number {
  if (pnav === null) return 1;
  if (pnav <= 1.0) return W_PNAV;
  if (pnav <= 1.5) return Math.round(W_PNAV * 0.8);
  if (pnav <= 2.0) return Math.round(W_PNAV * 0.6);
  if (pnav <= 3.0) return Math.round(W_PNAV * 0.4);
  if (pnav <= 5.0) return Math.round(W_PNAV * 0.2);
  return 0;
}

// ─── Derived fields ───────────────────────────────────────────────────────────
function conviction(score: number): ConvictionTier {
  if (score >= 75) return "High Conviction";
  if (score >= 62) return "Strong Buy";
  return "Buy";
}

function buildTags(adv: AdvancedMetrics, extras: DseCompanyExtras, pos52w: number | null): OracleReasonTag[] {
  const tags: OracleReasonTag[] = [];
  if (adv.marginOfSafety !== null && adv.marginOfSafety >= 50) tags.push("Deep Value");
  else if (adv.marginOfSafety !== null && adv.marginOfSafety >= 30) tags.push("Graham Undervalued");
  if (adv.earningsYield !== null && adv.earningsYield / 100 >= BD_RISK_FREE + 0.03) tags.push("High Earnings Yield");
  if (adv.roe !== null && adv.roe >= 15) tags.push("Strong ROE");
  if (extras.dividendYieldPct !== null && extras.dividendYieldPct >= 6) tags.push("Dividend King");
  if (adv.dividendPayoutRatio !== null && adv.dividendPayoutRatio <= 60 && (extras.dividendYieldPct ?? 0) > 0) tags.push("Sustainable Dividend");
  if (pos52w !== null && pos52w >= 0.25 && pos52w <= 0.65) tags.push("Sweet Spot Entry");
  if ((extras.listedYears ?? 0) >= 15) tags.push("Long Track Record");
  if ((extras.marketCapCr ?? 0) >= 500) tags.push("Large Cap Safety");
  return [...new Set(tags)].slice(0, 4);
}

// ─── Main score computation ───────────────────────────────────────────────────
export function computeOracleScore(
  symbol: string,
  extras: DseCompanyExtras,
  quote: DseLspQuote | null,
): | { type: "pick"; result: Omit<OraclePickResult, "allocationPct"> }
  | { type: "gate"; reason: GateReason }
  | { type: "noPrice" } {
  if (!quote) return { type: "noPrice" };

  const ltp = quote.ltp;
  const gate = checkGates(extras, ltp);
  if (gate) return { type: "gate", reason: gate };

  const adv = computeAdvancedMetrics(extras, ltp);
  const pnav = extras.nav !== null && extras.nav > 0 ? ltp / extras.nav : null;
  const pos52 =
    extras.week52Low !== null && extras.week52High !== null && extras.week52High > extras.week52Low
      ? (ltp - extras.week52Low) / (extras.week52High - extras.week52Low)
      : null;

  const peS = scorePE(extras.pe);
  const gS = scoreGraham(adv.marginOfSafety);
  const eyS = scoreEY(adv.earningsYield);
  const roeS = scoreROE(adv.roe);
  const divS = scoreDivYield(extras.dividendYieldPct);
  const payS = scorePayout(adv.dividendPayoutRatio, extras.dividendYieldPct);
  const mcS = scoreMcap(extras.marketCapCr);
  const ffS = scoreFloat(extras.freeFloat);
  const ageS = scoreAge(extras.listedYears);
  const catS = scoreCat(extras.category);
  const posS = score52w(pos52);
  const ddS = scoreDrawdown(adv.drawdownFromHigh);
  const pnS = scorePNAV(pnav);

  const total = Math.round(peS + gS + eyS + roeS + divS + payS + mcS + ffS + ageS + catS + posS + ddS + pnS);

  const breakdown: ScoreBreakdown = {
    peScore: Math.round(peS),
    grahamScore: Math.round(gS),
    earningsYieldScore: Math.round(eyS),
    roeScore: Math.round(roeS),
    divYieldScore: Math.round(divS),
    divPayoutScore: Math.round(payS),
    marketCapScore: Math.round(mcS),
    freeFloatScore: Math.round(ffS),
    listingAgeScore: Math.round(ageS),
    categoryScore: Math.round(catS),
    position52wScore: Math.round(posS),
    drawdownScore: Math.round(ddS),
    priceNavScore: Math.round(pnS),
    total,
  };

  // Buy zone anchored to fair value when stock is above it, else near current price
  const fv = adv.fairValue;
  const buyZoneLow = fv !== null && fv < ltp ? Math.round(fv * 0.95 * 10) / 10 : Math.round(ltp * 0.95 * 10) / 10;
  const buyZoneHigh = fv !== null && fv < ltp ? Math.round(fv * 1.02 * 10) / 10 : Math.round(ltp * 1.02 * 10) / 10;
  // Stop loss: deeper of 10%-from-LTP or just-above-52W-low, but never closer
  // than 3% to LTP (otherwise stocks sitting on their 52W low would yield a
  // stop above current price → negative downside).
  const rawStop = Math.max(ltp * 0.90, (extras.week52Low ?? ltp * 0.85) * 1.01);
  const stopLoss = Math.round(Math.min(rawStop, ltp * 0.97) * 10) / 10;
  const targetPrice = fv !== null ? Math.round(fv * 1.05 * 10) / 10 : null;
  const upsidePct = targetPrice !== null ? Math.round((targetPrice / ltp - 1) * 1000) / 10 : null;
  const downsidePct = Math.round((1 - stopLoss / ltp) * 1000) / 10;
  const horizon = total >= 75 ? "Long (1Y+)" : total >= 62 ? "Medium (3–12M)" : "Short (1–3M)";

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
      horizon,
      reasonTags: buildTags(adv, extras, pos52),
      breakdown,
      pe: extras.pe,
      priceNav: pnav,
      divYieldPct: extras.dividendYieldPct,
      position52wPct: pos52 !== null ? Math.round(pos52 * 1000) / 10 : null,
      beta: null,
      advanced: adv,
    },
  };
}

// ─── Portfolio holding analysis ───────────────────────────────────────────────
export function computeHoldingAnalysis(
  holding: HoldingInput,
  extras: DseCompanyExtras,
  quote: DseLspQuote | null,
): OracleHoldingAnalysis {
  const ltp = quote?.ltp ?? null;
  let score = 0;
  let adv: Partial<AdvancedMetrics> = {};

  if (ltp !== null) {
    adv = computeAdvancedMetrics(extras, ltp);
    const sr = computeOracleScore(holding.symbol, extras, quote);
    if (sr.type === "pick") score = sr.result.score;
  }

  const currentValue = ltp !== null ? Math.round(ltp * holding.shares * 100) / 100 : null;
  const unrealizedPL = currentValue !== null ? Math.round((currentValue - holding.totalCost) * 100) / 100 : null;
  const unrealizedPLPct = ltp !== null ? Math.round((ltp / holding.avgPrice - 1) * 1000) / 10 : null;
  const distanceFromBE = ltp !== null ? Math.round((ltp / holding.breakEvenPrice - 1) * 1000) / 10 : null;

  const mos = (adv as AdvancedMetrics).marginOfSafety ?? null;
  const gn = (adv as AdvancedMetrics).grahamNumber ?? null;

  let signal: HoldingSignal = "Hold";
  let signalReason = "";

  // Reserved trigger: a fresh break below the published 52-week low. This is a
  // pure technical-breakdown signal — no support has held — so it overrides any
  // fundamental verdict regardless of score, P/L, or Graham value.
  const broke52WLow =
    ltp !== null &&
    extras.week52Low !== null &&
    extras.week52Low > 0 &&
    ltp < extras.week52Low;

  if (broke52WLow) {
    signal = "Exit";
    signalReason = `Price ${ltp!.toFixed(2)} broke below 52W low ${extras.week52Low!.toFixed(2)} — exit to limit further downside`;
  } else if (score >= ORACLE_THRESHOLD) {
    if (unrealizedPLPct !== null && unrealizedPLPct <= -15 && mos !== null && mos > 0) {
      signal = "Strong Add";
      signalReason = "Quality stock below Graham value and below your cost — strong averaging opportunity";
    } else if (unrealizedPLPct !== null && unrealizedPLPct <= 5) {
      signal = "Add";
      signalReason = "Quality stock near entry cost — valid opportunity to build position";
    } else if (unrealizedPLPct !== null && unrealizedPLPct >= 40 && (gn === null || ltp! > gn * 1.25)) {
      signal = "Trim";
      signalReason = "Large gain in quality position that may be above intrinsic value — consider partial exit";
    } else {
      signal = "Hold";
      signalReason = "Quality position within expected range — maintain";
    }
  } else if (score >= ORACLE_WATCHLIST_MIN) {
    if (unrealizedPLPct !== null && unrealizedPLPct >= 20) {
      signal = "Trim";
      signalReason = "Moderate-quality position with meaningful gain — lock in profits";
    } else if (unrealizedPLPct !== null && unrealizedPLPct < -15) {
      signal = "Trim";
      signalReason = "Moderate-quality stock with significant loss — reduce exposure";
    } else {
      signal = "Hold";
      signalReason = "Moderate quality — no strong action signal";
    }
  } else {
    // Low quality (score < ORACLE_WATCHLIST_MIN). Exit is reserved for the
    // 52W-low break above, so weak fundamentals + drawdown collapse to Trim
    // — reduce exposure but only fully exit on a technical breakdown.
    if (unrealizedPLPct !== null && unrealizedPLPct >= 0) {
      signal = "Trim";
      signalReason = "Low quality rating while in profit — strong case to reduce";
    } else {
      signal = "Trim";
      signalReason = "Low quality score while at a loss — reduce exposure (no 52W break yet)";
    }
  }

  return {
    symbol: holding.symbol,
    sector: extras.sector,
    score,
    currentPrice: ltp,
    avgCost: holding.avgPrice,
    breakEven: holding.breakEvenPrice,
    shares: holding.shares,
    currentValue,
    unrealizedPL,
    unrealizedPLPct,
    distanceFromBreakEven: distanceFromBE,
    divYieldPct: extras.dividendYieldPct,
    signal,
    signalReason,
    advanced: adv,
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
    if (item.score < ORACLE_THRESHOLD) { watchlistCandidates.push(item); continue; }
    const sk = item.sector?.toLowerCase() ?? "__unknown__";
    // Demote to watchlist when we'd otherwise drop a high-score name due to
    // hard caps — the user should still see it instead of silently losing it.
    if (picks.length >= MAX_PICKS || (sectorCount[sk] ?? 0) >= SECTOR_CAP) {
      watchlistCandidates.push(item);
      continue;
    }
    sectorCount[sk] = (sectorCount[sk] ?? 0) + 1;
    picks.push({ ...item.result, allocationPct: 0 });
  }

  // Score-weighted allocation with per-pick floor (5%) and ceiling (25%).
  // Distribute the rounding/clamp residual proportionally across picks that
  // still have headroom so the top pick never silently breaches the ceiling.
  const totalScore = picks.reduce((s, p) => s + p.score, 0);
  if (picks.length === 1) {
    picks[0]!.allocationPct = 100;
  } else if (totalScore > 0 && picks.length > 0) {
    const FLOOR = 5;
    const CEIL = 25;
    const raw = picks.map((p) => Math.max(FLOOR, Math.min(CEIL, Math.round((p.score / totalScore) * 100))));
    let diff = 100 - raw.reduce((a, b) => a + b, 0);
    // Iteratively nudge picks (top-score first when adding, bottom-score first
    // when subtracting) without violating the per-pick caps.
    const order = picks.map((_, i) => i);
    const guard = picks.length * Math.abs(diff) + 1;
    let steps = 0;
    while (diff !== 0 && steps < guard) {
      let progressed = false;
      const iter = diff > 0 ? order : [...order].reverse();
      for (const i of iter) {
        if (diff === 0) break;
        if (diff > 0 && raw[i]! < CEIL) { raw[i]! += 1; diff -= 1; progressed = true; }
        else if (diff < 0 && raw[i]! > FLOOR) { raw[i]! -= 1; diff += 1; progressed = true; }
      }
      if (!progressed) break; // every pick at its bound — accept residual rather than corrupt caps
      steps += 1;
    }
    picks.forEach((p, i) => { p.allocationPct = raw[i] ?? 0; });
  }

  const watchlist: OracleWatchlistItem[] = watchlistCandidates.map((item) => {
    const adv = item.result.advanced;
    let trigger = `Score ${item.score}/100`;
    if (item.score >= ORACLE_THRESHOLD) {
      trigger += ` · qualifies but capped (sector or max picks)`;
    } else if (adv.marginOfSafety !== null && adv.marginOfSafety > 0) {
      trigger += ` · ${adv.marginOfSafety.toFixed(0)}% below Graham fair value`;
    } else if (adv.earningsYield !== null && adv.earningsYield / 100 >= BD_RISK_FREE) {
      trigger += ` · earnings yield ${adv.earningsYield.toFixed(1)}% beats risk-free`;
    } else {
      trigger += ` · needs ${ORACLE_THRESHOLD} to enter picks`;
    }
    return {
      symbol: item.symbol,
      sector: item.sector,
      score: item.score,
      currentPrice: item.result.currentPrice,
      divYieldPct: item.result.divYieldPct,
      trigger,
      advanced: {
        grahamNumber: adv.grahamNumber,
        marginOfSafety: adv.marginOfSafety,
        earningsYield: adv.earningsYield,
        roe: adv.roe,
      },
    };
  });

  return { picks, watchlist };
}

// ─── Market sentiment ─────────────────────────────────────────────────────────
export function computeSentiment(
  picksCount: number,
  avgScore: number,
): { sentiment: OracleSentiment; reason: string } {
  if (picksCount === 0) return { sentiment: "Cautious", reason: "No stocks passed the quality threshold — market may be overheated or data is limited" };
  if (avgScore >= 70) return { sentiment: "Bullish", reason: `${picksCount} high-quality picks averaging ${Math.round(avgScore)}/100` };
  if (avgScore >= 55) return { sentiment: "Neutral", reason: `${picksCount} picks with moderate conviction (avg ${Math.round(avgScore)}/100)` };
  return { sentiment: "Neutral", reason: `${picksCount} picks with low-to-moderate conviction (avg ${Math.round(avgScore)}/100)` };
}

export const ORACLE_DISCLAIMER =
  "Algorithmic analysis only — not licensed investment advice. Graham Number and ROE are estimates from DSE-published data. DSE carries circuit-breaker, liquidity, political, and currency risk. Verify with your broker before acting.";

// ─── Discovery selection ─────────────────────────────────────────────────────
// Surface high-conviction names from outside the user's watchlist/portfolio.
// One pick per sector keeps the slate diverse; we do NOT assign allocations
// because these aren't owned/tracked yet — the user must opt-in by adding to
// the Watchlist first.
export const ORACLE_DISCOVERY_MIN_SCORE = 60;
export const ORACLE_DISCOVERY_MAX = 6;
export const ORACLE_DISCOVERY_SECTOR_CAP = 1;

export function selectDiscoveryPicks(
  scored: { symbol: string; score: number; sector: string | null; result: Omit<OraclePickResult, "allocationPct"> }[],
  opts: { maxPicks?: number; sectorCap?: number; minScore?: number } = {},
): OraclePickResult[] {
  const maxPicks = opts.maxPicks ?? ORACLE_DISCOVERY_MAX;
  const sectorCap = opts.sectorCap ?? ORACLE_DISCOVERY_SECTOR_CAP;
  const minScore = opts.minScore ?? ORACLE_DISCOVERY_MIN_SCORE;

  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const out: OraclePickResult[] = [];
  const sectorCount: Record<string, number> = {};

  for (const item of sorted) {
    if (item.score < minScore) break;
    const sk = item.sector?.toLowerCase() ?? "__unknown__";
    if ((sectorCount[sk] ?? 0) >= sectorCap) continue;
    sectorCount[sk] = (sectorCount[sk] ?? 0) + 1;
    out.push({ ...item.result, allocationPct: 0 });
    if (out.length >= maxPicks) break;
  }
  return out;
}
