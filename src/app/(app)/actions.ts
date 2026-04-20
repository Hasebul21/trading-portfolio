"use server";

import { createClient } from "@/lib/supabase/server";
import { computeTradeCommissionBdt } from "@/lib/fees/trade-commission";
import {
  aggregateHoldings,
  type TransactionRow,
} from "@/lib/portfolio";
import {
  fetchPositionOverrides,
  mergeLedgerWithOverrides,
  tripletMatchesLedger,
  validateCostTriplet,
} from "@/lib/portfolio-overrides";
import { formatPlainNumberMax2Decimals } from "@/lib/format-bdt";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export type RecordState = { error?: string; ok?: boolean; summary?: string };

export type PortfolioSaveRow = {
  symbol: string;
  shares: number;
  avgPrice: number;
  totalCost: number;
};

export async function recordTransaction(
  _prev: RecordState,
  formData: FormData,
): Promise<RecordState> {
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  const side = String(formData.get("side") ?? "").toLowerCase();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const priceRaw = String(formData.get("price_per_share") ?? "").trim();
  const feesRaw = String(formData.get("fees_bdt") ?? "").trim();
  if (!symbol) {
    return { error: "Symbol is required." };
  }
  if (side !== "buy" && side !== "sell") {
    return { error: "Side must be buy or sell." };
  }

  const quantity = Number(quantityRaw);
  const pricePerShare = Number(priceRaw);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: "Quantity must be a positive number." };
  }
  if (!Number.isFinite(pricePerShare) || pricePerShare < 0) {
    return { error: "Price must be zero or greater." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: rows, error: fetchError } = await supabase
    .from("transactions")
    .select(
      "id, created_at, symbol, side, quantity, price_per_share, category, fees_bdt",
    )
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (fetchError) {
    return { error: fetchError.message };
  }

  const txs = (rows ?? []) as TransactionRow[];

  if (side === "sell") {
    const ledger = aggregateHoldings(txs);
    const { rows: overrides, error: ovErr } = await fetchPositionOverrides(supabase);
    if (ovErr) {
      return { error: ovErr };
    }
    const merged = mergeLedgerWithOverrides(ledger, overrides);
    const holding = merged.find((h) => h.symbol === symbol);
    const available = holding?.shares ?? 0;
    if (quantity > available) {
      return {
        error: `Cannot sell ${quantity} shares of ${symbol}; you only hold ${available}.`,
      };
    }
  }

  let feesBdt: number;
  if (feesRaw === "") {
    feesBdt = computeTradeCommissionBdt(quantity, pricePerShare);
  } else {
    feesBdt = Number(feesRaw);
    if (!Number.isFinite(feesBdt) || feesBdt < 0) {
      return { error: "Commission must be a non-negative number." };
    }
    feesBdt = Math.round(feesBdt * 100) / 100;
  }

  const { error: insertError } = await supabase.from("transactions").insert({
    user_id: user.id,
    symbol,
    side,
    quantity,
    price_per_share: pricePerShare,
    category: null,
    fees_bdt: feesBdt,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  revalidatePath("/portfolio");
  revalidatePath("/record");
  revalidatePath("/trade-history");
  const qtyLabel = quantity % 1 === 0 ? String(quantity) : String(quantity);
  return {
    ok: true,
    summary: `${symbol} · ${side} · ${qtyLabel} sh @ ${formatPlainNumberMax2Decimals(pricePerShare)}`,
  };
}

export async function savePortfolioPositions(
  rows: PortfolioSaveRow[],
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: txRows, error: fetchError } = await supabase
    .from("transactions")
    .select(
      "id, created_at, symbol, side, quantity, price_per_share, category, fees_bdt",
    )
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (fetchError) {
    return { error: fetchError.message };
  }

  const ledger = aggregateHoldings((txRows ?? []) as TransactionRow[]);

  for (const raw of rows) {
    const sym = raw.symbol.trim().toUpperCase();
    if (!sym) continue;
    const tripletErr = validateCostTriplet(raw.shares, raw.avgPrice, raw.totalCost);
    if (tripletErr) {
      return { error: `${sym}: ${tripletErr}` };
    }
  }

  for (const raw of rows) {
    const sym = raw.symbol.trim().toUpperCase();
    const ledgerRow = ledger.find((h) => h.symbol === sym);
    const matches =
      ledgerRow &&
      tripletMatchesLedger(raw.shares, raw.avgPrice, raw.totalCost, ledgerRow);

    if (matches) {
      const { error: delErr } = await supabase
        .from("portfolio_position_overrides")
        .delete()
        .eq("user_id", user.id)
        .eq("symbol", sym);
      if (delErr) {
        return { error: delErr.message };
      }
      continue;
    }

    const { error: upErr } = await supabase.from("portfolio_position_overrides").upsert(
      {
        user_id: user.id,
        symbol: sym,
        shares: raw.shares,
        avg_price_bdt: raw.avgPrice,
        total_cost_bdt: raw.totalCost,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,symbol" },
    );
    if (upErr) {
      return { error: upErr.message };
    }
  }

  revalidatePath("/portfolio");
  return { ok: true };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteTransaction(
  transactionId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const id = String(transactionId ?? "").trim();
  if (!UUID_RE.test(id)) {
    return { error: "Invalid transaction id." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    return { error: error.message };
  }
  if (!data?.length) {
    return { error: "That row was not found or is not yours." };
  }

  revalidatePath("/portfolio");
  revalidatePath("/record");
  revalidatePath("/trade-history");
  return { ok: true };
}
