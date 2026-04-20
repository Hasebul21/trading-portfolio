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

  const buyRaw = String(formData.get("buy_point_bdt") ?? "").trim();
  const sellRaw = String(formData.get("sell_point_bdt") ?? "").trim();
  const buyPoint =
    buyRaw === "" ? null : Number(buyRaw);
  const sellPoint =
    sellRaw === "" ? null : Number(sellRaw);
  const buy_point_bdt =
    buyPoint !== null && Number.isFinite(buyPoint) && buyPoint >= 0 ? buyPoint : null;
  const sell_point_bdt =
    sellPoint !== null && Number.isFinite(sellPoint) && sellPoint >= 0 ? sellPoint : null;

  await supabase.from("long_term_holdings").insert({
    user_id: user.id,
    symbol,
    notes: null,
    buy_point_bdt,
    sell_point_bdt,
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

const LONG_TERM_EDITABLE_FIELDS = new Set([
  "buy_point_bdt",
  "sell_point_bdt",
  "manual_avg_cost_bdt",
  "manual_total_invested_bdt",
]);

function parseLongTermNumericField(raw: string): number | null {
  const s = raw.trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Update one numeric column on a watchlist row (blur-save from the table). */
export async function updateLongTermField(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "").trim();
  const field = String(formData.get("field") ?? "").trim();
  if (!id) return;
  if (!LONG_TERM_EDITABLE_FIELDS.has(field)) return;

  const value = parseLongTermNumericField(String(formData.get("value") ?? ""));

  const patch: Record<string, number | null> = { [field]: value };

  const { error } = await supabase
    .from("long_term_holdings")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("updateLongTermField", error.message);
    return;
  }

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
