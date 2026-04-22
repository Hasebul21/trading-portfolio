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

  // Letter landscape – wider & taller than A4 landscape for breathing room
  const PW = 1056;
  const PH = 816;
  const margin = 50;
  const tableWidth = PW - margin * 2;

  let page = pdfDoc.addPage([PW, PH]);
  let y = PH - margin;

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    size: number,
    isBold = false,
    color = rgb(0.12, 0.12, 0.12),
  ) => {
    page.drawText(text, { x, y: yPos, size, font: isBold ? bold : font, color });
  };

  // ── Title ──
  drawText("Portfolio Report", margin, y, 26, true, rgb(0.02, 0.35, 0.45));
  y -= 30;

  // Divider line below title
  page.drawLine({ start: { x: margin, y }, end: { x: PW - margin, y }, thickness: 1.2, color: rgb(0.78, 0.84, 0.88) });
  y -= 24;

  // Meta row
  const triggerLabel = trigger === "monthly" ? "Monthly" : "Manual";
  drawText(`Type: ${triggerLabel}`, margin, y, 13);
  drawText(`Generated: ${new Date().toLocaleString()}`, 300, y, 13);
  y -= 28;

  // Summary cards row
  const summaryItems = [
    { label: "Total Invested", value: `BDT ${fmt2(summary.totalInvested)}` },
    { label: "Unrealized P/L", value: `BDT ${fmt2(summary.totalUnrealized)}` },
    { label: "Net Gain/Loss", value: `BDT ${fmt2(summary.totalRealizedBdt)}` },
  ];
  const cardW = (tableWidth - 30) / 3;
  summaryItems.forEach((item, i) => {
    const cx = margin + i * (cardW + 15);
    page.drawRectangle({ x: cx, y: y - 10, width: cardW, height: 48, color: rgb(0.95, 0.97, 0.99), borderColor: rgb(0.82, 0.88, 0.92), borderWidth: 0.8 });
    drawText(item.label, cx + 12, y + 22, 11, false, rgb(0.35, 0.4, 0.45));
    drawText(item.value, cx + 12, y + 2, 15, true, rgb(0.1, 0.1, 0.1));
  });
  y -= 56;

  // Position count
  drawText(`Open positions: ${summary.totalRows}  ·  With market price: ${summary.quotedCount}`, margin, y, 12, false, rgb(0.4, 0.4, 0.4));
  y -= 30;

  // ── Table ──
  const columns = [
    { title: "Symbol", w: 0.22 },
    { title: "Shares", w: 0.18 },
    { title: "Avg (BDT)", w: 0.20 },
    { title: "Invested (BDT)", w: 0.20 },
    { title: "Unrealized P/L", w: 0.20 },
  ];
  const colWidths = columns.map((c) => c.w * tableWidth);
  const rowH = 26;
  const headerH = 30;
  const fontSize = 13;
  const headerFontSize = 13;

  const drawTableHeader = () => {
    // Header bg
    page.drawRectangle({ x: margin, y: y - 8, width: tableWidth, height: headerH, color: rgb(0.12, 0.35, 0.48) });
    let x = margin + 10;
    columns.forEach((c, i) => {
      drawText(c.title, x, y, headerFontSize, true, rgb(1, 1, 1));
      x += colWidths[i]!;
    });
    y -= headerH + 4;
  };

  drawTableHeader();

  payload.rows.forEach((row, rIdx) => {
    if (y < margin + 20) {
      page = pdfDoc.addPage([PW, PH]);
      y = PH - margin;
      drawTableHeader();
    }

    // Alternate row shading
    if (rIdx % 2 === 0) {
      page.drawRectangle({ x: margin, y: y - 6, width: tableWidth, height: rowH, color: rgb(0.97, 0.98, 0.99) });
    }

    let x = margin + 10;
    const values = [
      row.symbol,
      fmt2(row.shares),
      fmt2(row.avgPrice),
      fmt2(row.totalCost),
      row.unrealizedPl === null ? "N/A" : fmt2(row.unrealizedPl),
    ];

    values.forEach((v, idx) => {
      // Color P/L column
      let color = rgb(0.14, 0.14, 0.14);
      if (idx === 4 && v !== "N/A") {
        const num = parseFloat(v);
        if (num > 0) color = rgb(0.0, 0.5, 0.2);
        else if (num < 0) color = rgb(0.75, 0.15, 0.1);
      }
      drawText(v.slice(0, 24), x, y, fontSize, idx === 0, color);
      x += colWidths[idx]!;
    });

    y -= rowH;
  });

  // Footer line
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: PW - margin, y }, thickness: 0.6, color: rgb(0.82, 0.86, 0.9) });
  y -= 18;
  drawText("Generated by Trading Portfolio", margin, y, 10, false, rgb(0.55, 0.55, 0.55));

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
