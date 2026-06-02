"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type DividendRow = {
  id: string;
  symbol: string;
  cash_dividend_bdt: number;
  stock_dividend_shares: number;
  bonus_tx_id: string | null;
  note: string | null;
  occurred_on: string;
  created_at: string;
};

function num(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Round to paisa for cash, 4dp for shares. */
function roundCash(n: number): number {
  return Math.round(n * 100) / 100;
}
function roundShares(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export async function listDividends(): Promise<
  | { ok: true; rows: DividendRow[]; totalCash: number; totalStockShares: number }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data, error } = await supabase
    .from("dividends")
    .select("id, symbol, cash_dividend_bdt, stock_dividend_shares, bonus_tx_id, note, occurred_on, created_at")
    .eq("user_id", user.id)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []).map((r) => ({
    id: String(r.id),
    symbol: String(r.symbol),
    cash_dividend_bdt: num(r.cash_dividend_bdt),
    stock_dividend_shares: num(r.stock_dividend_shares),
    bonus_tx_id: r.bonus_tx_id ? String(r.bonus_tx_id) : null,
    note: r.note ?? null,
    occurred_on: String(r.occurred_on),
    created_at: String(r.created_at),
  })) as DividendRow[];

  let totalCash = 0;
  let totalStockShares = 0;
  for (const r of rows) {
    totalCash += r.cash_dividend_bdt;
    totalStockShares += r.stock_dividend_shares;
  }

  return {
    ok: true,
    rows,
    totalCash: roundCash(totalCash),
    totalStockShares: roundShares(totalStockShares),
  };
}

export async function createDividend(input: {
  symbol: string;
  cashDividend: string | number;
  stockDividendShares: string | number;
  note?: string | null;
  occurredOn?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const symbol = String(input.symbol ?? "").trim().toUpperCase();
  if (!symbol) return { ok: false, error: "Select a stock." };

  const cash = roundCash(Math.max(0, num(input.cashDividend)));
  const bonusShares = roundShares(Math.max(0, num(input.stockDividendShares)));

  if (cash <= 0 && bonusShares <= 0) {
    return { ok: false, error: "Enter a cash dividend, a stock dividend, or both." };
  }

  const trimmedNote = (input.note ?? "").trim();
  const occurred = (input.occurredOn ?? "").trim();
  const occurredOn = occurred && /^\d{4}-\d{2}-\d{2}$/.test(occurred) ? occurred : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // Stock (bonus) dividend → inject zero-cost shares into the ledger. We carry
  // the holding's existing category forward so sector allocation stays intact.
  let bonusTxId: string | null = null;
  if (bonusShares > 0) {
    const { data: prior } = await supabase
      .from("transactions")
      .select("category")
      .eq("user_id", user.id)
      .ilike("symbol", symbol)
      .not("category", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const category = (prior?.category as string | null) ?? null;

    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        symbol,
        side: "buy",
        quantity: bonusShares,
        price_per_share: 0,
        category,
        fees_bdt: 0,
      })
      .select("id")
      .single();

    if (txError) return { ok: false, error: txError.message };
    bonusTxId = tx ? String(tx.id) : null;
  }

  const { error } = await supabase.from("dividends").insert({
    user_id: user.id,
    symbol,
    cash_dividend_bdt: cash,
    stock_dividend_shares: bonusShares,
    bonus_tx_id: bonusTxId,
    note: trimmedNote === "" ? null : trimmedNote,
    ...(occurredOn ? { occurred_on: occurredOn } : {}),
  });

  if (error) {
    // Roll back the injected bonus shares so a failed dividend insert never
    // leaves an orphan transaction inflating the position.
    if (bonusTxId) {
      await supabase.from("transactions").delete().eq("id", bonusTxId).eq("user_id", user.id);
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/portfolio");
  revalidatePath("/dividend");
  return { ok: true };
}

export async function deleteDividend(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = id.trim();
  if (!trimmed) return { ok: false, error: "Missing id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // Find the linked bonus transaction (if any) before removing the dividend.
  const { data: row, error: readError } = await supabase
    .from("dividends")
    .select("bonus_tx_id")
    .eq("id", trimmed)
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };

  const { error } = await supabase
    .from("dividends")
    .delete()
    .eq("id", trimmed)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  const bonusTxId = row?.bonus_tx_id ? String(row.bonus_tx_id) : null;
  if (bonusTxId) {
    await supabase.from("transactions").delete().eq("id", bonusTxId).eq("user_id", user.id);
  }

  revalidatePath("/portfolio");
  revalidatePath("/dividend");
  return { ok: true };
}
