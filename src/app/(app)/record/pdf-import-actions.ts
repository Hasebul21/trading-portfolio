"use server";

import { createClient } from "@/lib/supabase/server";
import { getCachedDseInstruments } from "@/lib/market/dse-instruments";
import { aggregateHoldings, type TransactionRow } from "@/lib/portfolio";
import { syncWatchlistAfterLedgerChange } from "@/lib/portfolio-watchlist-sync";
import { extractPdfText } from "@/lib/trade-confirmation/extract";
import {
  parseTradeConfirmation,
  type ParsedTrade,
} from "@/lib/trade-confirmation/parse";
import { revalidatePath } from "next/cache";

/** One parsed row, enriched with validation flags for the preview UI. */
export type ImportTradeRow = ParsedTrade & {
  /** Symbol is present in the DSE instruments list. */
  knownSymbol: boolean;
  /** A matching transaction already exists on the same trade date. */
  duplicate: boolean;
};

export type ParsePdfState = {
  ok?: boolean;
  error?: string;
  tradeDate: string | null;
  confirmationNo: string | null;
  trades: ImportTradeRow[];
  warnings: string[];
};

const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MB — confirmation notes are tiny.

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dupeKey(symbol: string, side: string, quantity: number, price: number): string {
  return `${symbol.toUpperCase()}|${side}|${quantity}|${price}`;
}

/**
 * Parse an uploaded trade confirmation PDF into reviewable rows. This does NOT
 * write anything — the user confirms the (editable) preview before importing.
 *
 * Privacy: the PDF is never persisted. Its bytes are read into memory, handed
 * to the text extractor, and dropped when this request ends — no disk, no
 * storage bucket, no DB. Only the parsed numbers leave this function. Keep it
 * that way; do not stash the file or its buffer anywhere.
 */
export async function parseTradeConfirmationPdf(
  formData: FormData,
): Promise<ParsePdfState> {
  const empty: ParsePdfState = {
    tradeDate: null,
    confirmationNo: null,
    trades: [],
    warnings: [],
  };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ...empty, error: "Please choose a PDF file to upload." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ...empty, error: "That PDF is too large (max 5 MB)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ...empty, error: "You must be signed in." };
  }

  let parsed;
  try {
    const text = await extractPdfText(await file.arrayBuffer());
    // TEMP DEBUG: dump the raw extracted text so we can tune the parser to the
    // real PDF layout. Remove once parsing is verified.
    console.log(
      "\n========== [pdf-import] RAW EXTRACTED TEXT START ==========\n" +
        text +
        "\n========== [pdf-import] RAW EXTRACTED TEXT END ==========\n",
    );
    parsed = parseTradeConfirmation(text);
  } catch {
    return { ...empty, error: "Could not read that PDF. Is it a valid file?" };
  }

  // Known-symbol check against the DSE trading-code list.
  const { instruments } = await getCachedDseInstruments();
  const known = new Set(instruments.map((i) => i.symbol.toUpperCase()));

  // Duplicate check: any existing transaction on the same trade date with the
  // same symbol/side/qty/price. Only meaningful when we have a trade date.
  const existing = new Set<string>();
  if (parsed.tradeDate) {
    const { data: rows } = await supabase
      .from("transactions")
      .select("symbol, side, quantity, price_per_share, created_at");
    for (const r of (rows ?? []) as Array<{
      symbol: string;
      side: string;
      quantity: number;
      price_per_share: number;
      created_at: string;
    }>) {
      if (dayKey(r.created_at) !== parsed.tradeDate) continue;
      existing.add(
        dupeKey(r.symbol, r.side, Number(r.quantity), Number(r.price_per_share)),
      );
    }
  }

  const trades: ImportTradeRow[] = parsed.trades.map((t) => ({
    ...t,
    knownSymbol: known.size === 0 ? true : known.has(t.symbol),
    duplicate: existing.has(
      dupeKey(t.symbol, t.side, t.quantity, t.pricePerShare),
    ),
  }));

  return {
    ok: true,
    tradeDate: parsed.tradeDate,
    confirmationNo: parsed.confirmationNo,
    trades,
    warnings: parsed.warnings,
  };
}

export type ImportTradeInput = {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  pricePerShare: number;
  feesBdt: number;
};

