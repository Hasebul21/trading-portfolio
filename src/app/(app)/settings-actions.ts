"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CashAdjustmentRow = {
  id: string;
  amount_bdt: number;
  note: string | null;
  occurred_on: string;
  created_at: string;
};

export type UserSettings = {
  id: string;
  user_id: string;
  portfolio_report_email: string;
  full_name: string | null;
  trade_commission_rate: number | null;
  currency: string;
  top_sectors: string[];
  updated_at: string;
};

const TOP_SECTORS_MAX = 8;
const TOP_SECTOR_LABEL_MAX = 60;

function sanitizeTopSectors(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const label = item.trim().replace(/\s+/g, " ").slice(0, TOP_SECTOR_LABEL_MAX);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= TOP_SECTORS_MAX) break;
  }
  return out;
}

export async function getUserSettings(): Promise<{
  ok: true;
  settings: UserSettings;
} | {
  ok: false;
  error: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data, error } = await supabase
    .from("user_settings")
    .select("id, user_id, portfolio_report_email, full_name, trade_commission_rate, currency, top_sectors, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };

  if (!data) {
    // Create default settings for new user
    const { data: created, error: createError } = await supabase
      .from("user_settings")
      .insert({
        user_id: user.id,
        portfolio_report_email: "hasebulhassan21@gmail.com",
        currency: "BDT",
      })
      .select("id, user_id, portfolio_report_email, full_name, trade_commission_rate, currency, top_sectors, updated_at")
      .single();

    if (createError) return { ok: false, error: createError.message };
    const c = created as Record<string, unknown>;
    return {
      ok: true,
      settings: { ...(created as UserSettings), top_sectors: sanitizeTopSectors(c.top_sectors) },
    };
  }

  const d = data as Record<string, unknown>;
  return {
    ok: true,
    settings: { ...(data as UserSettings), top_sectors: sanitizeTopSectors(d.top_sectors) },
  };
}

export async function updateTopSectors(
  sectors: ReadonlyArray<string>,
): Promise<{ ok: true; top_sectors: string[] } | { ok: false; error: string }> {
  const clean = sanitizeTopSectors(sectors);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("user_settings")
    .update({ top_sectors: clean, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/portfolio");
  revalidatePath("/record");
  revalidatePath("/long-term");
  revalidatePath("/allocation");
  revalidatePath("/trade-history");
  revalidatePath("/settings");
  return { ok: true, top_sectors: clean };
}

export async function updatePortfolioReportEmail(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = email.trim().toLowerCase();

  // Basic email validation
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("user_settings")
    .update({ portfolio_report_email: trimmed, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateUserProfile(
  fullName: string,
  commissionRate: string | null,
  currency: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmedName = fullName.trim();
  const rate = commissionRate ? Number(commissionRate) : null;

  if (trimmedName === "") {
    return { ok: false, error: "Full name cannot be empty." };
  }

  if (rate !== null && (typeof rate !== "number" || rate < 0 || rate > 1 || !Number.isFinite(rate))) {
    return { ok: false, error: "Commission rate must be between 0 and 1." };
  }

  if (!currency || currency.trim() === "") {
    return { ok: false, error: "Currency cannot be empty." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("user_settings")
    .update({
      full_name: trimmedName,
      trade_commission_rate: rate,
      currency: currency.trim().toUpperCase(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateUserPassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!currentPassword || !newPassword) {
    return { ok: false, error: "Both current and new passwords are required." };
  }

  if (newPassword.length < 6) {
    return { ok: false, error: "New password must be at least 6 characters long." };
  }

  if (currentPassword === newPassword) {
    return { ok: false, error: "New password must be different from current password." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // Update password via Supabase Auth
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateUserEmail(
  newEmail: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = newEmail.trim().toLowerCase();

  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  if (trimmed === user.email) {
    return { ok: false, error: "New email must be different from current email." };
  }

  // Update email via Supabase Auth
  const { error } = await supabase.auth.updateUser({
    email: trimmed,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cash adjustments — manual amounts that flow into Net Gain/Loss.
// ---------------------------------------------------------------------------

function parseAmount(raw: string | number): number | null {
  const n = typeof raw === "number" ? raw : Number(String(raw).trim().replace(/,/g, ""));
  if (!Number.isFinite(n) || n === 0) return null;
  return Math.round(n * 100) / 100;
}

export async function listCashAdjustments(): Promise<
  { ok: true; rows: CashAdjustmentRow[]; total: number } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data, error } = await supabase
    .from("cash_adjustments")
    .select("id, amount_bdt, note, occurred_on, created_at")
    .eq("user_id", user.id)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []).map((r) => ({
    id: String(r.id),
    amount_bdt: typeof r.amount_bdt === "number" ? r.amount_bdt : Number(r.amount_bdt ?? 0),
    note: r.note ?? null,
    occurred_on: String(r.occurred_on),
    created_at: String(r.created_at),
  })) as CashAdjustmentRow[];

  let total = 0;
  for (const r of rows) if (Number.isFinite(r.amount_bdt)) total += r.amount_bdt;
  total = Math.round(total * 100) / 100;

  return { ok: true, rows, total };
}

export async function createCashAdjustment(input: {
  amount: string | number;
  kind: "add" | "deduct";
  note?: string | null;
  occurredOn?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const magnitude = parseAmount(input.amount);
  if (magnitude === null || magnitude < 0) {
    return { ok: false, error: "Enter a positive amount." };
  }
  const signed = input.kind === "deduct" ? -Math.abs(magnitude) : Math.abs(magnitude);

  const trimmedNote = (input.note ?? "").trim();
  const occurred = (input.occurredOn ?? "").trim();
  const occurredOn = occurred && /^\d{4}-\d{2}-\d{2}$/.test(occurred) ? occurred : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const payload: Record<string, unknown> = {
    user_id: user.id,
    amount_bdt: signed,
    note: trimmedNote === "" ? null : trimmedNote,
  };
  if (occurredOn) payload.occurred_on = occurredOn;

  const { error } = await supabase.from("cash_adjustments").insert(payload);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/portfolio");
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteCashAdjustment(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = id.trim();
  if (!trimmed) return { ok: false, error: "Missing id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("cash_adjustments")
    .delete()
    .eq("id", trimmed)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/portfolio");
  revalidatePath("/settings");
  return { ok: true };
}
