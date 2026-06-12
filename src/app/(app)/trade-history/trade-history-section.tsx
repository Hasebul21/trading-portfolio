"use client";

import { deleteTransaction } from "@/app/(app)/actions";
import { formatBdt, formatNumberMax2Decimals } from "@/lib/format-bdt";
import type { TransactionRow } from "@/lib/portfolio";
import { Button, Pagination, Popconfirm, Segmented, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

type SideFilter = "all" | "buy" | "sell";
type RangeFilter = "7d" | "30d" | "90d" | "all";

const RANGE_DAYS: Record<RangeFilter, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
};

type Props = {
  rows: TransactionRow[];
  pnlById?: Record<string, number>;
  avgCostById?: Record<string, number>;
  loadError: string | null;
  /** When true, show a 7d/30d/90d/All Segmented picker. */
  rangePicker?: boolean;
};

type Row = TransactionRow & {
  key: string;
  realizedPnl: number | null;
  avgCostAtSell: number | null;
};

type DayHeaderRow = {
  __dayHeader: true;
  key: string;
  dateKey: string;
  label: string;
  count: number;
};

type TableRow = Row | DayHeaderRow;

function isDayHeader(r: TableRow): r is DayHeaderRow {
  return (r as DayHeaderRow).__dayHeader === true;
}

function dhakaDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
}

function friendlyDay(yyyyMmDd: string, nowMs: number): string {
  const todayKey = new Date(nowMs).toLocaleDateString("en-CA", {
    timeZone: "Asia/Dhaka",
  });
  const yesterdayKey = new Date(nowMs - 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Dhaka",
  });
  if (yyyyMmDd === todayKey) return "Today";
  if (yyyyMmDd === yesterdayKey) return "Yesterday";
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Insert day-header rows into a chronologically-ordered page slice. */
function groupByDay(rows: Row[], nowMs: number): TableRow[] {
  const out: TableRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const dayKey = dhakaDayKey(rows[i].created_at);
    let j = i;
    while (j < rows.length && dhakaDayKey(rows[j].created_at) === dayKey) j++;
    out.push({
      __dayHeader: true,
      key: `day-${dayKey}-${i}`,
      dateKey: dayKey,
      label: friendlyDay(dayKey, nowMs),
      count: j - i,
    });
    for (let k = i; k < j; k++) out.push(rows[k]);
    i = j;
  }
  return out;
}

const DESKTOP_COLSPAN = 7;

