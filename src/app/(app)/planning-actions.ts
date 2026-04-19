"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase();
}

export async function addCapitalContribution(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const amount = Number(String(formData.get("amount_bdt") ?? "").trim());
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!Number.isFinite(amount) || amount <= 0) return;

  await supabase.from("capital_contributions").insert({
    user_id: user.id,
    amount_bdt: amount,
    note,
  });

  revalidatePath("/invested");
}

export async function deleteCapitalContribution(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await supabase
    .from("capital_contributions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/invested");
}

export async function addLongTermHolding(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const symbol = normalizeSymbol(String(formData.get("symbol") ?? ""));

  if (!symbol) return;

  await supabase.from("long_term_holdings").insert({
    user_id: user.id,
    symbol,
    notes: null,
  });

  revalidatePath("/long-term");
}

export async function deleteLongTermHolding(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await supabase
    .from("long_term_holdings")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/long-term");
}

export async function addTradePlan(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const symbol = normalizeSymbol(String(formData.get("symbol") ?? ""));
  const side = String(formData.get("side") ?? "").toLowerCase();
  const priceRaw = String(formData.get("target_price") ?? "").trim();
  const targetPrice = Number(priceRaw);

  if (!symbol) return;
  if (side !== "buy" && side !== "sell") return;
  if (!Number.isFinite(targetPrice) || targetPrice < 0) return;

  await supabase.from("immediate_trade_plans").insert({
    user_id: user.id,
    symbol,
    side,
    target_price: targetPrice,
    notes: null,
  });

  revalidatePath("/trade-plans");
}

export async function deleteTradePlan(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await supabase
    .from("immediate_trade_plans")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/trade-plans");
}
