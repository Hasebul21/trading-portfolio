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

function parseLongTermNumericField(raw: string): number | null {
  const s = raw.trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Update all editable numeric fields on one watchlist row from a single form submit. */
export async function updateLongTermRow(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const buy_point_bdt = parseLongTermNumericField(String(formData.get("buy_point_bdt") ?? ""));
  const sell_point_bdt = parseLongTermNumericField(String(formData.get("sell_point_bdt") ?? ""));
  const manual_avg_cost_bdt = parseLongTermNumericField(
    String(formData.get("manual_avg_cost_bdt") ?? ""),
  );
  const manual_total_invested_bdt = parseLongTermNumericField(
    String(formData.get("manual_total_invested_bdt") ?? ""),
  );

  const { error } = await supabase
    .from("long_term_holdings")
    .update({
      buy_point_bdt,
      sell_point_bdt,
      manual_avg_cost_bdt,
      manual_total_invested_bdt,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("updateLongTermRow", error.message);
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
