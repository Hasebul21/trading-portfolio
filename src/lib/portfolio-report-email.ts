import nodemailer from "nodemailer";
import { aggregateHoldings, totalRealizedProfitLossBdt, type TransactionRow } from "@/lib/portfolio";
import { fetchDseLspQuoteMapFresh } from "@/lib/market/dse-lsp-quotes";
import { holdingsToMarketRows } from "@/lib/market/portfolio-with-quotes";
import { mergeLedgerWithOverrides, type PositionOverrideRow } from "@/lib/portfolio-overrides";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

type ReportPayload = {
  rows: ReturnType<typeof holdingsToMarketRows>;
  totalRealizedBdt: number;
};

const DEFAULT_REPORT_EMAIL = "hasebulhassan21@gmail.com";

function reportRecipient(): string {
  return (process.env.PORTFOLIO_REPORT_RECIPIENT ?? DEFAULT_REPORT_EMAIL).trim().toLowerCase();
}

function fmt2(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function csvEscape(s: string): string {
  if (/["\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(payload: ReportPayload): string {
  const lines = [
    [
      "Symbol",
      "Shares",
      "Average Cost (BDT)",
      "Total Invested (BDT)",
      "Last Price (BDT)",
      "Unrealized P/L (BDT)",
    ].join(","),
  ];
  for (const row of payload.rows) {
    lines.push(
      [
        csvEscape(row.symbol),
        fmt2(row.shares),
        fmt2(row.avgPrice),
        fmt2(row.totalCost),
        row.marketLtp === null ? "" : fmt2(row.marketLtp),
        row.unrealizedPl === null ? "" : fmt2(row.unrealizedPl),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function buildSummary(payload: ReportPayload) {
  let totalInvested = 0;
  let totalUnrealized = 0;
  let quotedCount = 0;
  for (const row of payload.rows) {
    totalInvested += Number.isFinite(row.totalCost) ? row.totalCost : 0;
    if (row.unrealizedPl !== null && Number.isFinite(row.unrealizedPl)) {
      totalUnrealized += row.unrealizedPl;
      quotedCount += 1;
    }
  }
  return {
    totalInvested,
    totalUnrealized,
    totalRealizedBdt: payload.totalRealizedBdt,
    quotedCount,
    totalRows: payload.rows.length,
  };
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT ?? "587";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user;
  const port = Number(portRaw);
  if (!host || !user || !pass || !from || !Number.isFinite(port)) {
    throw new Error("Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return { transporter, from };
}

export async function sendPortfolioReportEmail(
  payload: ReportPayload,
  trigger: "manual" | "monthly",
  overrideRecipient?: string,
) {
  const { transporter, from } = createTransport();
  const recipient = overrideRecipient || reportRecipient();
  const summary = buildSummary(payload);
  const csv = buildCsv(payload);
  const stamp = new Date().toISOString().slice(0, 10);
  const subjectPrefix = trigger === "monthly" ? "Monthly" : "Manual";
  const subject = `${subjectPrefix} portfolio report (${stamp})`;

  await transporter.sendMail({
    from,
    to: recipient,
    subject,
    text: [
      `Portfolio report (${trigger})`,
      `Date: ${new Date().toLocaleString()}`,
      "",
      `Total unrealized P/L: BDT ${fmt2(summary.totalUnrealized)}`,
      `Net Gain/Loss: BDT ${fmt2(summary.totalRealizedBdt)}`,
      `Total invested: BDT ${fmt2(summary.totalInvested)}`,
      "",
      `Open positions: ${summary.totalRows}`,
      `Positions with market price: ${summary.quotedCount}`,
      "",
      "A CSV sheet is attached.",
    ].join("\n"),
    html: `
      <h2>Portfolio report (${trigger})</h2>
      <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
      <ul>
        <li><strong>Total unrealized P/L:</strong> BDT ${fmt2(summary.totalUnrealized)}</li>
        <li><strong>Net Gain/Loss:</strong> BDT ${fmt2(summary.totalRealizedBdt)}</li>
        <li><strong>Total invested:</strong> BDT ${fmt2(summary.totalInvested)}</li>
        <li><strong>Open positions:</strong> ${summary.totalRows}</li>
        <li><strong>Positions with market price:</strong> ${summary.quotedCount}</li>
      </ul>
      <p>Attached: CSV sheet of all open positions.</p>
    `,
    attachments: [
      {
        filename: `portfolio-report-${stamp}.csv`,
        content: csv,
        contentType: "text/csv",
      },
    ],
  });
}

export async function buildReportForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReportPayload> {
  const [txRes, ovRes, lspRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, created_at, symbol, side, quantity, price_per_share, category, fees_bdt")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("portfolio_position_overrides")
      .select("symbol, shares, avg_price_bdt, total_cost_bdt")
      .eq("user_id", userId),
    fetchDseLspQuoteMapFresh(),
  ]);

  if (txRes.error) throw new Error(txRes.error.message);
  if (ovRes.error) throw new Error(ovRes.error.message);
  if (lspRes.error) {
    // We still send the report with book values when LSP fetch fails.
  }

  const txRows = (txRes.data ?? []) as TransactionRow[];
  const ledger = aggregateHoldings(txRows);
  const overrides = (ovRes.data ?? []) as PositionOverrideRow[];
  const merged = mergeLedgerWithOverrides(ledger, overrides);
  const rows = holdingsToMarketRows(merged, lspRes.bySymbol);
  const totalRealizedBdt = totalRealizedProfitLossBdt(txRows);
  return { rows, totalRealizedBdt };
}

export async function sendMonthlyPortfolioReportForConfiguredUser() {
  const recipient = reportRecipient();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .schema("auth")
    .from("users")
    .select("id,email")
    .eq("email", recipient)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) {
    throw new Error(`No Supabase user found for ${recipient}.`);
  }
  const payload = await buildReportForUser(supabase, String(data.id));
  await sendPortfolioReportEmail(payload, "monthly");
}
