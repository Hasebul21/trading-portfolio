"use server";

import { createClient } from "@/lib/supabase/server";

export type UserSettings = {
  id: string;
  user_id: string;
  portfolio_report_email: string;
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
    .select("id, user_id, portfolio_report_email, updated_at")
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
      })
      .select("id, user_id, portfolio_report_email, updated_at")
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
