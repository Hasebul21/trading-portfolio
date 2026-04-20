"use client";

import { savePortfolioPositions, type PortfolioSaveRow } from "@/app/(app)/actions";
import {
  formatBdt,
  formatNumberMax2Decimals,
  formatPlainNumberMax2Decimals,
} from "@/lib/format-bdt";
import { tablePagination } from "@/lib/table-pagination";
import type { PortfolioMarketRow } from "@/lib/market/portfolio-with-quotes";
import { Alert, Button, Card, Input, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Row = PortfolioMarketRow & { key: string };

type BookDraft = { shares: string; avg: string; total: string };

const { Search } = Input;

function fmtSignedBdt(n: number) {
  const s = formatBdt(Math.abs(n));
  if (n > 0) return `+${s}`;
  if (n < 0) return `-${s}`;
  return s;
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

function sumTotalInvested(rows: PortfolioMarketRow[]) {
  let s = 0;
  for (const h of rows) {
    if (Number.isFinite(h.totalCost)) s += h.totalCost;
  }
  return s;
}

function fmtPivotCell(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) {
    return <Typography.Text type="secondary">—</Typography.Text>;
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
  "box-border w-full min-w-[4.5rem] rounded-md border border-zinc-300 bg-white px-2 py-1 text-right text-[13px] tabular-nums text-zinc-900 outline-none ring-teal-500/25 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

export function PortfolioHoldingsTable({
  holdings,
  enableBookEdit = false,
}: {
  holdings: PortfolioMarketRow[];
  enableBookEdit?: boolean;
}) {
  const router = useRouter();
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
      const unrealizedPl =
        h.marketLtp !== null && Number.isFinite(h.marketLtp)
          ? (h.marketLtp - av) * sh
          : null;
      return { ...h, shares: sh, avgPrice: av, totalCost: tot, unrealizedPl };
    });
  }, [holdings, draft, bookEditing]);

  const { sum: totalUnrealized, withQuote, positions } = unrealizedTotals(displayHoldings);
  const totalInvested = sumTotalInvested(displayHoldings);

  const data: Row[] = useMemo(() => {
    const q = symbolQuery.trim().toUpperCase();
    return displayHoldings
      .filter((h) => !q || h.symbol.toUpperCase().includes(q))
      .map((h) => ({ ...h, key: h.symbol }));
  }, [displayHoldings, symbolQuery]);

  function patchDraft(symbol: string, field: keyof BookDraft, value: string) {
    if (!bookEditing) return;
    setDirty(true);
    setSaveOk(false);
    setSaveError(null);
    setDraft((prev) => {
      const base = holdings.find((h) => h.symbol === symbol);
      const cur = prev[symbol] ?? {
        shares: base ? formatPlainNumberMax2Decimals(base.shares) : "",
        avg: base ? formatPlainNumberMax2Decimals(base.avgPrice) : "",
        total: base ? formatPlainNumberMax2Decimals(base.totalCost) : "",
      };
      return {
        ...prev,
        [symbol]: { ...cur, [field]: value },
      };
    });
  }

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
      router.refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<Row> = (() => {
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
          render: (_: unknown, row) => (
            <span className="tabular-nums text-[14px] font-medium">{formatBdt(row.avgPrice)}</span>
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
          render: (v: number) => (
            <span className="tabular-nums text-[14px]">{formatNumberMax2Decimals(v)}</span>
          ),
        };

    const totalCol: ColumnsType<Row>[0] = bookEditing
      ? {
          title: "Total invested",
          dataIndex: "totalCost",
          width: 120,
          align: "right",
          sorter: (a, b) => a.totalCost - b.totalCost,
          defaultSortOrder: "descend",
          showSorterTooltip: { title: "Sort by total invested" },
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
          sorter: (a, b) => a.totalCost - b.totalCost,
          defaultSortOrder: "descend",
          showSorterTooltip: { title: "Sort by total invested" },
          render: (_: unknown, row) => (
            <span className="tabular-nums text-[14px]">{formatBdt(row.totalCost)}</span>
          ),
        };

    return [
      {
        title: "Symbol",
        dataIndex: "symbol",
        width: 88,
        align: "left",
        render: (v: string) => (
          <span className="bg-gradient-to-r from-teal-700 via-emerald-700 to-teal-800 bg-clip-text font-mono text-[15px] font-bold text-transparent dark:from-teal-300 dark:via-emerald-300 dark:to-teal-200">
            {v}
          </span>
        ),
      },
      avgCol,
      sharesCol,
      totalCol,
      {
        title: "Unrealized P/L",
        dataIndex: "unrealizedPl",
        width: 118,
        align: "right",
        render: (v: number | null) =>
          v === null ? (
            <Typography.Text type="secondary">—</Typography.Text>
          ) : (
            <Typography.Text
              type={v >= 0 ? "success" : "danger"}
              className="tabular-nums text-[14px]"
            >
              {fmtSignedBdt(v)}
            </Typography.Text>
          ),
      },
      {
        title: "Last price (DSE)",
        dataIndex: "marketLtp",
        width: 118,
        align: "right",
        render: (v: number | null) =>
          v === null ? (
            <Typography.Text type="secondary">—</Typography.Text>
          ) : (
            <span className="tabular-nums text-[14px]">{formatBdt(v)}</span>
          ),
      },
      {
        title: "Session midpoint",
        key: "pivot",
        width: 108,
        align: "right",
        render: (_: unknown, row) => fmtPivotCell(row.pivot?.pivot ?? null),
      },
      {
        title: "First downside target",
        key: "s1",
        width: 118,
        align: "right",
        render: (_: unknown, row) => fmtPivotCell(row.pivot?.s1 ?? null),
      },
      {
        title: "Second downside target",
        key: "s2",
        width: 128,
        align: "right",
        render: (_: unknown, row) => fmtPivotCell(row.pivot?.s2 ?? null),
      },
      {
        title: "First upside target",
        key: "r1",
        width: 118,
        align: "right",
        render: (_: unknown, row) => fmtPivotCell(row.pivot?.r1 ?? null),
      },
      {
        title: "Second upside target",
        key: "r2",
        width: 128,
        align: "right",
        render: (_: unknown, row) => fmtPivotCell(row.pivot?.r2 ?? null),
      },
    ];
  })();

  return (
    <Card
      variant="outlined"
      className="w-full overflow-hidden rounded-2xl border border-teal-200/50 bg-white/75 shadow-xl shadow-teal-950/[0.07] ring-1 ring-black/[0.04] backdrop-blur-md dark:border-teal-900/35 dark:bg-zinc-900/65 dark:shadow-black/40 dark:ring-white/[0.06]"
      styles={{ body: { padding: 0 } }}
    >
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-teal-100/80 px-3 py-3 sm:gap-3 sm:px-4 dark:border-teal-900/40">
        <div className="min-w-[10.5rem] max-w-[13rem] flex-1 rounded-xl border border-teal-200/70 bg-teal-50/40 px-3 py-2 text-center shadow-sm dark:border-teal-800/50 dark:bg-teal-950/25">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Total unrealized P/L
          </div>
          <div className="mt-0.5 min-h-[1.25rem]">
            {withQuote === 0 ? (
              <Typography.Text type="secondary" className="text-[13px]">
                —
              </Typography.Text>
            ) : (
              <Typography.Text
                type={totalUnrealized >= 0 ? "success" : "danger"}
                className="text-[15px] font-semibold tabular-nums sm:text-base"
              >
                {fmtSignedBdt(totalUnrealized)}
              </Typography.Text>
            )}
          </div>
          {withQuote > 0 && withQuote < positions ? (
            <Typography.Text type="secondary" className="mt-0.5 block text-[10px] leading-tight">
              {withQuote}/{positions} with last price
            </Typography.Text>
          ) : null}
          {withQuote === 0 && positions > 0 ? (
            <Typography.Text type="secondary" className="mt-0.5 block text-[10px] leading-tight">
              Needs DSE last price
            </Typography.Text>
          ) : null}
        </div>

        <div className="min-w-[10.5rem] max-w-[13rem] flex-1 rounded-xl border border-teal-200/70 bg-teal-50/40 px-3 py-2 text-center shadow-sm dark:border-teal-800/50 dark:bg-teal-950/25">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Total invested
          </div>
          <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50 sm:text-base">
            {formatBdt(totalInvested)}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-b border-teal-100/80 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4 dark:border-teal-900/40">
        <Search
          allowClear
          placeholder="Search symbol…"
          value={symbolQuery}
          onChange={(e) => setSymbolQuery(e.target.value)}
          className="max-w-sm"
          size="middle"
        />
        {enableBookEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            {!bookEditorOpen ? (
              <Button type="default" size="middle" onClick={() => setBookEditorOpen(true)}>
                Edit book
              </Button>
            ) : (
              <Button
                type="default"
                size="middle"
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
        className="portfolio-holdings-table"
        columns={columns}
        dataSource={data}
        pagination={tablePagination("positions", { hideOnSinglePage: false })}
        size="middle"
        bordered={false}
        tableLayout="auto"
        locale={{
          emptyText: symbolQuery.trim() ? "No symbols match your search." : undefined,
        }}
      />

      {bookEditing ? (
        <div className="space-y-3 border-t border-teal-100/80 px-3 py-4 sm:px-4 dark:border-teal-900/40">
          <p className="text-left text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Edit shares, average cost, and total invested for any row. Values must satisfy{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">total ≈ shares × average</span>{" "}
            (within 0.06 BDT). If they match your transaction ledger, the manual override for that symbol is removed.
          </p>
          {saveError ? (
            <Alert type="error" showIcon message={saveError} className="text-left" />
          ) : null}
          {saveOk ? (
            <Alert type="success" showIcon message="Portfolio book values saved." className="text-left" />
          ) : null}
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="primary" size="large" loading={saving} disabled={!dirty || saving} onClick={() => void handleSaveBook()}>
              Save portfolio book values
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
