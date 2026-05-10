"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchUserHoldings } from "@/lib/holdings";
import { fetchDseCompanyExtrasMap } from "@/lib/market/dse-company-52w";
import {
  normalizeSectorLabel,
  sectorMatchKey,
  validateSectorTargets,
  type SectorTargetRow,
} from "@/lib/sector-targets";
import { revalidatePath } from "next/cache";

export type SectorTargetWithCurrent = {
  sector: string;
  target_percent: number | null;
  /** Live cost-basis share of the portfolio for this sector, 0–100. */
  current_percent: number;
  /** Whether this sector currently has any open holdings. */
  has_position: boolean;
};

export type SectorTargetsState = {
  rows: SectorTargetWithCurrent[];
  totalInvestedBdt: number;
};

async function fetchSectorTargetRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ rows: SectorTargetRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("sector_target_allocations")
    .select("sector, target_percent")
    .eq("user_id", userId);

  if (error) return { rows: [], error: error.message };

  const rows: SectorTargetRow[] = (data ?? []).map((r) => ({
    sector: normalizeSectorLabel(String((r as { sector: unknown }).sector ?? "")),
    target_percent: Number((r as { target_percent: unknown }).target_percent ?? 0),
  }));
  return { rows, error: null };
}

/**
 * Returns one row per (target sector ∪ sector currently held), ordered by
 * `current_percent` desc and then by sector name. Sectors without a saved
 * target appear with `target_percent = null` so the settings UI can show an
 * empty input and the allocation page can render "—".
 */
export async function getSectorTargets(): Promise<
  | { ok: true; data: SectorTargetsState }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const [holdingsRes, targetsRes] = await Promise.all([
    fetchUserHoldings(),
    fetchSectorTargetRows(supabase, user.id),
  ]);

  if (holdingsRes.error) return { ok: false, error: holdingsRes.error };
  if (targetsRes.error) return { ok: false, error: targetsRes.error };

  const sectorBySymbol = await fetchDseCompanyExtrasMap(
    holdingsRes.holdings.map((h) => h.symbol),
  );

  const investedBySector = new Map<string, { label: string; invested: number }>();
  let total = 0;
  for (const h of holdingsRes.holdings) {
    const cost = Number(h.totalCost);
    if (!Number.isFinite(cost) || cost <= 0) continue;

    const sectorLabel = normalizeSectorLabel(
      sectorBySymbol.get(h.symbol)?.sector ?? h.category ?? null,
    );
    const key = sectorMatchKey(sectorLabel);

    const entry = investedBySector.get(key) ?? { label: sectorLabel, invested: 0 };
    entry.invested += cost;
    investedBySector.set(key, entry);
    total += cost;
  }

  // Merge target rows by case-insensitive key. Saved labels win the casing
  // contest if they differ from the discovered sector label.
  const targetByKey = new Map<string, SectorTargetRow>();
  for (const t of targetsRes.rows) targetByKey.set(sectorMatchKey(t.sector), t);

  const allKeys = new Set<string>();
  for (const k of investedBySector.keys()) allKeys.add(k);
  for (const k of targetByKey.keys()) allKeys.add(k);

  const rows: SectorTargetWithCurrent[] = [];
  for (const key of allKeys) {
    const invested = investedBySector.get(key);
    const target = targetByKey.get(key);
    const sectorLabel = target?.sector ?? invested?.label ?? "Unknown";
    const current_percent =
      invested && total > 0 ? (invested.invested / total) * 100 : 0;
    rows.push({
      sector: sectorLabel,
      target_percent: target ? target.target_percent : null,
      current_percent: Math.round(current_percent * 100) / 100,
      has_position: !!invested,
    });
  }

  rows.sort((a, b) => {
    if (b.current_percent !== a.current_percent) {
      return b.current_percent - a.current_percent;
    }
    return a.sector.localeCompare(b.sector);
  });

  return {
    ok: true,
    data: {
      rows,
      totalInvestedBdt: Math.round(total * 100) / 100,
    },
  };
}

/**
 * Replace the user's full set of sector targets. Sectors omitted from
 * `payload` are deleted; sectors present are upserted. Validates each row,
 * deduplicates by case-insensitive key, and round-trips the per-user table.
 */
export async function saveSectorTargets(
  payload: ReadonlyArray<{ sector: string; target_percent: unknown }>,
): Promise<{ ok: true; sumPercent: number } | { ok: false; error: string }> {
  const validated = validateSectorTargets(payload);
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
      target_percent: r.target_percent,
      updated_at,
    }));
    const { error: upErr } = await supabase
      .from("sector_target_allocations")
      .upsert(upsertRows, { onConflict: "user_id,sector" });
    if (upErr) return { ok: false, error: upErr.message };
  }

  // Delete anything not in the payload (case-insensitive).
  const { data: existing, error: fetchErr } = await supabase
    .from("sector_target_allocations")
    .select("sector")
    .eq("user_id", user.id);
  if (fetchErr) return { ok: false, error: fetchErr.message };

  const keepKeys = new Set(validated.rows.map((r) => sectorMatchKey(r.sector)));
  const toDelete = (existing ?? [])
    .map((r) => String((r as { sector: unknown }).sector ?? ""))
    .filter((s) => !keepKeys.has(sectorMatchKey(s)));

  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("sector_target_allocations")
      .delete()
      .eq("user_id", user.id)
      .in("sector", toDelete);
    if (delErr) return { ok: false, error: delErr.message };
  }

  revalidatePath("/allocation");
  revalidatePath("/settings");
  return { ok: true, sumPercent: validated.sumPercent };
}
