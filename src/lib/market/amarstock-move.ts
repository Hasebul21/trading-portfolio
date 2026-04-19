/**
 * AmarStock JSON feed (unofficial; may change).
 * @see https://www.amarstock.com/api/feed/index/move
 * Contains top index movers only — not full DSE universe.
 */

export type AmarMoverRow = {
  Scrip: string;
  LTP: number;
  Change: number;
  ChangePer: number;
  IdxMove?: number;
};

export type AmarMovePayload = {
  pos?: AmarMoverRow[];
  neg?: AmarMoverRow[];
};

export type AmarQuote = {
  ltp: number;
  change: number;
  changePer: number;
};

const DEFAULT_URL = "https://www.amarstock.com/api/feed/index/move";

export async function fetchAmarstockMoversLtpMap(
  url: string = process.env.AMARSTOCK_MOVE_URL ?? DEFAULT_URL,
): Promise<{ bySymbol: Map<string, AmarQuote>; error: string | null }> {
  const bySymbol = new Map<string, AmarQuote>();

  try {
    const res = await fetch(url, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return { bySymbol, error: `AmarStock HTTP ${res.status}` };
    }

    const data = (await res.json()) as AmarMovePayload;
    const lists = [data.pos ?? [], data.neg ?? []];

    for (const list of lists) {
      for (const row of list) {
        const sym = String(row?.Scrip ?? "")
          .trim()
          .toUpperCase();
        if (!sym || typeof row.LTP !== "number") continue;
        bySymbol.set(sym, {
          ltp: row.LTP,
          change: Number(row.Change),
          changePer: Number(row.ChangePer),
        });
      }
    }

    return { bySymbol, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { bySymbol, error: msg };
  }
}