export function TradeHistorySection({
  rows,
  pnlById,
  avgCostById,
  loadError,
  rangePicker = false,
}: Props) {
  const allData: Row[] = rows.map((r) => ({
    ...r,
    key: r.id,
    realizedPnl:
      pnlById && Object.prototype.hasOwnProperty.call(pnlById, r.id)
        ? pnlById[r.id]
        : null,
    avgCostAtSell:
      avgCostById && Object.prototype.hasOwnProperty.call(avgCostById, r.id)
        ? avgCostById[r.id]
        : null,
  }));
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>(
    rangePicker ? "30d" : "all",
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  // Snapshot "now" once at mount so the filter is deterministic per render.
  // Long-running sessions can hit Refresh to re-evaluate against current time.
  const [nowMs] = useState(() => Date.now());

  const rangedData = useMemo(() => {
    const days = RANGE_DAYS[rangeFilter];
    if (days === null) return allData;
    const cutoff = nowMs - days * 24 * 60 * 60 * 1000;
    return allData.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  }, [allData, rangeFilter, nowMs]);

  const { buyCount, sellCount } = useMemo(() => {
    let buys = 0;
    let sells = 0;
    for (const r of rangedData) {
      if (String(r.side).toLowerCase() === "sell") sells += 1;
      else buys += 1;
    }
    return { buyCount: buys, sellCount: sells };
  }, [rangedData]);

  const data = useMemo(
    () =>
      sideFilter === "all"
        ? rangedData
        : rangedData.filter((r) => String(r.side).toLowerCase() === sideFilter),
    [rangedData, sideFilter],
  );

  const totalRows = data.length;
  // Clamp the visible page so filter changes that shrink the dataset never
  // strand us on an out-of-bounds slice. Setter writes a "page request" —
  // render-time clamp picks the page actually shown.
  const lastPage = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, lastPage);
  const pageRows = useMemo(
    () => data.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [data, currentPage, pageSize],
  );
  const pageTableData = useMemo(
    () => groupByDay(pageRows, nowMs),
    [pageRows, nowMs],
  );

  const onRemove = useCallback(
    async (id: string) => {
      setRemoveError(null);
      setRemovingId(id);
      const res = await deleteTransaction(id);
      setRemovingId(null);
      if (res.error) {
        setRemoveError(res.error);
        return;
      }
      router.refresh();
    },
    [router],
  );

  const columns: ColumnsType<TableRow> = useMemo(
    () => [
      {
        title: "Symbol",
        dataIndex: "symbol",
        align: "left",
        render: (v: string, record) => {
          if (isDayHeader(record)) {
            return {
              children: <DayHeaderCell row={record} />,
              props: { colSpan: DESKTOP_COLSPAN },
            };
          }
          return (
            <Typography.Text strong className="font-mono">
              {String(v).toUpperCase()}
            </Typography.Text>
          );
        },
      },
      {
        title: "Side",
        dataIndex: "side",
        align: "center",
        width: 80,
        render: (v: string, record) => {
          if (isDayHeader(record))
            return { children: null, props: { colSpan: 0 } };
          const isSell = String(v).toLowerCase() === "sell";
          return (
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                isSell
                  ? "bg-[var(--loss-200)] text-[var(--loss-700)]"
                  : "bg-[var(--gain-200)] text-[var(--gain-700)]"
              }`}
            >
              {v}
            </span>
          );
        },
      },
      {
        title: "Qty",
        dataIndex: "quantity",
        align: "right",
        render: (v: string | number, record) => {
          if (isDayHeader(record))
            return { children: null, props: { colSpan: 0 } };
          return (
            <span className="tabular-nums">
              {formatNumberMax2Decimals(Number(v))}
            </span>
          );
        },
      },
      {
        title: "Price",
        dataIndex: "price_per_share",
        align: "right",
        render: (v: string | number, record) => {
          if (isDayHeader(record))
            return { children: null, props: { colSpan: 0 } };
          return (
            <span className="tabular-nums">{formatBdt(Number(v))}</span>
          );
        },
      },
      {
        title: "Total Invested",
        key: "totalInvested",
        align: "right",
        responsive: ["md"],
        render: (_: unknown, record) => {
          if (isDayHeader(record))
            return { children: null, props: { colSpan: 0 } };
          const value =
            Number(record.quantity) * Number(record.price_per_share);
          return (
            <span className="tabular-nums text-[var(--ink-default)]">
              {formatBdt(value)}
            </span>
          );
        },
      },
      {
        title: "P/L",
        dataIndex: "realizedPnl",
        align: "right",
        render: (v: number | null, record) => {
          if (isDayHeader(record))
            return { children: null, props: { colSpan: 0 } };
          if (v === null) {
            return <span className="text-[var(--ink-muted)]">—</span>;
          }
          const cls =
            v > 0
              ? "text-[var(--gain-700)]"
              : v < 0
                ? "text-[var(--loss-700)]"
                : "text-[var(--ink-muted)]";
          return (
            <span className={`tabular-nums ${cls}`}>{formatBdt(v)}</span>
          );
        },
      },
      {
        title: "",
        key: "actions",
        width: 96,
        align: "center",
        render: (_: unknown, record) => {
          if (isDayHeader(record))
            return { children: null, props: { colSpan: 0 } };
          return (
            <Popconfirm
              title="Remove this row?"
              description="Deletes this row. Holdings and Net Gain/Loss will recalc."
              okText="Remove"
              okButtonProps={{ danger: true }}
              cancelText="Cancel"
              onConfirm={() => void onRemove(record.id)}
            >
              <Button
                type="link"
                danger
                size="small"
                loading={removingId === record.id}
                disabled={removingId !== null && removingId !== record.id}
                className="p-0"
              >
                Remove
              </Button>
            </Popconfirm>
          );
        },
      },
    ],
    [onRemove, removingId],
  );

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      {loadError ? (
        <Typography.Paragraph
          type="danger"
          className="rounded-lg bg-[var(--loss-50)] px-3 py-2 "
        >
          {loadError}
        </Typography.Paragraph>
      ) : null}

      {removeError ? (
        <Typography.Paragraph
          type="danger"
          className="rounded-lg bg-[var(--loss-50)] px-3 py-2 "
        >
          {removeError}
        </Typography.Paragraph>
      ) : null}

      {rows.length === 0 ? (
        <Typography.Paragraph type="secondary">
          No trades in this range.
        </Typography.Paragraph>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {rangePicker ? (
                <Segmented<RangeFilter>
                  value={rangeFilter}
                  onChange={(v) => setRangeFilter(v)}
                  options={[
                    { label: "7d", value: "7d" },
                    { label: "30d", value: "30d" },
                    { label: "90d", value: "90d" },
                    { label: "All", value: "all" },
                  ]}
                  size="middle"
                />
              ) : null}
              <Segmented<SideFilter>
                value={sideFilter}
                onChange={(v) => setSideFilter(v)}
                options={[
                  { label: `All (${rangedData.length})`, value: "all" },
                  { label: `Buy (${buyCount})`, value: "buy" },
                  { label: `Sell (${sellCount})`, value: "sell" },
                ]}
                size="middle"
              />
            </div>
            <span className="text-[12px] text-[var(--ink-muted)] tabular-nums">
              Showing {totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, totalRows)} of {totalRows}
            </span>
          </div>

          {data.length === 0 ? (
            <Typography.Paragraph type="secondary">
              No {sideFilter} trades in this range.
            </Typography.Paragraph>
          ) : (
            <>
              {/* Mobile (< md): compact card grid — 2 per row. */}
              <ul className="grid grid-cols-2 gap-2 md:hidden">
                {data.map((row) => (
                  <MobileTradeCard
                    key={row.id}
                    row={row}
                    onRemove={(id) => void onRemove(id)}
                    removingId={removingId}
                  />
                ))}
              </ul>

              {/* Desktop (≥ md): grouped Ant Design table. */}
              <div className="hidden md:flex md:flex-col md:gap-4">
                <Table<TableRow>
                  className="trade-history-table"
                  columns={columns}
                  dataSource={pageTableData}
                  rowClassName={(record) =>
                    isDayHeader(record) ? "trade-day-header-row" : ""
                  }
                  pagination={false}
                  size="middle"
                  bordered
                  tableLayout="auto"
                />
                {totalRows > pageSize ? (
                  <div className="flex justify-end">
                    <Pagination
                      current={currentPage}
                      pageSize={pageSize}
                      total={totalRows}
                      showSizeChanger
                      pageSizeOptions={["10", "15", "20", "50"]}
                      onChange={(p, s) => {
                        setPage(p);
                        setPageSize(s);
                      }}
                      showTotal={(t) => `${t} rows`}
                    />
                  </div>
                ) : null}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function DayHeaderCell({ row }: { row: DayHeaderRow }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--ink-strong)]">
        {row.label}
      </span>
      <span className="text-[11px] text-[var(--ink-muted)] tabular-nums">
        {row.count} {row.count === 1 ? "trade" : "trades"}
      </span>
    </div>
  );
}

function MobileTradeCard({
  row,
  onRemove,
  removingId,
}: {
  row: TransactionRow & {
    key: string;
    id: string;
    realizedPnl: number | null;
    avgCostAtSell: number | null;
  };
  onRemove: (id: string) => void;
  removingId: string | null;
}) {
  const isSell = String(row.side).toLowerCase() === "sell";
  const sideClass = isSell
    ? "bg-[var(--loss-200)] text-[var(--loss-700)] "
    : "bg-[var(--gain-200)] text-[var(--gain-700)] ";

  return (
    <li>
      <article
        className={`flex flex-col gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg-surface)] px-2 py-2 text-left shadow-sm ${
          isSell
            ? "border-l-[3px] border-l-red-500/70 "
            : "border-l-[3px] border-l-emerald-500/70 "
        }`}
      >
        <header className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-[13px] font-medium uppercase text-[var(--ink-strong)] truncate">
              {String(row.symbol).toUpperCase()}
            </span>
            <span
              className={`rounded px-1 py-0.5 text-[10px] font-medium uppercase tracking-wider ${sideClass}`}
            >
              {String(row.side)}
            </span>
          </div>
          <Popconfirm
            title="Remove this row?"
            description="Holdings and Net G/L will recalc."
            okText="Remove"
            okButtonProps={{ danger: true }}
            cancelText="Cancel"
            onConfirm={() => onRemove(row.id)}
          >
            <Button
              type="link"
              danger
              size="small"
              loading={removingId === row.id}
              disabled={removingId !== null && removingId !== row.id}
              className="!h-auto !px-1 !py-0 !text-[11px]"
            >
              Remove
            </Button>
          </Popconfirm>
        </header>

        <dl className="flex flex-col gap-1 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--ink-muted)] ">Qty × Price</dt>
            <dd className="font-mono tabular-nums text-[var(--ink-strong)] ">
              {formatNumberMax2Decimals(Number(row.quantity))} ×{" "}
              {formatBdt(Number(row.price_per_share))}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--ink-muted)] ">P/L</dt>
            <dd
              className={`font-mono tabular-nums ${
                row.realizedPnl === null
                  ? "text-[var(--ink-muted)] "
                  : row.realizedPnl > 0
                    ? "text-[var(--gain-700)] "
                    : row.realizedPnl < 0
                      ? "text-[var(--loss-700)] "
                      : "text-[var(--ink-strong)] "
              }`}
            >
              {row.realizedPnl === null ? "—" : formatBdt(row.realizedPnl)}
            </dd>
          </div>
        </dl>
      </article>
    </li>
  );
}
