import { sendMonthlyPortfolioReportForConfiguredUser } from "@/lib/portfolio-report-email";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isCronAuthorized(req: Request): boolean {
  const secret = process.env.PORTFOLIO_REPORT_CRON_SECRET ?? process.env.CRON_SECRET;
  if (!secret) {
    console.error("[portfolio-report] No CRON_SECRET configured");
    return false;
  }
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

function checkEnvConfig(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!process.env.CRON_SECRET && !process.env.PORTFOLIO_REPORT_CRON_SECRET) {
    missing.push("CRON_SECRET or PORTFOLIO_REPORT_CRON_SECRET");
  }
  return { ok: missing.length === 0, missing };
}

export async function GET(req: Request) {
  const envCheck = checkEnvConfig();

  if (!isCronAuthorized(req)) {
    console.error("[portfolio-report] Unauthorized request - check CRON_SECRET");
    return NextResponse.json({ error: "Unauthorized", envCheck }, { status: 401 });
  }

  if (!envCheck.ok) {
    console.error(`[portfolio-report] Missing env vars: ${envCheck.missing.join(", ")}`);
    return NextResponse.json(
      { error: `Missing environment variables: ${envCheck.missing.join(", ")}` },
      { status: 500 },
    );
  }

  try {
    console.log("[portfolio-report] Starting daily report send...");
    await sendMonthlyPortfolioReportForConfiguredUser();
    console.log("[portfolio-report] Daily report sent successfully");
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Failed to send daily report.";
    console.error(`[portfolio-report] Error: ${errorMessage}`);
    return NextResponse.json(
      { error: errorMessage, timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}
