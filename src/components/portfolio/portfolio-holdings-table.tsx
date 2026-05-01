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
import { tablePagination } from "@/lib/table-pagination";
import type { PortfolioMarketRow } from "@/lib/market/portfolio-with-quotes";
import {
  WATCHLIST_CLASS_FILTER_OPTIONS,
  type WatchlistClassFilter,
  type WatchlistClassification,
} from "@/lib/watchlist-classification";
import { Alert, Button, Card, Input, Select, Space, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Row = PortfolioMarketRow & { key: string };

type BookDraft = { shares: string; avg: string; total: string };

const { Search } = Input;

const biasLineColumnTitle = (
  <span className="block whitespace-normal text-right text-[15px] font-normal leading-snug">
    Bias Line
    <span className="block pt-0.5 text-[15px] font-normal normal-case text-zinc-50">
      (Buy Above / Sell Below)
    </span>
  </span>
);

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

function unrealizedTotals(rows: PortfolioMarketRow[]) {
  let sum = 0;
  let withQuote = 0;
  for (const h of rows) {
    const pl = h.unrealizedPl;
    if (pl !== null && Number.isFinite(pl)) {
      sum += pl;
      withQuote += 1;
    }
  }
  return { sum, withQuote, positions: rows.length };
}

function fmtPivotCell(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) {
    return <span className="text-zinc-50">—</span>;
  }
  return <span className="tabular-nums">{formatNumberMax2Decimals(n)}</span>;
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
  pick: (r: Row) => number | null | undefined,
): (a: Row, b: Row) => number {
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

function rowMeetsClassFilter(c: WatchlistClassification, filter: WatchlistClassFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "CLASSIFIED") return c === "BLUE" || c === "GREEN";
  if (filter === "NONE") return c === null;
  return c === filter;
}

function ClassificationDot({ c }: { c: WatchlistClassification }) {
  if (c === "BLUE") {
    return (
      <span
        title="Blue chip"
        className="inline-block h-2 w-2 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400"
      />
    );
  }
  if (c === "GREEN") {
    return (
      <span
        title="Green chip"
        className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-400"
      />
    );
  }
  return null;
}

