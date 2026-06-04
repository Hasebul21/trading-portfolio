"use server";

import { createClient } from "@/lib/supabase/server";
import {
  normalizeSectorLabel,
  sectorMatchKey,
} from "@/lib/sector-targets";
import {
  validateSectorInvestments,
  type SectorInvestmentRow,
} from "@/lib/sector-investments";
import { revalidatePath } from "next/cache";

export type SectorInvestmentsState = {
  rows: SectorInvestmentRow[];
  totalBdt: number;
};

/**
 * Returns the user's saved per-sector monthly investment amounts, ordered by
 * amount desc then sector name, plus the monthly total. Empty when the user
 * has not set any yet.
 */
export async function getSectorMonthlyInvestments(): Promise<
  | { ok: true; data: SectorInvestmentsState }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase
    .from("sector_monthly_investments")
    .select("sector, amount_bdt")
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  const rows: SectorInvestmentRow[] = (data ?? []).map((r) => ({
    sector: normalizeSectorLabel(String((r as { sector: unknown }).sector ?? "")),
    amount_bdt: Number((r as { amount_bdt: unknown }).amount_bdt ?? 0),
  }));

  rows.sort((a, b) => {
    if (b.amount_bdt !== a.amount_bdt) return b.amount_bdt - a.amount_bdt;
    return a.sector.localeCompare(b.sector);
  });

  const totalBdt =
    Math.round(rows.reduce((s, r) => s + r.amount_bdt, 0) * 100) / 100;

  return { ok: true, data: { rows, totalBdt } };
}

/**
 * Replace the user's full set of monthly investment amounts. Sectors omitted
 * from `payload` are deleted; sectors present are upserted. Validates each
 * row and deduplicates by case-insensitive key.
 */
export async function saveSectorMonthlyInvestments(
  payload: ReadonlyArray<{ sector: string; amount_bdt: unknown }>,
): Promise<{ ok: true; totalBdt: number } | { ok: false; error: string }> {
  const validated = validateSectorInvestments(payload);
  if (!validated.ok) return validated;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Upsert what we have.
  if (validated.rows.length > 0) {
    const updated_at = new Date().toISOString();
    const upsertRows = validated.rows.map((r) => ({
      user_id: user.id,
      sector: r.sector,
      amount_bdt: r.amount_bdt,
      updated_at,
    }));
    const { error: upErr } = await supabase
      .from("sector_monthly_investments")
      .upsert(upsertRows, { onConflict: "user_id,sector" });
    if (upErr) return { ok: false, error: upErr.message };
  }

  // Delete anything not in the payload (case-insensitive).
  const { data: existing, error: fetchErr } = await supabase
    .from("sector_monthly_investments")
    .select("sector")
    .eq("user_id", user.id);
  if (fetchErr) return { ok: false, error: fetchErr.message };

  const keepKeys = new Set(validated.rows.map((r) => sectorMatchKey(r.sector)));
  const toDelete = (existing ?? [])
    .map((r) => String((r as { sector: unknown }).sector ?? ""))
    .filter((s) => !keepKeys.has(sectorMatchKey(s)));

  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("sector_monthly_investments")
      .delete()
      .eq("user_id", user.id)
      .in("sector", toDelete);
    if (delErr) return { ok: false, error: delErr.message };
  }

  revalidatePath("/settings");
  return { ok: true, totalBdt: validated.totalBdt };
}
