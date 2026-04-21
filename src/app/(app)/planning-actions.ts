"use server";

import { createClient } from "@/lib/supabase/server";
import {
  calculatedAllocationBdt,
  carryForwardBdtFromPrevious,
  effectiveMonthlyTotalBdt,
  isTodayDhakaInSubmissionWindowForYm,
  prevYearMonth,
  sumLockedPercentages,
} from "@/lib/mip-monthly";
import { fetchDseLspQuoteMapFresh } from "@/lib/market/dse-lsp-quotes";
import { zoneLevelsFromLspQuote } from "@/lib/market/dse-zone-levels";
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

export async function addLongTermHolding(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const symbol = normalizeSymbol(String(formData.get("symbol") ?? ""));

  if (!symbol) return { ok: false, error: "Enter a symbol." };

  const { data: dup } = await supabase
    .from("long_term_holdings")
    .select("id")
    .eq("user_id", user.id)
    .ilike("symbol", symbol)
    .limit(1)
    .maybeSingle();

  if (dup) {
    return { ok: false, error: `${symbol} is already in your watchlist.` };
  }

  const lsp = await fetchDseLspQuoteMapFresh();
  const quote = lsp.bySymbol.get(symbol);
  if (!quote) {
    const hint = lsp.error
      ? ` DSE price table: ${lsp.error}`
      : " No row for this code in today’s DSE latest-price table.";
    return {
      ok: false,
      error: `Could not load live session high/low/close for ${symbol}.${hint}`,
    };
  }

  const zones = zoneLevelsFromLspQuote(quote);
  if (!zones) {
    return { ok: false, error: `Could not compute zones for ${symbol} (invalid high/low/close).` };
  }

  const { error } = await supabase.from("long_term_holdings").insert({
    user_id: user.id,
    symbol,
    notes: null,
    buy_point_bdt: zones.firstBuyZone,
    sell_point_bdt: zones.sellZoneBlend,
  });

  if (error) {
    console.error("addLongTermHolding", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/long-term");
  return { ok: true };
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

export type LongTermRowSavePayload = {
  id: string;
  /** Used to refresh DSE zone columns from the same LSP snapshot as the portfolio page. */
  symbol: string;
  manual_avg_cost_bdt: number | null;
  manual_total_invested_bdt: number | null;
};

function sanitizeLongTermNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Persist all long-term rows in one action (used by table-level Save). */
export async function saveLongTermTable(
  updates: LongTermRowSavePayload[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  if (!Array.isArray(updates) || updates.length === 0) {
    return { ok: true };
  }

  const lsp = await fetchDseLspQuoteMapFresh();

  for (const u of updates) {
    const id = String(u.id ?? "").trim();
    if (!id) continue;

    const sym = normalizeSymbol(String(u.symbol ?? ""));
    const manual_avg_cost_bdt = sanitizeLongTermNumber(u.manual_avg_cost_bdt);
    const manual_total_invested_bdt = sanitizeLongTermNumber(u.manual_total_invested_bdt);

    const quote = sym ? lsp.bySymbol.get(sym) : undefined;
    const zones = quote ? zoneLevelsFromLspQuote(quote) : null;

    const patch: Record<string, unknown> = {
      manual_avg_cost_bdt,
      manual_total_invested_bdt,
    };
    if (zones) {
      patch.buy_point_bdt = zones.firstBuyZone;
      patch.sell_point_bdt = zones.sellZoneBlend;
    }

    const { error } = await supabase
      .from("long_term_holdings")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("saveLongTermTable", error.message);
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/long-term");
  return { ok: true };
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Single nullable field: BLUE, GREEN, or unclassified (null). */
export async function setWatchlistClassification(
  rowId: string,
  classification: "BLUE" | "GREEN" | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID_RE.test(rowId)) return { ok: false, error: "Invalid row." };
  if (classification !== null && classification !== "BLUE" && classification !== "GREEN") {
    return { ok: false, error: "Invalid classification." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("long_term_holdings")
    .update({ classification })
    .eq("id", rowId)
    .eq("user_id", user.id);

  if (error) {
    console.error("setWatchlistClassification", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/long-term");
  return { ok: true };
}

function parseYmdDhakaCalendar(dateStr: string): { ym: string; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr ?? "").trim());
  if (!m) return null;
  const ym = `${m[1]}-${m[2]}`;
  const day = Number(m[3]);
  if (!Number.isFinite(day)) return null;
  return { ym, day };
}

function sanitizePositiveAmount(raw: string): number | null {
  const n = Number(String(raw ?? "").trim().replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/** One-time monthly setup (date + base amount), days 5–25 Dhaka, same calendar month only. */
export async function submitMipMonthlySetup(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const dateStr = String(formData.get("plan_date") ?? "").trim();
  const parsed = parseYmdDhakaCalendar(dateStr);
  if (!parsed) return { ok: false, error: "Use a valid plan date (YYYY-MM-DD)." };

  const { ym, day } = parsed;
  if (day < 5 || day > 25) {
    return { ok: false, error: "Plan date must fall between the 5th and 25th of the month." };
  }

  if (!isTodayDhakaInSubmissionWindowForYm(ym)) {
    return {
      ok: false,
      error:
        "You can submit only once per month, between the 5th and 25th (Asia/Dhaka), for the current month.",
    };
  }

  const base = sanitizePositiveAmount(String(formData.get("base_amount_bdt") ?? ""));
  if (base === null) return { ok: false, error: "Enter a positive total monthly investment amount." };

  const { data: existing } = await supabase
    .from("mip_monthly_headers")
    .select("id")
    .eq("user_id", user.id)
    .eq("year_month", ym)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: `An MIP for ${ym} already exists.` };
  }

  const prevYm = prevYearMonth(ym);
  let carried = 0;
  if (prevYm) {
    const { data: prevHeader } = await supabase
      .from("mip_monthly_headers")
      .select("id, base_amount_bdt, carried_forward_bdt")
      .eq("user_id", user.id)
      .eq("year_month", prevYm)
      .maybeSingle();

    if (prevHeader) {
      const { data: prevRows } = await supabase
        .from("mip_monthly_rows")
        .select("locked, percentage")
        .eq("header_id", prevHeader.id);

      const lockedRows = (prevRows ?? []).filter((r) => r.locked);
      carried = carryForwardBdtFromPrevious(
        {
          base_amount_bdt: Number(prevHeader.base_amount_bdt),
          carried_forward_bdt: Number(prevHeader.carried_forward_bdt),
        },
        lockedRows,
      );
    }
  }

  const { data: inserted, error: insErr } = await supabase
    .from("mip_monthly_headers")
    .insert({
      user_id: user.id,
      year_month: ym,
      plan_date: dateStr,
      base_amount_bdt: base,
      carried_forward_bdt: carried,
      locked_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    if (/duplicate key|unique constraint/i.test(insErr?.message ?? "")) {
      return { ok: false, error: `An MIP for ${ym} already exists.` };
    }
    return { ok: false, error: insErr?.message ?? "Could not create MIP." };
  }

  const { error: rowErr } = await supabase.from("mip_monthly_rows").insert({
    header_id: inserted.id,
    sort_order: 0,
    symbol: null,
    percentage: null,
    calculated_amount_bdt: null,
    locked: false,
  });

  if (rowErr) {
    await supabase.from("mip_monthly_headers").delete().eq("id", inserted.id);
    return { ok: false, error: rowErr.message };
  }

  revalidatePath("/mip");
  return { ok: true };
}

export async function addMipMonthlyRow(
  headerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID_RE.test(headerId)) return { ok: false, error: "Invalid header." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: header } = await supabase
    .from("mip_monthly_headers")
    .select("id")
    .eq("id", headerId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!header) return { ok: false, error: "Plan not found." };

  const { data: orders, error: cErr } = await supabase
    .from("mip_monthly_rows")
    .select("sort_order")
    .eq("header_id", headerId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (cErr) return { ok: false, error: cErr.message };
  const nextOrder = ((orders?.[0]?.sort_order as number | undefined) ?? -1) + 1;
  if (nextOrder >= 6) return { ok: false, error: "Maximum 6 rows allowed." };

  const { error } = await supabase.from("mip_monthly_rows").insert({
    header_id: headerId,
    sort_order: nextOrder,
    symbol: null,
    percentage: null,
    calculated_amount_bdt: null,
    locked: false,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/mip");
  return { ok: true };
}

export async function lockMipMonthlyRow(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const rowId = String(formData.get("row_id") ?? "").trim();
  if (!UUID_RE.test(rowId)) return { ok: false, error: "Invalid row." };

  const symbol = normalizeSymbol(String(formData.get("symbol") ?? ""));
  if (!symbol) return { ok: false, error: "Select or enter a DSE stock name." };

  const pctRaw = String(formData.get("percentage") ?? "").trim().replace(/,/g, "");
  const pct = Number(pctRaw);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
    return { ok: false, error: "Percentage must be between 0 and 100." };
  }

  const { data: row, error: rErr } = await supabase
    .from("mip_monthly_rows")
    .select("id, header_id, locked, symbol, percentage")
    .eq("id", rowId)
    .maybeSingle();

  if (rErr || !row) return { ok: false, error: "Row not found." };
  if (row.locked) return { ok: false, error: "This row is already locked." };

  const { data: header, error: hErr } = await supabase
    .from("mip_monthly_headers")
    .select("id, user_id, base_amount_bdt, carried_forward_bdt")
    .eq("id", row.header_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (hErr || !header) return { ok: false, error: "Plan not found." };

  const { data: allRows, error: aErr } = await supabase
    .from("mip_monthly_rows")
    .select("id, locked, percentage, symbol")
    .eq("header_id", header.id);

  if (aErr) return { ok: false, error: aErr.message };

  const others = (allRows ?? []).filter((r) => r.id !== rowId);
  for (const o of others) {
    if (o.symbol && String(o.symbol).trim().toUpperCase() === symbol) {
      return { ok: false, error: `${symbol} is already used in this table.` };
    }
  }

  const lockedRows = (allRows ?? []).filter((r) => r.id !== rowId && r.locked);
  const currentSum = sumLockedPercentages(lockedRows);
  const roundedSum = Math.round((currentSum + pct) * 10000) / 10000;
  if (roundedSum > 100.0001) {
    return { ok: false, error: "Total locked percentage cannot exceed 100%." };
  }

  const effective = effectiveMonthlyTotalBdt({
    base_amount_bdt: Number(header.base_amount_bdt),
    carried_forward_bdt: Number(header.carried_forward_bdt),
  });
  const calculated = calculatedAllocationBdt(pct, effective);

  const { error: uErr } = await supabase
    .from("mip_monthly_rows")
    .update({
      symbol,
      percentage: pct,
      calculated_amount_bdt: calculated,
      locked: true,
    })
    .eq("id", rowId)
    .eq("header_id", header.id)
    .eq("locked", false);

  if (uErr) return { ok: false, error: uErr.message };

  revalidatePath("/mip");
  return { ok: true };
}
