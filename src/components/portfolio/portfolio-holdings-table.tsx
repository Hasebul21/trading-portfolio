"use client";

import {
  savePortfolioPositions,
  type PortfolioSaveRow,
} from "@/app/(app)/actions";
import {
  formatBdt,
  formatNumberMax2Decimals,
  formatPlainNumberMax2Decimals,
} from "@/lib/format-bdt";
import { calculateBreakEvenPrice, computePortfolioSummary } from "@/lib/portfolio";
import { tablePagination } from "@/lib/table-pagination";
import type { PortfolioMarketRow } from "@/lib/market/portfolio-with-quotes";
import { Alert, Button, Card, Input, Space, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DataRow = PortfolioMarketRow & { key: string; isHeader?: false };
type SectorHeaderRow = {
  key: string;
  isHeader: true;
  sector: string;
  count: number;
};
type Row = DataRow | SectorHeaderRow;

const SECTOR_FALLBACK = "Unsectorised";

function sectorLabel(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  return t || SECTOR_FALLBACK;
}

/**
 * Build the table rows: data rows are sorted by sector then symbol, and a
 * single sector-header row is inserted before each group so the table reads
 * as separate per-sector sections within one table.
 */
function groupBySector(rows: PortfolioMarketRow[]): Row[] {
  const bySector = new Map<string, PortfolioMarketRow[]>();
  for (const r of rows) {
    const k = sectorLabel(r.sector);
    const list = bySector.get(k) ?? [];
    list.push(r);
    bySector.set(k, list);
  }
  const sectors = [...bySector.keys()].sort((a, b) => {
    // Push the fallback bucket to the bottom so real sectors lead.
    if (a === SECTOR_FALLBACK && b !== SECTOR_FALLBACK) return 1;
    if (b === SECTOR_FALLBACK && a !== SECTOR_FALLBACK) return -1;
    return a.localeCompare(b);
  });
  const out: Row[] = [];
  for (const s of sectors) {
    const items = bySector.get(s)!.slice().sort((a, b) => a.symbol.localeCompare(b.symbol));
    out.push({ key: `__sector__:${s}`, isHeader: true, sector: s, count: items.length });
    for (const h of items) out.push({ ...h, key: h.symbol });
  }
  return out;
}

type BookDraft = { shares: string; avg: string; total: string };

const { Search } = Input;

function fmtSignedBdt(n: number) {
  const s = formatBdt(Math.abs(n));
  if (n > 0) return `+${s}`;
  if (n < 0) return `-${s}`;
  return s;
}

/** P/L indicator with colored dot and white text */
function PlIndicator({ value }: { value: number }) {
  const dotColor = value >= 0 ? "bg-emerald-400" : "bg-red-400";
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums text-[15px] font-normal text-zinc-50">
      <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
      {fmtSignedBdt(value)}
    </span>
  );
}

/**
 * Single source of truth for the four summary cards: builds the
 * {@link computePortfolioSummary} structure from the rows currently visible
 * (so the preview during "Edit book" reflects the draft consistently).
 */
function summaryFromRows(
  rows: PortfolioMarketRow[],
  totalRealizedBdt: number,
  cashAdjustmentsBdt: number,
): {
  totalInvested: number;
  realizedGainLoss: number;
  unrealizedGainLoss: number;
  cashAdjustments: number;
  netGainLoss: number;
  withQuote: number;
  positions: number;
} {
  const ltpMap = new Map<string, number | null | undefined>();
  for (const h of rows) ltpMap.set(h.symbol, h.marketLtp);
  const summary = computePortfolioSummary(rows, totalRealizedBdt, ltpMap, cashAdjustmentsBdt);
  return {
    totalInvested: summary.totalInvested,
    realizedGainLoss: summary.realizedGainLoss,
    unrealizedGainLoss: summary.unrealizedGainLoss,
    cashAdjustments: summary.cashAdjustments,
    netGainLoss: summary.netGainLoss,
    withQuote: summary.quotedPositionCount,
    positions: rows.length,
  };
}

