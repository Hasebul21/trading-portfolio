"use server";

import { sendPortfolioReportEmail, buildReportForUser } from "@/lib/portfolio-report-email";
import { createClient } from "@/lib/supabase/server";

export async function sendPortfolioEmailWithUserSettings(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  try {
    // Get user's configured email from settings
    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("portfolio_report_email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (settingsError) return { ok: false, error: settingsError.message };

    const reportEmail = settings?.portfolio_report_email || "hasebulhassan21@gmail.com";

    // Build portfolio report
    const payload = await buildReportForUser(supabase, user.id);

    // Send report with configured email
    await sendPortfolioReportEmail(payload, "manual", reportEmail);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not send portfolio email" };
  }
}
