/**
 * Non-currency amounts for tables: locale grouping, always two fraction digits.
 */
export function formatNumberMax2Decimals(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Same as {@link formatNumberMax2Decimals} — plain amount, no currency code or symbol in the string.
 * Kept as `formatBdt` for call sites that represent taka amounts in the UI.
 */
export function formatBdt(n: number): string {
  return formatNumberMax2Decimals(n);
}

/**
 * Share counts: locale grouping, no forced decimals. Whole numbers render
 * without a fraction ("5"), fractional lots keep up to two digits ("5.5").
 */
export function formatShares(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Same numeric rule as {@link formatNumberMax2Decimals} but no thousands separators (safe for inputs).
 */
export function formatPlainNumberMax2Decimals(n: number): string {
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US", {
    useGrouping: false,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
