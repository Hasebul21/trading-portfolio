import { Resend } from "resend";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  aggregateHoldings,
  computePortfolioSummary,
  totalRealizedProfitLossBdt,
  type TransactionRow,
} from "@/lib/portfolio";
import { fetchDseLspQuoteMapFresh } from "@/lib/market/dse-lsp-quotes";
import { fetchDseCompanyExtrasMap } from "@/lib/market/dse-company-52w";
import { holdingsToMarketRows } from "@/lib/market/portfolio-with-quotes";
import { mergeLedgerWithOverrides, type PositionOverrideRow } from "@/lib/portfolio-overrides";
import { createAdminClient } from "@/lib/supabase/admin";
import { sectorMatchKey } from "@/lib/sector-targets";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

type WatchlistItem = {
  symbol: string;
  sector: string | null;
  ltp: number | null;
  buyPoint: number | null;
  sellPoint: number | null;
  breakEvenPrice: number | null;
  week52Low: number | null;
  week52High: number | null;
};

type SectorSlice = {
  sector: string;
  investedBdt: number;
  percentOfPortfolio: number;
  targetPercent: number | null;
};

type ReportPayload = {
  rows: ReturnType<typeof holdingsToMarketRows>;
  totalRealizedBdt: number;
  totalCashAdjustmentsBdt: number;
  watchlist: WatchlistItem[];
  sectorAllocation: SectorSlice[];
};

type ReportTrigger = "manual" | "daily";

const DEFAULT_REPORT_EMAIL = "hasebulhassan21@gmail.com";

function reportRecipient(): string {
  return (process.env.PORTFOLIO_REPORT_RECIPIENT ?? DEFAULT_REPORT_EMAIL).trim().toLowerCase();
}

