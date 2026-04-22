"use server";

import { createClient } from "@/lib/supabase/server";

export type UserSettings = {
  id: string;
  user_id: string;
  portfolio_report_email: string;
  full_name: string | null;
  trade_commission_rate: number | null;
  currency: string;
  updated_at: string;
};

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
    .select("id, user_id, portfolio_report_email, full_name, trade_commission_rate, currency, updated_at")
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
      .select("id, user_id, portfolio_report_email, full_name, trade_commission_rate, currency, updated_at")
      .single();

    if (createError) return { ok: false, error: createError.message };
    return { ok: true, settings: created as UserSettings };
  }

  return { ok: true, settings: data as UserSettings };
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
