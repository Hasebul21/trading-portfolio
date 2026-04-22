import { sendMonthlyPortfolioReportForConfiguredUser } from "@/lib/portfolio-report-email";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function nowInDhakaParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const val = (type: "year" | "month" | "day") => Number(parts.find((p) => p.type === type)?.value);
  return { year: val("year"), month: val("month"), day: val("day") };
}

function daysInDhakaMonth(year: number, month1to12: number): number {
  // UTC day 0 of next month == last day of current month
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function isLastDayInDhaka(): boolean {
  const { year, month, day } = nowInDhakaParts();
  return day === daysInDhakaMonth(year, month);
}

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

  if (!isLastDayInDhaka()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Not last day in Asia/Dhaka" });
  }

  try {
    await sendMonthlyPortfolioReportForConfiguredUser();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to send monthly report." },
      { status: 500 },
    );
  }
}