function parseBookNumber(raw: string): number | null {
  const n = Number(String(raw).trim().replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return n;
}

function bookFingerprint(rows: PortfolioMarketRow[]) {
  return rows
    .map(
      (h) =>
        `${h.symbol}:${Number(h.shares.toFixed(2))}:${Number(h.avgPrice.toFixed(2))}:${Number(h.totalCost.toFixed(2))}`,
    )
    .sort()
    .join("|");
}

const bookInputClass =
  "box-border w-full min-w-[4.5rem] rounded-md border border-zinc-300 bg-white px-2 py-1 text-right text-[15px] font-normal tabular-nums text-zinc-900 outline-none ring-teal-500/25 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

function sortNullableNumber(
  pick: (r: DataRow) => number | null | undefined,
): (a: DataRow, b: DataRow) => number {
  return (a, b) => {
    const av = pick(a);
    const bv = pick(b);
    const an = av !== null && av !== undefined && Number.isFinite(av) ? Number(av) : null;
    const bn = bv !== null && bv !== undefined && Number.isFinite(bv) ? Number(bv) : null;
    if (an === null && bn === null) return 0;
    if (an === null) return 1;
    if (bn === null) return -1;
    return an - bn;
  };
}

export function PortfolioHoldingsTable({
  holdings,
  totalRealizedBdt = 0,
  totalInvestedBdt = 0,
  totalCashAdjustmentsBdt = 0,
  enableBookEdit = false,
  onAfterBookSave,
}: {
  holdings: PortfolioMarketRow[];
  /** Realized G/L from completed sells: Σ (sell price − avg at sell) × qty. */
  totalRealizedBdt?: number;
  /** Active capital only — buys add, sells deduct cost basis at avg. */
  totalInvestedBdt?: number;
  /** Net of manual cash add/deduct entries from Settings. */
  totalCashAdjustmentsBdt?: number;
  enableBookEdit?: boolean;
  onAfterBookSave?: () => void | Promise<void>;
}) {
  const [symbolQuery, setSymbolQuery] = useState("");
  const [draft, setDraft] = useState<Record<string, BookDraft>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [bookEditorOpen, setBookEditorOpen] = useState(false);

  const fp = useMemo(() => bookFingerprint(holdings), [holdings]);
  const prevFp = useRef(fp);

  useEffect(() => {
    if (prevFp.current !== fp) {
      prevFp.current = fp;
      setDraft({});
      setDirty(false);
      setSaveError(null);
      setSaveOk(false);
      setBookEditorOpen(false);
    }
  }, [fp]);

  const bookEditing = enableBookEdit && bookEditorOpen;

  const displayHoldings = useMemo(() => {
    if (!bookEditing) return holdings;
    return holdings.map((h) => {
      const d = draft[h.symbol];
      if (!d) return h;
      const sh = parseBookNumber(d.shares);
      const av = parseBookNumber(d.avg);
      const tot = parseBookNumber(d.total);
      if (sh === null || av === null || tot === null) return h;
      if (!(sh > 0) || av < 0 || tot < 0) return h;
      // Break-even must follow the edited average so the preview's unrealized P/L
      // uses the same formula as the live row, `(LTP − breakEvenPrice) × shares`.
      const breakEvenPrice = calculateBreakEvenPrice(av);
      const unrealizedPl =
        h.marketLtp !== null && Number.isFinite(h.marketLtp)
          ? (h.marketLtp - breakEvenPrice) * sh
          : null;
      return {
        ...h,
        shares: sh,
        avgPrice: av,
        totalCost: tot,
        breakEvenPrice,
        unrealizedPl,
      };
    });
  }, [holdings, draft, bookEditing]);

  const summary = useMemo(
    () => summaryFromRows(displayHoldings, totalRealizedBdt, totalCashAdjustmentsBdt),
    [displayHoldings, totalRealizedBdt, totalCashAdjustmentsBdt],
  );
  const {
    totalInvested: totalInvestedComputed,
    unrealizedGainLoss: totalUnrealized,
    cashAdjustments: totalCashAdjustments,
    withQuote,
    positions,
  } = summary;
  // Prefer the server-provided invested total when nothing is being edited so
  // we honour any rounding/aggregation done server-side; while editing, fall
  // back to the rows-derived total which reflects the draft.
  const totalInvestedDisplay = bookEditing ? totalInvestedComputed : totalInvestedBdt;

  const data: Row[] = useMemo(() => {
    const q = symbolQuery.trim().toUpperCase();
    const filtered = displayHoldings.filter(
      (h) => !q || h.symbol.toUpperCase().includes(q),
    );
    return groupBySector(filtered);
  }, [displayHoldings, symbolQuery]);

  const patchDraft = useCallback(
    (symbol: string, field: keyof BookDraft, value: string) => {
      if (!bookEditing) return;
      setDirty(true);
      setSaveOk(false);
      setSaveError(null);
      setDraft((prev) => {
        const base = holdings.find((h) => h.symbol === symbol);
        if (!base) return prev;
        const cur = prev[symbol] ?? {
          shares: formatPlainNumberMax2Decimals(base.shares),
          avg: formatPlainNumberMax2Decimals(base.avgPrice),
          total: formatPlainNumberMax2Decimals(base.totalCost),
        };
        const next: BookDraft = { ...cur, [field]: value };

        const sharesFallback = parseBookNumber(next.shares) ?? base.shares;

        if (field === "avg") {
          const newAvg = parseBookNumber(value);
          if (newAvg !== null && sharesFallback > 0) {
            const t = Math.round(newAvg * sharesFallback * 100) / 100;
            next.total = formatPlainNumberMax2Decimals(t);
          }
        } else if (field === "total") {
          const newTot = parseBookNumber(value);
          if (newTot !== null && sharesFallback > 0) {
            const a = Math.round((newTot / sharesFallback) * 100) / 100;
            next.avg = formatPlainNumberMax2Decimals(a);
          }
        } else if (field === "shares") {
          const newSh = parseBookNumber(value);
          if (newSh !== null && newSh > 0) {
            const avgForTot = parseBookNumber(next.avg) ?? base.avgPrice;
            const t = Math.round(newSh * avgForTot * 100) / 100;
            next.total = formatPlainNumberMax2Decimals(t);
          }
        }

        return { ...prev, [symbol]: next };
      });
    },
    [bookEditing, holdings],
  );

  function buildPayload(): { ok: true; rows: PortfolioSaveRow[] } | { ok: false; message: string } {
    const rows: PortfolioSaveRow[] = [];
    for (const h of holdings) {
      const d = draft[h.symbol];
      const shares = d ? parseBookNumber(d.shares) : h.shares;
      const avgPrice = d ? parseBookNumber(d.avg) : h.avgPrice;
      const totalCost = d ? parseBookNumber(d.total) : h.totalCost;
      if (shares === null || avgPrice === null || totalCost === null) {
        return { ok: false, message: `${h.symbol}: enter valid numbers for shares, average cost, and total.` };
      }
      rows.push({ symbol: h.symbol, shares, avgPrice, totalCost });
    }
    return { ok: true, rows };
  }

  async function handleSaveBook() {
    setSaveError(null);
    setSaveOk(false);
    const built = buildPayload();
    if (!built.ok) {
      setSaveError(built.message);
      return;
    }
    setSaving(true);
    try {
      const res = await savePortfolioPositions(built.rows);
      if (res.error) {
        setSaveError(res.error);
        return;
      }
      setSaveOk(true);
      setDirty(false);
      setDraft({});
      setBookEditorOpen(false);
      await onAfterBookSave?.();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<Row> = useMemo(() => {
    // Sector header rows span the full table width; the other columns return
    // a zero colSpan so antd hides them for header rows only.
    const headerCellHidden = (record: Row) =>
      record.isHeader ? { colSpan: 0 as const } : {};

    const avgCol: ColumnsType<Row>[0] = bookEditing
      ? {
        title: "Average cost / share",
        key: "avgPrice",
        width: 132,
        align: "right",
        onCell: headerCellHidden,
        render: (_: unknown, row) => {
          if (row.isHeader) return null;
          return (
            <input
              aria-label={`${row.symbol} average cost per share`}
              className={bookInputClass}
              value={draft[row.symbol]?.avg ?? formatPlainNumberMax2Decimals(row.avgPrice)}
              onChange={(e) => patchDraft(row.symbol, "avg", e.target.value)}
            />
          );
        },
      }
      : {
        title: "Average cost / share",
        key: "avgPrice",
        width: 128,
        align: "right",
        responsive: ["sm"],
        onCell: headerCellHidden,
        render: (_: unknown, row) => {
          if (row.isHeader) return null;
          return (
            <span className="tabular-nums text-[15px] font-normal">{formatBdt(row.avgPrice)}</span>
          );
        },
      };

    const sharesCol: ColumnsType<Row>[0] = bookEditing
      ? {
        title: "Shares",
        key: "shares",
        width: 96,
        align: "right",
        onCell: headerCellHidden,
        render: (_: unknown, row) => {
          if (row.isHeader) return null;
          return (
            <input
              aria-label={`${row.symbol} shares`}
              className={bookInputClass}
              value={draft[row.symbol]?.shares ?? formatPlainNumberMax2Decimals(row.shares)}
              onChange={(e) => patchDraft(row.symbol, "shares", e.target.value)}
            />
          );
        },
      }
      : {
        title: "Shares",
        key: "shares",
        width: 80,
        align: "right",
        responsive: ["sm"],
        onCell: headerCellHidden,
        render: (_: unknown, row) => {
          if (row.isHeader) return null;
          return (
            <span className="tabular-nums text-[15px] font-normal">
              {formatNumberMax2Decimals(row.shares)}
            </span>
          );
        },
      };

    const totalCol: ColumnsType<Row>[0] = bookEditing
      ? {
        title: "Total invested",
        key: "totalCost",
        width: 120,
        align: "right",
        onCell: headerCellHidden,
        render: (_: unknown, row) => {
          if (row.isHeader) return null;
          return (
            <input
              aria-label={`${row.symbol} total invested`}
              className={bookInputClass}
              value={draft[row.symbol]?.total ?? formatPlainNumberMax2Decimals(row.totalCost)}
              onChange={(e) => patchDraft(row.symbol, "total", e.target.value)}
            />
          );
        },
      }
      : {
        title: "Total invested",
        key: "totalCost",
        width: 112,
        align: "right",
        responsive: ["md"],
        onCell: headerCellHidden,
        render: (_: unknown, row) => {
          if (row.isHeader) return null;
          return (
            <span className="tabular-nums text-[15px] font-normal">{formatBdt(row.totalCost)}</span>
          );
        },
      };

    return [
      {
        title: "Symbol",
        key: "symbol",
        width: 88,
        align: "left",
        onCell: (record: Row) =>
          record.isHeader ? { colSpan: 4 as const } : {},
        render: (_: unknown, row) => {
          if (row.isHeader) {
            return (
              <div className="flex items-baseline gap-2 py-1 text-left">
                <span className="text-[12px] font-normal uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">
                  {row.sector}
                </span>
                <span className="text-[11px] font-normal tabular-nums text-zinc-500 dark:text-zinc-400">
                  {row.count} {row.count === 1 ? "position" : "positions"}
                </span>
              </div>
            );
          }
          return (
            <span className="font-mono text-[15px] font-normal text-zinc-50">
              {row.symbol}
            </span>
          );
        },
      },
      {
        title: "Break-even",
        key: "breakEvenPrice",
        width: 100,
        align: "right",
        onCell: headerCellHidden,
        render: (_: unknown, row) => {
          if (row.isHeader) return null;
          return (
            <span className="tabular-nums text-[15px] font-normal">
              {formatBdt(row.breakEvenPrice)}
            </span>
          );
        },
      },
      sharesCol,
      totalCol,
    ];
  }, [bookEditing, draft, patchDraft]);

  return (
    <Card
      variant="outlined"
      className="w-full min-w-0 overflow-x-auto overflow-y-hidden rounded-2xl border border-teal-200/50 bg-white/75 shadow-xl shadow-teal-950/[0.07] ring-1 ring-black/[0.04] backdrop-blur-md dark:border-teal-900/35 dark:bg-zinc-900/65 dark:shadow-black/40 dark:ring-white/[0.06]"
      styles={{ body: { padding: 0 } }}
    >
      <div className="grid grid-cols-2 gap-2 border-b border-teal-100/80 px-3 py-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3 sm:px-4 dark:border-teal-900/40">
        <div className="min-w-0 rounded-xl border border-teal-200/70 bg-teal-50/40 px-3 py-2 text-center shadow-sm sm:min-w-[10.5rem] sm:max-w-[13rem] sm:flex-1 dark:border-teal-800/50 dark:bg-teal-950/25">
          <div className="text-[15px] font-normal tracking-normal text-zinc-50">
            Total invested
          </div>
          <div className="mt-0.5 text-[15px] font-normal tabular-nums text-zinc-50">
            {formatBdt(totalInvestedDisplay)}
          </div>
        </div>

        <div className="w-full min-w-0 rounded-xl border border-teal-200/70 bg-teal-50/40 px-3 py-2 text-center shadow-sm sm:min-w-[10.5rem] sm:max-w-[13rem] sm:flex-1 dark:border-teal-800/50 dark:bg-teal-950/25">
          <div className="text-[15px] font-normal tracking-normal text-zinc-50">
            Realized G/L
          </div>
          <div className="mt-0.5 min-h-[1.25rem]">
            <PlIndicator value={totalRealizedBdt + totalCashAdjustments} />
          </div>
        </div>

      </div>

      <div className="flex flex-col gap-2 border-b border-teal-100/80 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4 dark:border-teal-900/40">
        <Space wrap className="w-full min-w-0 [&_.ant-space-item]:w-full sm:w-auto sm:[&_.ant-space-item]:w-auto">
          <Search
            allowClear
            placeholder="Search symbol…"
            value={symbolQuery}
            onChange={(e) => setSymbolQuery(e.target.value)}
            className="w-full max-w-full sm:max-w-sm"
            size="middle"
          />
        </Space>
        {enableBookEdit ? (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {!bookEditorOpen ? (
              <Button type="default" size="middle" className="w-full sm:w-auto" onClick={() => setBookEditorOpen(true)}>
                Edit book
              </Button>
            ) : (
              <Button
                type="default"
                size="middle"
                className="w-full sm:w-auto"
                disabled={saving}
                onClick={() => {
                  setBookEditorOpen(false);
                  setDraft({});
                  setDirty(false);
                  setSaveError(null);
                  setSaveOk(false);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {/* Mobile (< md): compact card list — touch-friendly, no horizontal scroll. */}
      <div className="md:hidden">
        {data.length === 0 ? (
          <div className="px-4 py-10 text-center text-[14px] text-zinc-50">
            {symbolQuery.trim()
              ? "No symbols match your search."
              : "No positions yet."}
          </div>
        ) : (
          <ul className="mobile-card-list px-3 py-2">
            {data.map((row) =>
              row.isHeader ? (
                <li key={row.key} className="px-1 pb-1 pt-3 first:pt-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12px] font-normal uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">
                      {row.sector}
                    </span>
                    <span className="text-[11px] font-normal tabular-nums text-zinc-500 dark:text-zinc-400">
                      {row.count} {row.count === 1 ? "position" : "positions"}
                    </span>
                  </div>
                </li>
              ) : (
                <MobileHoldingCard key={row.key} row={row} />
              ),
            )}
          </ul>
        )}
      </div>

      {/* Desktop (≥ md): full Ant Design table. */}
      <div className="hidden md:block">
        <Table<Row>
          key={bookEditorOpen ? "portfolio-book-edit" : "portfolio-book-view"}
          className="portfolio-holdings-table"
          columns={columns}
          dataSource={data}
          scroll={{ x: "max-content" }}
          pagination={tablePagination("positions", {
            hideOnSinglePage: false,
            pageSize: 15,
            pageSizeOptions: [10, 15, 20, 50],
          })}
          size="middle"
          bordered={false}
          tableLayout="auto"
          locale={{
            emptyText: symbolQuery.trim() ? "No symbols match your search." : undefined,
          }}
        />
      </div>

      {bookEditing ? (
        <div className="space-y-3 border-t border-teal-100/80 px-3 py-4 sm:px-4 dark:border-teal-900/40">
          <p className="text-left text-[15px] font-normal leading-relaxed text-zinc-50">
            Edit shares, average cost, and total invested for any row. Changing average updates total (and the other way
            around); changing shares keeps average and updates total. You can save even if total and shares × average differ
            slightly (e.g. fees or rounding). If all three match your transaction ledger, the manual override for that
            symbol is removed.
          </p>
          {saveError ? (
            <Alert type="error" showIcon title={saveError} className="text-left" />
          ) : null}
          {saveOk ? (
            <Alert type="success" showIcon title="Portfolio book values saved." className="text-left" />
          ) : null}
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="primary" size="large" className="w-full sm:w-auto" loading={saving} disabled={!dirty || saving} onClick={() => void handleSaveBook()}>
              Save portfolio book values
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function MobileHoldingCard({
  row,
}: {
  row: DataRow;
}) {
  return (
    <li>
      <article
        className="flex flex-col gap-2 rounded-xl border border-zinc-200/70 border-l-[4px] border-l-teal-500/40 bg-white/85 px-3 py-3 text-left shadow-sm dark:border-zinc-800/80 dark:border-l-teal-400/40 dark:bg-zinc-900/70"
      >
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[15px] font-medium text-zinc-900 dark:text-zinc-50">
              {row.symbol}
            </span>
          </div>
          <span className="font-mono text-[14px] tabular-nums text-zinc-700 dark:text-zinc-200">
            {formatNumberMax2Decimals(row.shares)} sh
          </span>
        </header>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Invested</dt>
            <dd className="font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatBdt(row.totalCost)}
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-zinc-500 dark:text-zinc-400">Break-even</dt>
            <dd className="font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatBdt(row.breakEvenPrice)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Avg cost</dt>
            <dd className="font-mono tabular-nums text-zinc-700 dark:text-zinc-200">
              {formatBdt(row.avgPrice)}
            </dd>
          </div>
        </dl>
      </article>
    </li>
  );
}
