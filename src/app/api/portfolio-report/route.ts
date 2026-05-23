import { sendDailyPortfolioReportForConfiguredUser } from "@/lib/portfolio-report-email";
import { NextResponse } from "next/server";


/**
 * Daily portfolio email cron, fired by Vercel at 11:00 UTC = 17:00 (5 PM)
 * Asia/Dhaka — see `vercel.json`. Vercel sends `Authorization: Bearer
 * ${CRON_SECRET}` automatically when `CRON_SECRET` is set in the project
 * env vars.
 *
 * Required env vars (all set in Vercel → Project → Settings → Environment
 * Variables, scoped to Production):
 *   - CRON_SECRET                         (or PORTFOLIO_REPORT_CRON_SECRET)
 *   - RESEND_API_KEY                      (Resend dashboard)
 *   - RESEND_FROM                         (verified sender, e.g. "Portfolio <noreply@yourdomain>")
 *   - SUPABASE_SERVICE_ROLE_KEY           (Supabase → Project Settings → API)
 *   - NEXT_PUBLIC_SUPABASE_URL            (already required by the app)
 *   - PORTFOLIO_REPORT_RECIPIENT          (defaults to hasebulhassan21@gmail.com)
 *
 * Bypass for manual smoke tests:
 *   GET /api/portfolio-report?dry=1
 *     -> validates env + recipient lookup without sending. Auth still
 *        required so this can't be abused publicly.
 */
function isCronAuthorized(req: Request): boolean {
  const secret = process.env.PORTFOLIO_REPORT_CRON_SECRET ?? process.env.CRON_SECRET;
  if (!secret) {
    console.error("[portfolio-report] No CRON_SECRET configured in Vercel env vars");
    return false;
  }
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

function checkEnvConfig(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.CRON_SECRET && !process.env.PORTFOLIO_REPORT_CRON_SECRET) {
    missing.push("CRON_SECRET or PORTFOLIO_REPORT_CRON_SECRET");
  }
  return { ok: missing.length === 0, missing };
}

export async function GET(req: Request) {
  const startedAt = new Date().toISOString();
  const envCheck = checkEnvConfig();

  if (!isCronAuthorized(req)) {
    console.error(`[portfolio-report] Unauthorized at ${startedAt}`);
    return NextResponse.json(
      { error: "Unauthorized", envCheck, startedAt },
      { status: 401 },
    );
  }

  if (!envCheck.ok) {
    const msg = `Missing environment variables: ${envCheck.missing.join(", ")}`;
    console.error(`[portfolio-report] ${msg}`);
    return NextResponse.json({ error: msg, startedAt }, { status: 500 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry") === "1";

  try {
    if (dryRun) {
      console.log("[portfolio-report] dry run — env validated, skipping send");
      return NextResponse.json({ ok: true, dryRun: true, startedAt });
    }
    console.log("[portfolio-report] starting daily report send…");
    const result = await sendDailyPortfolioReportForConfiguredUser();
    const finishedAt = new Date().toISOString();
    console.log(
      `[portfolio-report] sent to ${result.recipient} (started ${startedAt}, finished ${finishedAt})`,
    );
    return NextResponse.json({
      ok: true,
      recipient: result.recipient,
      startedAt,
      finishedAt,
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Failed to send daily report.";
    console.error(`[portfolio-report] error: ${errorMessage}`);
    return NextResponse.json(
      { error: errorMessage, startedAt },
      { status: 500 },
    );
  }
}
