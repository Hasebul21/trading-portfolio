import { Resend } from "resend";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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

async function buildPdf(payload: ReportPayload, trigger: "manual" | "monthly"): Promise<Uint8Array> {
  const summary = buildSummary(payload);
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([842, 595]); // A4 landscape
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const left = 36;
  const top = pageHeight - 34;
  let y = top;

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    size: number,
    isBold = false,
    color = rgb(0.12, 0.12, 0.12),
  ) => {
    page.drawText(text, {
      x,
      y: yPos,
      size,
      font: isBold ? bold : font,
      color,
    });
  };

  drawText("Portfolio Report", left, y, 18, true, rgb(0.02, 0.35, 0.45));
  y -= 22;
  drawText(`Type: ${trigger === "monthly" ? "Monthly" : "Manual"}`, left, y, 10);
  drawText(`Generated: ${new Date().toLocaleString()}`, 230, y, 10);
  y -= 18;

  drawText(`Total unrealized P/L: BDT ${fmt2(summary.totalUnrealized)}`, left, y, 11, true);
  drawText(`Net Gain/Loss: BDT ${fmt2(summary.totalRealizedBdt)}`, 280, y, 11, true);
  drawText(`Total invested: BDT ${fmt2(summary.totalInvested)}`, 520, y, 11, true);
  y -= 24;

  const columns = [
    { key: "symbol", title: "Symbol", w: 90 },
    { key: "shares", title: "Shares", w: 90 },
    { key: "avg", title: "Avg (BDT)", w: 110 },
    { key: "total", title: "Invested (BDT)", w: 130 },
    { key: "upl", title: "Unrealized P/L", w: 150 },
  ] as const;

  const drawTableHeader = () => {
    let x = left;
    page.drawRectangle({
      x: left - 4,
      y: y - 6,
      width: pageWidth - left * 2 + 8,
      height: 20,
      color: rgb(0.92, 0.96, 0.98),
    });
    columns.forEach((c) => {
      drawText(c.title, x, y, 10, true, rgb(0.05, 0.25, 0.35));
      x += c.w;
    });
    y -= 20;
  };

  drawTableHeader();

  for (const row of payload.rows) {
    if (y < 36) {
      page = pdfDoc.addPage([842, 595]);
      y = page.getHeight() - 34;
      drawTableHeader();
    }
    let x = left;
    const values = [
      row.symbol,
      fmt2(row.shares),
      fmt2(row.avgPrice),
      fmt2(row.totalCost),
      row.unrealizedPl === null ? "N/A" : fmt2(row.unrealizedPl),
    ];

    values.forEach((v, idx) => {
      const isNum = idx > 0;
      const text = isNum ? v.padStart(10, " ") : v;
      drawText(text.slice(0, 22), x, y, 9, false, rgb(0.16, 0.16, 0.16));
      x += columns[idx]!.w;
    });

    y -= 16;
  }

  return await pdfDoc.save();
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

function createResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM?.trim() || "Portfolio <onboarding@resend.dev>";

  if (!apiKey) {
    throw new Error("Email is not configured. Set RESEND_API_KEY. Optionally set RESEND_FROM.");
  }

  return { resend: new Resend(apiKey), from };
}

export async function sendPortfolioReportEmail(
  payload: ReportPayload,
  trigger: "manual" | "monthly",
  overrideRecipient?: string,
) {
  const { resend, from } = createResendClient();
  const recipient = overrideRecipient || reportRecipient();
  const summary = buildSummary(payload);
  const pdfBytes = await buildPdf(payload, trigger);
  const stamp = new Date().toISOString().slice(0, 10);
  const subjectPrefix = trigger === "monthly" ? "Monthly" : "Manual";
  const subject = `${subjectPrefix} portfolio report (${stamp})`;

  const result = await resend.emails.send({
    from,
    to: [recipient],
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
      "A PDF report is attached.",
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
      <p>Attached: PDF report of all open positions.</p>
    `,
    attachments: [
      {
        filename: `portfolio-report-${stamp}.pdf`,
        content: Buffer.from(pdfBytes).toString("base64"),
      },
    ],
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
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
