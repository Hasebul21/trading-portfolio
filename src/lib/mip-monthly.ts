/** Asia/Dhaka calendar helpers for MIP submission windows and carry-forward. */

export function yearMonthDhaka(d: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const y = p.find((x) => x.type === "year")?.value ?? "1970";
  const m = p.find((x) => x.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

export function calendarDayDhaka(d: Date): number {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
  }).formatToParts(d);
  return Number(p.find((x) => x.type === "day")?.value ?? "1");
}

/** Plan date must fall on calendar day 5–25 in Dhaka. */
export function isPlanDateInAllowedDayRange(planDate: Date): boolean {
  const day = calendarDayDhaka(planDate);
  return day >= 5 && day <= 25;
}

export function nextYearMonth(ym: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!m) return null;
  let y = Number(m[1]);
  let mo = Number(m[2]);
  if (mo >= 12) {
    y += 1;
    mo = 1;
  } else {
    mo += 1;
  }
  return `${y}-${String(mo).padStart(2, "0")}`;
}

/**
 * Submission allowed for current month (days 5–25) or next month (any day).
 * This allows planning ahead for the upcoming month at any time.
 */
export function isTodayDhakaInSubmissionWindowForYm(ym: string, now: Date = new Date()): boolean {
  const currentYm = yearMonthDhaka(now);

  // Allow submission for the next month at any time
  const upcomingYm = nextYearMonth(currentYm);
  if (upcomingYm === ym) return true;

  // For current month, allow only on days 5–25
  if (currentYm === ym) {
    const day = calendarDayDhaka(now);
    return day >= 5 && day <= 25;
  }

  return false;
}

export function prevYearMonth(ym: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!m) return null;
  let y = Number(m[1]);
  let mo = Number(m[2]);
  if (mo <= 1) {
    y -= 1;
    mo = 12;
  } else {
    mo -= 1;
  }
  return `${y}-${String(mo).padStart(2, "0")}`;
}

export function ymToDisplayTitle(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!m) return ym;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return new Date(Date.UTC(y, mo - 1, 15)).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type MipHeaderLike = {
  base_amount_bdt: number;
  carried_forward_bdt: number;
};

export type MipRowLike = {
  locked: boolean;
  percentage: number | string | null;
};

export function effectiveMonthlyTotalBdt(header: MipHeaderLike): number {
  const b = Number(header.base_amount_bdt);
  const c = Number(header.carried_forward_bdt);
  if (!Number.isFinite(b) || b <= 0) return 0;
  const cc = Number.isFinite(c) && c >= 0 ? c : 0;
  return Math.round((b + cc) * 100) / 100;
}

/** Sum of percentages on locked rows only. */
export function sumLockedPercentages(rows: readonly MipRowLike[]): number {
  let s = 0;
  for (const r of rows) {
    if (!r.locked) continue;
    const p = Number(r.percentage);
    if (Number.isFinite(p) && p > 0) s += p;
  }
  return Math.round(s * 10000) / 10000;
}

/**
 * Unallocated portion of previous month's effective total (locked rows only for % sum).
 * Returns amount in BDT to add to next month's base as `carried_forward_bdt`.
 */
export function carryForwardBdtFromPrevious(
  prevHeader: MipHeaderLike | null,
  prevLockedRows: readonly MipRowLike[],
): number {
  if (!prevHeader) return 0;
  const total = effectiveMonthlyTotalBdt(prevHeader);
  if (total <= 0) return 0;
  const sumPct = sumLockedPercentages(prevLockedRows);
  if (sumPct >= 100) return 0;
  const remainderPct = 100 - sumPct;
  return Math.round((remainderPct / 100) * total * 100) / 100;
}

export function calculatedAllocationBdt(
  percentage: number,
  effectiveTotalBdt: number,
): number {
  if (!Number.isFinite(percentage) || percentage <= 0 || !Number.isFinite(effectiveTotalBdt)) return 0;
  return Math.round((percentage / 100) * effectiveTotalBdt * 100) / 100;
}
