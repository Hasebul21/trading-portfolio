/**
 * Per-sector monthly investment helpers — pure functions shared by the
 * settings UI and the server action so the same validation rules apply on
 * both sides (sector key normalisation, dedup, amount bounds, total math).
 *
 * Reuses the sector label/key helpers from {@link ./sector-targets} so a
 * sector named here matches a sector named in the target-allocation feature.
 */

import {
  SECTOR_TARGET_MAX_ROWS,
  normalizeSectorLabel,
  sectorMatchKey,
} from "./sector-targets";

export type SectorInvestmentRow = {
  sector: string;
  amount_bdt: number;
};

/** Same row cap as sector targets — kept in lockstep on purpose. */
export const SECTOR_INVESTMENT_MAX_ROWS = SECTOR_TARGET_MAX_ROWS;

/** Sanity cap so a fat-fingered entry can't store an absurd amount. */
export const SECTOR_INVESTMENT_MAX_AMOUNT = 1_000_000_000;

export type SectorInvestmentValidation =
  | { ok: true; rows: SectorInvestmentRow[]; totalBdt: number }
  | { ok: false; error: string };

/**
 * Validate a list of edited monthly-investment rows. Caps total rows, rejects
 * negative / out-of-range amounts, deduplicates by case-insensitive sector
 * key, and returns the canonical rows plus their monthly total in BDT.
 */
export function validateSectorInvestments(
  raw: ReadonlyArray<{ sector: string; amount_bdt: unknown }>,
): SectorInvestmentValidation {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Invalid payload." };
  }
  if (raw.length > SECTOR_INVESTMENT_MAX_ROWS) {
    return {
      ok: false,
      error: `Too many sectors (max ${SECTOR_INVESTMENT_MAX_ROWS}).`,
    };
  }

  const seen = new Set<string>();
  const rows: SectorInvestmentRow[] = [];
  let total = 0;

  for (const row of raw) {
    const sector = normalizeSectorLabel(row.sector);
    if (!sector) {
      return { ok: false, error: "Sector name is required." };
    }
    const key = sectorMatchKey(sector);
    if (seen.has(key)) {
      return { ok: false, error: `Duplicate sector "${sector}".` };
    }
    seen.add(key);

    const num = Number(row.amount_bdt);
    if (!Number.isFinite(num) || num < 0 || num > SECTOR_INVESTMENT_MAX_AMOUNT) {
      return {
        ok: false,
        error: `${sector}: amount must be between 0 and ${SECTOR_INVESTMENT_MAX_AMOUNT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
      };
    }
    const rounded = Math.round(num * 100) / 100;
    rows.push({ sector, amount_bdt: rounded });
    total += rounded;
  }

  return { ok: true, rows, totalBdt: Math.round(total * 100) / 100 };
}
