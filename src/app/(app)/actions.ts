"use server";

import { createClient } from "@/lib/supabase/server";
import {
  computeTransactionFeesBdt,
  parseFeeFlagsFromFormData,
} from "@/lib/fees/bd-charges";
import { type TransactionRow, sharesAvailableForSymbol } from "@/lib/portfolio";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export type RecordState = { error?: string; ok?: boolean };

export async function recordTransaction(
  _prev: RecordState,
  formData: FormData,
): Promise<RecordState> {
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  const side = String(formData.get("side") ?? "").toLowerCase();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const priceRaw = String(formData.get("price_per_share") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "").trim();

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
    const available = sharesAvailableForSymbol(txs, symbol);
    if (quantity > available) {
      return {
        error: `Cannot sell ${quantity} shares of ${symbol}; you only hold ${available}.`,
      };
    }
  }

  const feeFlags = parseFeeFlagsFromFormData(formData);
  const feesBdt = computeTransactionFeesBdt(side, quantity, pricePerShare, feeFlags);

  const { error: insertError } = await supabase.from("transactions").insert({
    user_id: user.id,
    symbol,
    side,
    quantity,
    price_per_share: pricePerShare,
    category: categoryRaw || null,
    fees_bdt: feesBdt,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  revalidatePath("/portfolio");
  revalidatePath("/record");
  return { ok: true };
}