export function PortfolioHoldingsTable({
  holdings,
  totalRealizedBdt = 0,
  totalInvestedBdt = 0,
  classificationMap = {},
  enableBookEdit = false,
  onAfterBookSave,
}: {
  holdings: PortfolioMarketRow[];
  /** Sell-only net: Σ (sell price − avg at sell) × qty − sell fees (from ledger). */
  totalRealizedBdt?: number;
  /** Ledger-based invested amount: buys add, sells deduct cost basis. */
  totalInvestedBdt?: number;
  classificationMap?: Record<string, WatchlistClassification>;
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
  const [classFilter, setClassFilter] = useState<WatchlistClassFilter>("ALL");

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
      const unrealizedPl =
        h.marketLtp !== null && Number.isFinite(h.marketLtp)
          ? (h.marketLtp - av) * sh
          : null;
      return { ...h, shares: sh, avgPrice: av, totalCost: tot, unrealizedPl };
    });
  }, [holdings, draft, bookEditing]);

  const { sum: totalUnrealized, withQuote, positions } = unrealizedTotals(displayHoldings);

  const data: Row[] = useMemo(() => {
    const q = symbolQuery.trim().toUpperCase();
    return displayHoldings
      .filter((h) => {
        const c = classificationMap[h.symbol] ?? null;
        if (!rowMeetsClassFilter(c, classFilter)) return false;
        return !q || h.symbol.toUpperCase().includes(q);
      })
      .map((h) => ({ ...h, key: h.symbol }));
  }, [displayHoldings, symbolQuery, classFilter, classificationMap]);

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
    const avgCol: ColumnsType<Row>[0] = bookEditing
      ? {
        title: "Average cost / share",
        key: "avgPrice",
        width: 132,
        align: "right",
        render: (_: unknown, row) => (
          <input
            aria-label={`${row.symbol} average cost per share`}
            className={bookInputClass}
            value={draft[row.symbol]?.avg ?? formatPlainNumberMax2Decimals(row.avgPrice)}
            onChange={(e) => patchDraft(row.symbol, "avg", e.target.value)}
          />
        ),
      }
      : {
        title: "Average cost / share",
        key: "avgPrice",
        width: 128,
        align: "right",
        responsive: ["sm"],
        sorter: (a, b) => a.avgPrice - b.avgPrice,
        showSorterTooltip: { title: "Sort by average cost" },
        render: (_: unknown, row) => (
          <span className="tabular-nums text-[15px] font-normal">{formatBdt(row.avgPrice)}</span>
        ),
      };

    const sharesCol: ColumnsType<Row>[0] = bookEditing
      ? {
        title: "Shares",
        dataIndex: "shares",
        width: 96,
        align: "right",
        render: (_: unknown, row) => (
          <input
            aria-label={`${row.symbol} shares`}
            className={bookInputClass}
            value={draft[row.symbol]?.shares ?? formatPlainNumberMax2Decimals(row.shares)}
            onChange={(e) => patchDraft(row.symbol, "shares", e.target.value)}
          />
        ),
      }
      : {
        title: "Shares",
        dataIndex: "shares",
        width: 80,
        align: "right",
        responsive: ["sm"],
        sorter: (a, b) => a.shares - b.shares,
        showSorterTooltip: { title: "Sort by shares" },
        render: (v: number) => (
          <span className="tabular-nums text-[15px] font-normal">{formatNumberMax2Decimals(v)}</span>
        ),
      };

    const totalCol: ColumnsType<Row>[0] = bookEditing
      ? {
        title: "Total invested",
        dataIndex: "totalCost",
        width: 120,
        align: "right",
        render: (_: unknown, row) => (
          <input
            aria-label={`${row.symbol} total invested`}
            className={bookInputClass}
            value={draft[row.symbol]?.total ?? formatPlainNumberMax2Decimals(row.totalCost)}
            onChange={(e) => patchDraft(row.symbol, "total", e.target.value)}
          />
        ),
      }
      : {
        title: "Total invested",
        dataIndex: "totalCost",
        width: 112,
        align: "right",
        responsive: ["md"],
        sorter: (a, b) => a.totalCost - b.totalCost,
        showSorterTooltip: { title: "Sort by total invested" },
        render: (_: unknown, row) => (
          <span className="tabular-nums text-[15px] font-normal">{formatBdt(row.totalCost)}</span>
        ),
      };

    return [
      {
        title: "Symbol",
        dataIndex: "symbol",
        width: 88,
        align: "left",
        ...(!bookEditing
          ? {
            sorter: (a: Row, b: Row) => a.symbol.localeCompare(b.symbol),
            showSorterTooltip: { title: "Sort by symbol" },
          }
          : {}),
        render: (v: string) => (
          <span className="flex items-center gap-1.5">
            <ClassificationDot c={classificationMap[v] ?? null} />
            <span className="font-mono text-[15px] font-normal text-zinc-50">
              {v}
            </span>
          </span>
        ),
      },
      {
        title: "Break-even",
        dataIndex: "breakEvenPrice",
        width: 100,
        align: "right",
        ...(!bookEditing
          ? {
            sorter: (a: Row, b: Row) => a.breakEvenPrice - b.breakEvenPrice,
            showSorterTooltip: { title: "Sort by break-even price" },
          }
          : {}),
        render: (v: number) => (
          <span className="tabular-nums text-[15px] font-normal">{formatBdt(v)}</span>
        ),
      },
      sharesCol,
      totalCol,
      {
        title: "Unrealized P/L",
        dataIndex: "unrealizedPl",
        width: 118,
        align: "right",
        responsive: ["sm"],
        ...(!bookEditing
          ? {
            sorter: sortNullableNumber((r) => r.unrealizedPl),
            showSorterTooltip: { title: "Sort by unrealized P/L" },
          }
          : {}),
        render: (v: number | null) =>
          v === null ? (
            <span className="text-zinc-50">—</span>
          ) : (
            <PlIndicator value={v} />
          ),
      },
      {
        title: "Last price (DSE)",
        dataIndex: "marketLtp",
        width: 118,
        align: "right",
        responsive: ["md"],
        ...(!bookEditing
          ? {
            sorter: sortNullableNumber((r) => r.marketLtp),
            showSorterTooltip: { title: "Sort by last price" },
          }
          : {}),
        render: (v: number | null) =>
          v === null ? (
            <span className="text-zinc-50">—</span>
          ) : (
            <span className="tabular-nums text-[15px] font-normal">{formatBdt(v)}</span>
          ),
      },
      {
        title: biasLineColumnTitle,
        key: "pivot",
        width: 132,
        align: "right",
        responsive: ["lg"],
        ...(!bookEditing
          ? {
            sorter: sortNullableNumber((r) => r.pivot?.pivot),
            showSorterTooltip: { title: "Sort by bias line (floor pivot)" },
          }
          : {}),
        render: (_: unknown, row) => fmtPivotCell(row.pivot?.pivot ?? null),
      },
      {
        title: "First Buy Zone",
        key: "s1",
        width: 120,
        align: "right",
        responsive: ["lg"],
        ...(!bookEditing
          ? {
            sorter: sortNullableNumber((r) => r.pivot?.s1),
            showSorterTooltip: { title: "Sort by first buy zone (S1)" },
          }
          : {}),
        render: (_: unknown, row) => fmtPivotCell(row.pivot?.s1 ?? null),
      },
      {
        title: "Strong Sell Zone",
        key: "r2",
        width: 128,
        align: "right",
        responsive: ["xl"],
        ...(!bookEditing
          ? {
            sorter: sortNullableNumber((r) => r.pivot?.r2),
            showSorterTooltip: { title: "Sort by strong sell zone (R2)" },
          }
          : {}),
        render: (_: unknown, row) => fmtPivotCell(row.pivot?.r2 ?? null),
      },
    ];
  }, [bookEditing, classificationMap, draft, patchDraft]);

  return (
    <Card
      variant="outlined"
      className="w-full min-w-0 overflow-x-auto overflow-y-hidden rounded-2xl border border-teal-200/50 bg-white/75 shadow-xl shadow-teal-950/[0.07] ring-1 ring-black/[0.04] backdrop-blur-md dark:border-teal-900/35 dark:bg-zinc-900/65 dark:shadow-black/40 dark:ring-white/[0.06]"
      styles={{ body: { padding: 0 } }}
    >
      <div className="flex flex-col gap-2 border-b border-teal-100/80 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-3 sm:px-4 dark:border-teal-900/40">
        <div className="w-full min-w-0 rounded-xl border border-teal-200/70 bg-teal-50/40 px-3 py-2 text-center shadow-sm sm:min-w-[10.5rem] sm:max-w-[13rem] sm:flex-1 dark:border-teal-800/50 dark:bg-teal-950/25">
          <div className="text-[15px] font-normal tracking-normal text-zinc-50">
            Total unrealized P/L
          </div>
          <div className="mt-0.5 min-h-[1.25rem]">
            {withQuote === 0 ? (
              <span className="text-[15px] font-normal text-zinc-50">
                —
              </span>
            ) : (
              <PlIndicator value={totalUnrealized} />
            )}
          </div>
          {withQuote > 0 && withQuote < positions ? (
            <span className="mt-0.5 block text-[15px] font-normal leading-snug text-zinc-50">
              {withQuote}/{positions} with last price
            </span>
          ) : null}
          {withQuote === 0 && positions > 0 ? (
            <span className="mt-0.5 block text-[15px] font-normal leading-snug text-zinc-50">
              Needs DSE last price
            </span>
          ) : null}
        </div>

        <div className="w-full min-w-0 rounded-xl border border-teal-200/70 bg-teal-50/40 px-3 py-2 text-center shadow-sm sm:min-w-[10.5rem] sm:max-w-[15rem] sm:flex-1 dark:border-teal-800/50 dark:bg-teal-950/25">
          <div className="text-[15px] font-normal tracking-normal text-zinc-50">
            Net Gain/Loss
          </div>
          <div className="mt-0.5 min-h-[1.25rem]">
            <PlIndicator value={totalRealizedBdt} />
          </div>
        </div>

        <div className="w-full min-w-0 rounded-xl border border-teal-200/70 bg-teal-50/40 px-3 py-2 text-center shadow-sm sm:min-w-[10.5rem] sm:max-w-[13rem] sm:flex-1 dark:border-teal-800/50 dark:bg-teal-950/25">
          <div className="text-[15px] font-normal tracking-normal text-zinc-50">
            Total invested
          </div>
          <div className="mt-0.5 text-[15px] font-normal tabular-nums text-zinc-50">
            {formatBdt(totalInvestedBdt)}
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
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            <span className="text-[13px] font-medium text-zinc-50">Filter:</span>
            <Select<WatchlistClassFilter>
              value={classFilter}
              onChange={setClassFilter}
              options={WATCHLIST_CLASS_FILTER_OPTIONS.map((opt) => ({
                ...opt,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    {opt.value === "BLUE" ? (
                      <span className="inline-block h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                    ) : opt.value === "GREEN" ? (
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                    ) : opt.value === "CLASSIFIED" ? (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                      </span>
                    ) : null}
                    {opt.label}
                  </span>
                ),
              }))}
              aria-label="Filter portfolio by chip classification"
              className="w-full min-w-0 sm:min-w-[11rem]"
              size="middle"
            />
          </div>
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