function fmt2(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtBdt(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

// ─── PDF builder ──────────────────────────────────────────────────────────────

async function buildPdf(payload: ReportPayload, trigger: ReportTrigger): Promise<Uint8Array> {
  const summary = buildSummary(payload);
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

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

  const ensureSpace = (needed: number) => {
    if (y < margin + needed) {
      page = pdfDoc.addPage([PW, PH]);
      y = PH - margin;
    }
  };

  // ── Title ──
  drawText("Portfolio Report", margin, y, 26, true, rgb(0.02, 0.35, 0.45));
  y -= 30;
  page.drawLine({ start: { x: margin, y }, end: { x: PW - margin, y }, thickness: 1.2, color: rgb(0.78, 0.84, 0.88) });
  y -= 24;

  const triggerLabel = trigger === "daily" ? "Daily (5 PM BD)" : "Manual";
  drawText(`Type: ${triggerLabel}`, margin, y, 13);
  drawText(`Generated: ${new Date().toLocaleString()}`, 300, y, 13);
  y -= 28;

  // Summary cards
  const summaryItems = [
    { label: "Total Invested", value: `BDT ${fmt2(summary.totalInvested)}` },
    { label: "Realized G/L", value: `BDT ${fmt2(summary.totalRealizedBdt)}` },
    { label: "Net Gain/Loss", value: `BDT ${fmt2(summary.netGainLoss)}` },
  ];
  const cardW = (tableWidth - 30) / 3;
  summaryItems.forEach((item, i) => {
    const cx = margin + i * (cardW + 15);
    page.drawRectangle({ x: cx, y: y - 10, width: cardW, height: 48, color: rgb(0.95, 0.97, 0.99), borderColor: rgb(0.82, 0.88, 0.92), borderWidth: 0.8 });
    drawText(item.label, cx + 12, y + 22, 11, false, rgb(0.35, 0.4, 0.45));
    drawText(item.value, cx + 12, y + 2, 15, true, rgb(0.1, 0.1, 0.1));
  });
  y -= 56;

  drawText(`Open positions: ${summary.totalRows}  ·  With market price: ${summary.quotedCount}`, margin, y, 12, false, rgb(0.4, 0.4, 0.4));
  y -= 30;

  // ── Holdings table ──
  const holdingsCols = [
    { title: "Symbol", w: 0.22 },
    { title: "Shares", w: 0.20 },
    { title: "Avg (BDT)", w: 0.24 },
    { title: "Invested (BDT)", w: 0.34 },
  ];
  const holdingsColWidths = holdingsCols.map((c) => c.w * tableWidth);
  const rowH = 26;
  const headerH = 30;
  const fontSize = 13;

  const drawTableHeader = (cols: typeof holdingsCols, widths: number[]) => {
    page.drawRectangle({ x: margin, y: y - 8, width: tableWidth, height: headerH, color: rgb(0.12, 0.35, 0.48) });
    let x = margin + 10;
    cols.forEach((c, i) => {
      drawText(c.title, x, y, 13, true, rgb(1, 1, 1));
      x += widths[i]!;
    });
    y -= headerH + 4;
  };

  drawTableHeader(holdingsCols, holdingsColWidths);

  payload.rows.forEach((row, rIdx) => {
    ensureSpace(20);
    if (rIdx % 2 === 0) {
      page.drawRectangle({ x: margin, y: y - 6, width: tableWidth, height: rowH, color: rgb(0.97, 0.98, 0.99) });
    }
    let x = margin + 10;
    [row.symbol, fmt2(row.shares), fmt2(row.avgPrice), fmt2(row.totalCost)].forEach((v, idx) => {
      drawText(v.slice(0, 24), x, y, fontSize, idx === 0, rgb(0.14, 0.14, 0.14));
      x += holdingsColWidths[idx]!;
    });
    y -= rowH;
  });

  // ── Sector Allocation section ──
  if (payload.sectorAllocation.length > 0) {
    y -= 20;
    ensureSpace(60);

    page.drawLine({ start: { x: margin, y }, end: { x: PW - margin, y }, thickness: 0.6, color: rgb(0.82, 0.86, 0.9) });
    y -= 20;
    drawText("Sector Allocation", margin, y, 16, true, rgb(0.02, 0.35, 0.45));
    y -= 24;

    const sectorCols = [
      { title: "Sector", w: 0.40 },
      { title: "Invested (BDT)", w: 0.25 },
      { title: "% Portfolio", w: 0.18 },
      { title: "Target %", w: 0.17 },
    ];
    const sectorWidths = sectorCols.map((c) => c.w * tableWidth);
    drawTableHeader(sectorCols, sectorWidths);

    payload.sectorAllocation.forEach((slice, rIdx) => {
      ensureSpace(20);
      if (rIdx % 2 === 0) {
        page.drawRectangle({ x: margin, y: y - 6, width: tableWidth, height: rowH, color: rgb(0.97, 0.98, 0.99) });
      }
      let x = margin + 10;
      [
        slice.sector.slice(0, 40),
        fmt2(slice.investedBdt),
        fmtPct(slice.percentOfPortfolio),
        slice.targetPercent !== null ? fmtPct(slice.targetPercent) : "—",
      ].forEach((v, idx) => {
        drawText(v, x, y, fontSize, idx === 0, rgb(0.14, 0.14, 0.14));
        x += sectorWidths[idx]!;
      });
      y -= rowH;
    });
  }

  // ── Watchlist section ──
  if (payload.watchlist.length > 0) {
    y -= 20;
    ensureSpace(60);

    page.drawLine({ start: { x: margin, y }, end: { x: PW - margin, y }, thickness: 0.6, color: rgb(0.82, 0.86, 0.9) });
    y -= 20;
    drawText("Watchlist", margin, y, 16, true, rgb(0.02, 0.35, 0.45));
    y -= 24;

    const wlCols = [
      { title: "Symbol", w: 0.13 },
      { title: "Sector", w: 0.22 },
      { title: "LTP", w: 0.11 },
      { title: "Buy Point", w: 0.13 },
      { title: "Sell Point", w: 0.13 },
      { title: "Break-even", w: 0.14 },
      { title: "52W Low", w: 0.07 },
      { title: "52W High", w: 0.07 },
    ];
    const wlWidths = wlCols.map((c) => c.w * tableWidth);
    drawTableHeader(wlCols, wlWidths);

    payload.watchlist.forEach((item, rIdx) => {
      ensureSpace(20);
      if (rIdx % 2 === 0) {
        page.drawRectangle({ x: margin, y: y - 6, width: tableWidth, height: rowH, color: rgb(0.97, 0.98, 0.99) });
      }
      let x = margin + 10;
      [
        item.symbol,
        (item.sector ?? "—").slice(0, 28),
        fmtBdt(item.ltp),
        fmtBdt(item.buyPoint),
        fmtBdt(item.sellPoint),
        fmtBdt(item.breakEvenPrice),
        fmtBdt(item.week52Low),
        fmtBdt(item.week52High),
      ].forEach((v, idx) => {
        drawText(v, x, y, 11, idx === 0, rgb(0.14, 0.14, 0.14));
        x += wlWidths[idx]!;
      });
      y -= rowH;
    });
  }

  // Footer
  y -= 10;
  ensureSpace(30);
  page.drawLine({ start: { x: margin, y }, end: { x: PW - margin, y }, thickness: 0.6, color: rgb(0.82, 0.86, 0.9) });
  y -= 18;
  drawText("Generated by Trading Portfolio", margin, y, 10, false, rgb(0.55, 0.55, 0.55));

  return await pdfDoc.save();
}

// ─── Summary builder ──────────────────────────────────────────────────────────

function buildSummary(payload: ReportPayload) {
  const ltpMap = new Map<string, number | null | undefined>();
  for (const row of payload.rows) ltpMap.set(row.symbol, row.marketLtp);
  const summary = computePortfolioSummary(
    payload.rows,
    payload.totalRealizedBdt,
    ltpMap,
    payload.totalCashAdjustmentsBdt,
  );
  return {
    totalInvested: summary.totalInvested,
    totalUnrealized: summary.unrealizedGainLoss,
    totalRealizedBdt: summary.realizedGainLoss,
    cashAdjustments: summary.cashAdjustments,
    netGainLoss: summary.netGainLoss,
    quotedCount: summary.quotedPositionCount,
    totalRows: payload.rows.length,
  };
}

// ─── Email send ───────────────────────────────────────────────────────────────

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
  trigger: ReportTrigger,
  overrideRecipient?: string,
) {
  const { resend, from } = createResendClient();
  const recipient = overrideRecipient || reportRecipient();
  const summary = buildSummary(payload);
  const pdfBytes = await buildPdf(payload, trigger);
  const stamp = new Date().toISOString().slice(0, 10);
  const subjectPrefix = trigger === "daily" ? "Daily" : "Manual";
  const subject = `${subjectPrefix} portfolio report (${stamp})`;

  // Build allocation rows HTML
  const allocationHtml = payload.sectorAllocation.length > 0
    ? `<h3 style="margin-top:24px">Sector Allocation</h3>
       <table style="border-collapse:collapse;width:100%;font-size:13px">
         <thead><tr style="background:#1e596e;color:#fff">
           <th style="padding:6px 10px;text-align:left">Sector</th>
           <th style="padding:6px 10px;text-align:right">Invested (BDT)</th>
           <th style="padding:6px 10px;text-align:right">% Portfolio</th>
           <th style="padding:6px 10px;text-align:right">Target %</th>
         </tr></thead>
         <tbody>${payload.sectorAllocation.map((s, i) => `
           <tr style="${i % 2 === 0 ? "background:#f5f8fa" : ""}">
             <td style="padding:5px 10px">${s.sector}</td>
             <td style="padding:5px 10px;text-align:right">${fmt2(s.investedBdt)}</td>
             <td style="padding:5px 10px;text-align:right">${fmtPct(s.percentOfPortfolio)}</td>
             <td style="padding:5px 10px;text-align:right">${s.targetPercent !== null ? fmtPct(s.targetPercent) : "—"}</td>
           </tr>`).join("")}
         </tbody>
       </table>`
    : "";

  // Build watchlist rows HTML
  const watchlistHtml = payload.watchlist.length > 0
    ? `<h3 style="margin-top:24px">Watchlist</h3>
       <table style="border-collapse:collapse;width:100%;font-size:13px">
         <thead><tr style="background:#1e596e;color:#fff">
           <th style="padding:6px 10px;text-align:left">Symbol</th>
           <th style="padding:6px 10px;text-align:left">Sector</th>
           <th style="padding:6px 10px;text-align:right">LTP</th>
           <th style="padding:6px 10px;text-align:right">Buy Point</th>
           <th style="padding:6px 10px;text-align:right">Sell Point</th>
           <th style="padding:6px 10px;text-align:right">Break-even</th>
           <th style="padding:6px 10px;text-align:right">52W Low</th>
           <th style="padding:6px 10px;text-align:right">52W High</th>
         </tr></thead>
         <tbody>${payload.watchlist.map((w, i) => `
           <tr style="${i % 2 === 0 ? "background:#f5f8fa" : ""}">
             <td style="padding:5px 10px;font-weight:600">${w.symbol}</td>
             <td style="padding:5px 10px;color:#555">${w.sector ?? "—"}</td>
             <td style="padding:5px 10px;text-align:right">${fmtBdt(w.ltp)}</td>
             <td style="padding:5px 10px;text-align:right">${fmtBdt(w.buyPoint)}</td>
             <td style="padding:5px 10px;text-align:right">${fmtBdt(w.sellPoint)}</td>
             <td style="padding:5px 10px;text-align:right">${fmtBdt(w.breakEvenPrice)}</td>
             <td style="padding:5px 10px;text-align:right">${fmtBdt(w.week52Low)}</td>
             <td style="padding:5px 10px;text-align:right">${fmtBdt(w.week52High)}</td>
           </tr>`).join("")}
         </tbody>
       </table>`
    : "";

  const result = await resend.emails.send({
    from,
    to: [recipient],
    subject,
    text: [
      `Portfolio report (${trigger})`,
      `Date: ${new Date().toLocaleString()}`,
      "",
      `Total invested: BDT ${fmt2(summary.totalInvested)}`,
      `Realized G/L: BDT ${fmt2(summary.totalRealizedBdt)}`,
      ...(summary.cashAdjustments !== 0
        ? [`Cash adjustments: BDT ${fmt2(summary.cashAdjustments)}`]
        : []),
      `Net Gain/Loss: BDT ${fmt2(summary.netGainLoss)}`,
      "",
      `Open positions: ${summary.totalRows}`,
      `Positions with market price: ${summary.quotedCount}`,
      "",
      "A PDF report is attached with holdings, sector allocation, and watchlist.",
    ].join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:900px;margin:0 auto">
        <h2 style="color:#1e596e">Portfolio Report (${trigger})</h2>
        <p style="color:#666"><strong>Date:</strong> ${new Date().toLocaleString()}</p>

        <h3>Summary</h3>
        <ul>
          <li><strong>Total invested:</strong> BDT ${fmt2(summary.totalInvested)}</li>
          <li><strong>Realized G/L:</strong> BDT ${fmt2(summary.totalRealizedBdt)}</li>
          ${summary.cashAdjustments !== 0 ? `<li><strong>Cash adjustments:</strong> BDT ${fmt2(summary.cashAdjustments)}</li>` : ""}
          <li><strong>Net Gain/Loss:</strong> BDT ${fmt2(summary.netGainLoss)}</li>
          <li><strong>Open positions:</strong> ${summary.totalRows}</li>
          <li><strong>Positions with market price:</strong> ${summary.quotedCount}</li>
        </ul>

        ${allocationHtml}
        ${watchlistHtml}

        <p style="margin-top:24px;color:#888;font-size:12px">
          Full PDF attached with all details.
        </p>
      </div>
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

// ─── Data builder ─────────────────────────────────────────────────────────────

export async function buildReportForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReportPayload> {
  const [txRes, ovRes, lspRes, ltRes, targetsRes, caRes] = await Promise.all([
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
    supabase
      .from("long_term_holdings")
      .select("symbol, buy_point_bdt, sell_point_bdt, manual_avg_cost_bdt")
      .eq("user_id", userId)
      .order("symbol", { ascending: true }),
    supabase
      .from("sector_target_allocations")
      .select("sector, target_percent")
      .eq("user_id", userId),
    supabase.from("cash_adjustments").select("amount_bdt").eq("user_id", userId),
  ]);

  if (txRes.error) throw new Error(txRes.error.message);
  if (ovRes.error) throw new Error(ovRes.error.message);

  const txRows = (txRes.data ?? []) as TransactionRow[];
  const ledger = aggregateHoldings(txRows);
  const overrides = (ovRes.data ?? []) as PositionOverrideRow[];
  const merged = mergeLedgerWithOverrides(ledger, overrides);

  // Symbols to fetch extras for: portfolio + watchlist (deduped)
  const watchlistRows = ltRes.data ?? [];
  const allSymbols = [
    ...new Set([
      ...merged.map((h) => h.symbol),
      ...watchlistRows.map((r) => String(r.symbol).trim().toUpperCase()),
    ]),
  ];

  const companyExtrasRes = await fetchDseCompanyExtrasMap(allSymbols);
  const rows = holdingsToMarketRows(merged, lspRes.bySymbol, companyExtrasRes);

  // Build break-even map from portfolio holdings
  const breakEvenBySymbol = new Map<string, number>();
  for (const h of merged) {
    breakEvenBySymbol.set(h.symbol.toUpperCase(), h.breakEvenPrice);
  }

  // Watchlist items
  const watchlist: WatchlistItem[] = watchlistRows.map((r) => {
    const sym = String(r.symbol).trim().toUpperCase();
    const extras = companyExtrasRes.get(sym);
    const quote = lspRes.bySymbol.get(sym);
    return {
      symbol: sym,
      sector: extras?.sector ?? null,
      ltp: quote?.ltp ?? null,
      buyPoint: typeof r.buy_point_bdt === "number" ? r.buy_point_bdt : null,
      sellPoint: typeof r.sell_point_bdt === "number" ? r.sell_point_bdt : null,
      breakEvenPrice: breakEvenBySymbol.get(sym) ?? null,
      week52Low: extras?.week52Low ?? null,
      week52High: extras?.week52High ?? null,
    };
  });

  // Sector allocation
  const bySector = new Map<string, { label: string; invested: number }>();
  let totalInvested = 0;
  for (const row of rows) {
    const cost = Number(row.totalCost);
    if (!Number.isFinite(cost) || cost <= 0) continue;
    const label = row.sector?.trim() || "Unknown";
    const key = sectorMatchKey(label);
    const entry = bySector.get(key) ?? { label, invested: 0 };
    entry.invested += cost;
    bySector.set(key, entry);
    totalInvested += cost;
  }

  // Sector targets
  const targetByKey = new Map<string, number>();
  for (const t of (targetsRes.data ?? []) as { sector: string; target_percent: number | null }[]) {
    if (t.sector?.trim() && t.target_percent !== null && Number.isFinite(t.target_percent)) {
      targetByKey.set(sectorMatchKey(t.sector), t.target_percent);
    }
  }

  const sectorAllocation: SectorSlice[] = [...bySector.entries()]
    .map(([key, { label, invested }]) => ({
      sector: label,
      investedBdt: invested,
      percentOfPortfolio: totalInvested > 0 ? (invested / totalInvested) * 100 : 0,
      targetPercent: targetByKey.get(key) ?? null,
    }))
    .sort((a, b) => b.investedBdt - a.investedBdt);

  // Cash adjustments
  let totalCashAdjustmentsBdt = 0;
  if (!caRes.error) {
    for (const row of (caRes.data ?? []) as { amount_bdt: number | string | null }[]) {
      const n = typeof row.amount_bdt === "number" ? row.amount_bdt : Number(row.amount_bdt ?? 0);
      if (Number.isFinite(n)) totalCashAdjustmentsBdt += n;
    }
    totalCashAdjustmentsBdt = Math.round(totalCashAdjustmentsBdt * 100) / 100;
  }

  const totalRealizedBdt = totalRealizedProfitLossBdt(txRows);

  return { rows, totalRealizedBdt, totalCashAdjustmentsBdt, watchlist, sectorAllocation };
}

// ─── Entrypoints ──────────────────────────────────────────────────────────────

export async function sendDailyPortfolioReportForConfiguredUser(): Promise<{
  ok: true;
  recipient: string;
}> {
  const recipient = reportRecipient();
  if (!recipient) {
    throw new Error("No recipient configured. Set PORTFOLIO_REPORT_RECIPIENT in Vercel env.");
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (e) {
    throw new Error(
      `Cannot create Supabase admin client (check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY): ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const { data, error } = await supabase
    .schema("auth")
    .from("users")
    .select("id,email")
    .ilike("email", recipient)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase auth lookup failed: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error(
      `No Supabase user found for "${recipient}". Either set PORTFOLIO_REPORT_RECIPIENT to an existing auth.users.email, or sign up that email in Supabase Auth.`,
    );
  }

  const payload = await buildReportForUser(supabase, String(data.id));
  await sendPortfolioReportEmail(payload, "daily");
  return { ok: true, recipient };
}

/** @deprecated Use {@link sendDailyPortfolioReportForConfiguredUser} instead. */
export const sendMonthlyPortfolioReportForConfiguredUser =
  sendDailyPortfolioReportForConfiguredUser;
