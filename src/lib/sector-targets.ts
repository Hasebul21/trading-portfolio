/**
 * Sector target allocation helpers — pure functions used by both the
 * settings UI and the /allocation page so the same rules apply
 * everywhere (sector key normalisation, sum / drift math, etc.).
 */

export type SectorTargetRow = {
  sector: string;
  target_percent: number;
};

export const UNKNOWN_SECTOR_LABEL = "Unknown";
export const SECTOR_TARGET_MAX_ROWS = 30;

/**
 * Canonical Dhaka Stock Exchange (DSE) sector list. Used to populate the
 * sector pickers in Settings so every standard sector is selectable even
 * before the user holds a position in it. Free-text entry is still allowed
 * for anything outside this list.
 */
export const DSE_SECTORS: readonly string[] = [
  "Bank",
  "Cement",
  "Ceramics Sector",
  "Corporate Bond",
  "Debenture",
  "Engineering",
  "Financial Institutions",
  "Food and Allied",
  "Fuel and Power",
  "Insurance",
  "IT Sector",
  "Jute",
  "Miscellaneous",
  "Mutual Funds",
  "Paper and Printing",
  "Pharmaceuticals and Chemicals",
  "Services and Real Estate",
  "SME Sector",
  "Tannery Industries",
  "Telecommunication",
  "Textile",
];

/** Trim and collapse internal whitespace; preserve original casing for display. */
export function normalizeSectorLabel(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim().replace(/\s+/g, " ");
  return s.length > 0 ? s : UNKNOWN_SECTOR_LABEL;
}

/** Case-insensitive key for matching across portfolio rows / target rows. */
export function sectorMatchKey(label: string): string {
  return normalizeSectorLabel(label).toLowerCase();
}

export type SectorTargetValidation =
  | { ok: true; rows: SectorTargetRow[]; sumPercent: number }
  | { ok: false; error: string };

/**
 * Validate a list of edited target rows. Caps total rows, rejects bad
 * percentages, deduplicates by case-insensitive sector key, and returns the
 * canonical rows plus their sum so the caller can warn (but not block) when
 * the user has not allocated 100%.
 */
export function validateSectorTargets(
  raw: ReadonlyArray<{ sector: string; target_percent: unknown }>,
): SectorTargetValidation {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Invalid payload." };
  }
  if (raw.length > SECTOR_TARGET_MAX_ROWS) {
    return {
      ok: false,
      error: `Too many sectors (max ${SECTOR_TARGET_MAX_ROWS}).`,
    };
  }

  const seen = new Set<string>();
  const rows: SectorTargetRow[] = [];
  let sum = 0;

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

    const num = Number(row.target_percent);
    if (!Number.isFinite(num) || num < 0 || num > 100) {
      return {
        ok: false,
        error: `${sector}: target must be between 0 and 100.`,
      };
    }
    const rounded = Math.round(num * 100) / 100;
    rows.push({ sector, target_percent: rounded });
    sum += rounded;
  }

  return { ok: true, rows, sumPercent: Math.round(sum * 100) / 100 };
}
