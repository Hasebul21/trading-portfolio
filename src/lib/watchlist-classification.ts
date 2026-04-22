export type WatchlistClassification = "BLUE" | "GREEN" | null;

export function normalizeWatchlistClassification(raw: unknown): WatchlistClassification {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "BLUE" || s === "GREEN") return s;
  return null;
}

export type WatchlistClassFilter = "ALL" | "CLASSIFIED" | "BLUE" | "GREEN" | "NONE";

export const WATCHLIST_CLASS_FILTER_OPTIONS: { value: WatchlistClassFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "CLASSIFIED", label: "Blue + Green" },
  { value: "BLUE", label: "Blue chip" },
  { value: "GREEN", label: "Green chip" },
  { value: "NONE", label: "Unclassified" },
];