export type ImportTradesState = { ok?: boolean; error?: string; summary?: string };

/**
 * Bulk-insert reviewed trades from a confirmation note. Trades are stamped with
 * the note's trade date (preserving buy-before-sell order via per-row second
 * offsets) and the same post-trade bookkeeping `recordTransaction` runs —
 * clearing position overrides, un-hiding symbols, and syncing the watchlist.
 */
export async function importTradeConfirmation(
  input: { tradeDate: string | null; trades: ImportTradeInput[] },
): Promise<ImportTradesState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  // Validate / normalise every row up front; reject the whole batch on a bad
  // row rather than silently importing a partial set.
  const clean: ImportTradeInput[] = [];
  for (const t of input.trades ?? []) {
    const symbol = String(t.symbol ?? "").trim().toUpperCase();
    const side = t.side === "sell" ? "sell" : t.side === "buy" ? "buy" : null;
    const quantity = Number(t.quantity);
    const pricePerShare = Number(t.pricePerShare);
    let feesBdt = Number(t.feesBdt);
    if (!symbol) return { error: "A row is missing its symbol." };
    if (!side) return { error: `Invalid side for ${symbol}.` };
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: `Quantity for ${symbol} must be a positive number.` };
    }
    if (!Number.isFinite(pricePerShare) || pricePerShare < 0) {
      return { error: `Price for ${symbol} must be zero or greater.` };
    }
    if (!Number.isFinite(feesBdt) || feesBdt < 0) feesBdt = 0;
    feesBdt = Math.round(feesBdt * 100) / 100;
    clean.push({ symbol, side, quantity, pricePerShare, feesBdt });
  }

  if (clean.length === 0) {
    return { error: "No trades selected to import." };
  }

  // Stamp created_at from the trade date (noon UTC to avoid date-shift), adding
  // a one-second offset per row so the ledger preserves the note's ordering.
  // When no trade date was parsed, fall back to the DB default (now()).
  const baseMs = input.tradeDate
    ? new Date(`${input.tradeDate}T12:00:00.000Z`).getTime()
    : null;

  const payload = clean.map((t, i) => ({
    user_id: user.id,
    symbol: t.symbol,
    side: t.side,
    quantity: t.quantity,
    price_per_share: t.pricePerShare,
    category: null,
    fees_bdt: t.feesBdt,
    ...(baseMs !== null
      ? { created_at: new Date(baseMs + i * 1000).toISOString() }
      : {}),
  }));

  const { error: insertError } = await supabase.from("transactions").insert(payload);
  if (insertError) {
    return { error: insertError.message };
  }

  // Post-trade bookkeeping per affected symbol — mirror recordTransaction.
  const symbols = [...new Set(clean.map((t) => t.symbol))];
  await Promise.all([
    supabase
      .from("portfolio_position_overrides")
      .delete()
      .eq("user_id", user.id)
      .in("symbol", symbols),
    supabase
      .from("portfolio_hidden_positions")
      .delete()
      .eq("user_id", user.id)
      .in("symbol", symbols),
  ]);

  // Re-aggregate the post-insert ledger once, then reconcile the watchlist for
  // every symbol that had a sell in this batch.
  const soldSymbols = [
    ...new Set(clean.filter((t) => t.side === "sell").map((t) => t.symbol)),
  ];
  if (soldSymbols.length > 0) {
    const { data: txAfter } = await supabase
      .from("transactions")
      .select("id, created_at, symbol, side, quantity, price_per_share, category, fees_bdt")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    const ledger = aggregateHoldings((txAfter ?? []) as TransactionRow[]);
    for (const sym of soldSymbols) {
      await syncWatchlistAfterLedgerChange(supabase, user.id, sym, ledger);
    }
  }

  revalidatePath("/portfolio");
  revalidatePath("/record");
  revalidatePath("/trade-history");
  revalidatePath("/long-term");
  revalidatePath("/allocation");

  const buys = clean.filter((t) => t.side === "buy").length;
  const sells = clean.length - buys;
  const parts = [];
  if (buys) parts.push(`${buys} buy${buys > 1 ? "s" : ""}`);
  if (sells) parts.push(`${sells} sell${sells > 1 ? "s" : ""}`);
  return { ok: true, summary: `Imported ${parts.join(" and ")}.` };
}
