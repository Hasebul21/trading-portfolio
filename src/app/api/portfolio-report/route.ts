import { sendMonthlyPortfolioReportForConfiguredUser } from "@/lib/portfolio-report-email";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isCronAuthorized(req: Request): boolean {
  const secret = process.env.PORTFOLIO_REPORT_CRON_SECRET ?? process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await sendMonthlyPortfolioReportForConfiguredUser();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to send daily report." },
      { status: 500 },
    );
  }
}
