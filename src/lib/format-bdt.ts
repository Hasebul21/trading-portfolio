/** BDT currency; never more than two fraction digits. */
export function formatBdt(n: number): string {
  return n.toLocaleString("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Non-currency amounts for tables: locale grouping, at most two fraction digits.
 */
export function formatNumberMax2Decimals(n: number): string {
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
