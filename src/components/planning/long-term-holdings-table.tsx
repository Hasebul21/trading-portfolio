"use client";

import { deleteLongTermHolding } from "@/app/(app)/planning-actions";
import { formatBdt } from "@/lib/format-bdt";
import { AutoComplete, Button, Select } from "antd";
import { useMemo, useState } from "react";

const SECTOR_FILTER_ALL = "__all__";

export type LongTermHoldingRow = {
    id: string;
    created_at: string;
    symbol: string;
    sector: string | null;
    /** Last trade price from DSE (null if not quoted today). */
    ltp: number | null;
    /** 52-week low from the DSE company page (null if not available). */
    week52Low?: number | null;
    /** 52-week high from the DSE company page (null if not available). */
    week52High?: number | null;
    /** Break-even cost from portfolio holdings (null if not held). */
    breakEvenPrice: number | null;
    /** Manual invested override entered on the watchlist. */
    manual_total_invested_bdt?: number | null;
    /** Invested from the actual portfolio book (null if not held). */
    portfolio_total_invested_bdt?: number | null;
    /** Optional alert targets for entry / exit signals. */
    buy_point_bdt?: number | null;
    sell_point_bdt?: number | null;
};

type Row = LongTermHoldingRow & {
    key: string;
    /** Effective invested for this row: manual override → portfolio book → 0. */
    investedBdt: number;
    /** This row's invested as a % of its sector's invested. */
    pctOfSector: number;
    /** This row's invested as a % of total watchlist invested. */
    pctOfPortfolio: number;
};
type SectorGroup = {
    sector: string;
    items: Row[];
    quoted: number;
    buySignals: number;
    sellSignals: number;
};

function rowInvestedBdt(row: LongTermHoldingRow): number {
    const m = row.manual_total_invested_bdt;
    if (typeof m === "number" && Number.isFinite(m)) return m;
    const p = row.portfolio_total_invested_bdt;
    if (typeof p === "number" && Number.isFinite(p)) return p;
    return 0;
}

const SECTOR_FALLBACK = "Unknown";

function sectorLabel(s: string | null | undefined): string {
    const t = (s ?? "").trim();
    return t || SECTOR_FALLBACK;
}

/** A symbol is "in buy zone" when its live LTP is at or below the buy alert. */
function isBuySignal(row: LongTermHoldingRow): boolean {
    if (row.ltp === null || !Number.isFinite(row.ltp)) return false;
    if (row.buy_point_bdt === null || row.buy_point_bdt === undefined) return false;
    return row.ltp <= row.buy_point_bdt;
}

/** A symbol is "in sell zone" when its live LTP is at or above the sell alert. */
function isSellSignal(row: LongTermHoldingRow): boolean {
    if (row.ltp === null || !Number.isFinite(row.ltp)) return false;
    if (row.sell_point_bdt === null || row.sell_point_bdt === undefined) return false;
    return row.ltp >= row.sell_point_bdt;
}

type WatchlistSortKey =
    | "default"
    | "ltp-asc"
    | "ltp-desc"
    | "fromlow-asc"
    | "fromlow-desc"
    | "pct-sector-desc"
    | "pct-sector-asc"
    | "pct-portfolio-desc"
    | "pct-portfolio-asc";

const WATCHLIST_SORT_OPTIONS: Array<{ value: WatchlistSortKey; label: string }> = [
    { value: "default", label: "Default (symbol)" },
    { value: "ltp-desc", label: "LTP — high to low" },
    { value: "ltp-asc", label: "LTP — low to high" },
    { value: "fromlow-desc", label: "From 52w low — high to low" },
    { value: "fromlow-asc", label: "From 52w low — low to high" },
    { value: "pct-sector-desc", label: "% of sector — high to low" },
    { value: "pct-sector-asc", label: "% of sector — low to high" },
    { value: "pct-portfolio-desc", label: "% of portfolio — high to low" },
    { value: "pct-portfolio-asc", label: "% of portfolio — low to high" },
];

function fromLowPctValue(row: LongTermHoldingRow): number | null {
    if (row.ltp === null || !Number.isFinite(row.ltp)) return null;
    if (row.week52Low === null || row.week52Low === undefined) return null;
    if (!Number.isFinite(row.week52Low) || row.week52Low <= 0) return null;
    return ((row.ltp - row.week52Low) / row.week52Low) * 100;
}

function applyWatchlistSort(items: Row[], key: WatchlistSortKey): Row[] {
    if (key === "default") return items;
    const dir = key.endsWith("-asc") ? 1 : -1;
    const pick: (r: Row) => number | null = key.startsWith("ltp")
        ? (r) => (r.ltp !== null && Number.isFinite(r.ltp) ? r.ltp : null)
        : key.startsWith("fromlow")
            ? (r) => fromLowPctValue(r)
            : key.startsWith("pct-sector")
                ? (r) => (r.investedBdt > 0 ? r.pctOfSector : null)
                : (r) => (r.investedBdt > 0 ? r.pctOfPortfolio : null);
    return items.slice().sort((a, b) => {
        const va = pick(a);
        const vb = pick(b);
        // Nulls always sink to the bottom regardless of direction.
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        return (va - vb) * dir;
    });
}

export function LongTermHoldingsTable({ rows }: { rows: LongTermHoldingRow[] }) {
    const [searchText, setSearchText] = useState("");
    const [sectorFilter, setSectorFilter] = useState<string>(SECTOR_FILTER_ALL);
    const [sortKey, setSortKey] = useState<WatchlistSortKey>("default");

    const filteredRows = useMemo(() => {
        const q = searchText.trim().toUpperCase();
        return rows.filter((r) => {
            if (q) {
                const sym = String(r.symbol ?? "").trim().toUpperCase();
                if (!sym.includes(q)) return false;
            }
            if (sectorFilter !== SECTOR_FILTER_ALL && sectorLabel(r.sector) !== sectorFilter) {
                return false;
            }
            return true;
        });
    }, [rows, searchText, sectorFilter]);

    const groups: SectorGroup[] = useMemo(() => {
        // Pre-compute per-sector and total invested so each row carries its
        // share percentages — used both for the symbol subline and the % sort.
        const sectorInvested = new Map<string, number>();
        let portfolioInvested = 0;
        for (const r of filteredRows) {
            const invested = rowInvestedBdt(r);
            if (invested > 0) {
                const skey = sectorLabel(r.sector);
                sectorInvested.set(skey, (sectorInvested.get(skey) ?? 0) + invested);
                portfolioInvested += invested;
            }
        }

        const bySector = new Map<string, Row[]>();
        for (const r of filteredRows) {
            const skey = sectorLabel(r.sector);
            const invested = rowInvestedBdt(r);
            const sectorTotal = sectorInvested.get(skey) ?? 0;
            const pctOfSector = sectorTotal > 0 ? (invested / sectorTotal) * 100 : 0;
            const pctOfPortfolio = portfolioInvested > 0 ? (invested / portfolioInvested) * 100 : 0;
            const list = bySector.get(skey) ?? [];
            list.push({
                ...r,
                key: r.id,
                investedBdt: invested,
                pctOfSector,
                pctOfPortfolio,
            });
            bySector.set(skey, list);
        }
        return Array.from(bySector.entries())
            .sort(([a], [b]) => {
                if (a === SECTOR_FALLBACK) return 1;
                if (b === SECTOR_FALLBACK) return -1;
                return a.localeCompare(b);
            })
            .map(([sector, items]) => {
                const symbolSorted = items
                    .slice()
                    .sort((x, y) => String(x.symbol).localeCompare(String(y.symbol)));
                const sorted = applyWatchlistSort(symbolSorted, sortKey);
                let quoted = 0;
                let buySignals = 0;
                let sellSignals = 0;
                for (const r of sorted) {
                    if (r.ltp !== null && Number.isFinite(r.ltp)) quoted += 1;
                    if (isBuySignal(r)) buySignals += 1;
                    if (isSellSignal(r)) sellSignals += 1;
                }
                return { sector, items: sorted, quoted, buySignals, sellSignals };
            });
    }, [filteredRows, sortKey]);

    const symbolOptions = useMemo(
        () =>
            [...rows]
                .map((r) => r.symbol)
                .sort((a, b) => a.localeCompare(b))
                .map((symbol) => ({ value: symbol, label: symbol })),
        [rows],
    );

    const sectorOptions = useMemo(() => {
        const set = new Set<string>();
        for (const r of rows) set.add(sectorLabel(r.sector));
        const sorted = Array.from(set).sort((a, b) => {
            if (a === SECTOR_FALLBACK && b !== SECTOR_FALLBACK) return 1;
            if (b === SECTOR_FALLBACK && a !== SECTOR_FALLBACK) return -1;
            return a.localeCompare(b);
        });
        return [
            { value: SECTOR_FILTER_ALL, label: `All sectors (${set.size})` },
            ...sorted.map((s) => ({ value: s, label: s })),
        ];
    }, [rows]);

    // Top-level KPI counts.
    const totals = useMemo(() => ({ symbols: filteredRows.length }), [filteredRows]);

    return (
        <div className="flex w-full min-w-0 flex-col gap-6 text-[var(--ink-strong)]">
            {/* Toolbar — always a single row */}
            <div className="flex items-center gap-2 border-b border-[var(--line)] pb-3">
                <AutoComplete
                    allowClear
                    value={searchText}
                    onChange={(v) => setSearchText(typeof v === "string" ? v : "")}
                    onSelect={(v) => setSearchText(typeof v === "string" ? v : "")}
                    options={symbolOptions}
                    placeholder="Search symbol…"
                    filterOption={(input, option) =>
                        String(option?.value ?? "")
                            .toUpperCase()
                            .includes(input.toUpperCase())
                    }
                    className="min-w-0 flex-1"
                    size="middle"
                    getPopupContainer={(trigger) =>
                        (trigger.parentElement as HTMLElement) ?? document.body
                    }
                    popupMatchSelectWidth={false}
                    dropdownStyle={{ minWidth: 220, maxHeight: 320, overflow: "auto" }}
                />
                <span className="hidden shrink-0 rounded-full border border-[var(--line)] bg-[var(--bg-surface-soft)] px-2.5 py-1 text-[11px] tabular-nums text-[var(--ink-muted)] sm:block">
                    {totals.symbols} {totals.symbols === 1 ? "symbol" : "symbols"}
                </span>
                <Select<string>
                    value={sectorFilter}
                    onChange={(v) => setSectorFilter(v)}
                    options={sectorOptions}
                    size="middle"
                    showSearch
                    optionFilterProp="label"
                    className="w-32 shrink-0 sm:w-44"
                    aria-label="Filter by sector"
                />
                <Select<WatchlistSortKey>
                    value={sortKey}
                    onChange={(v) => setSortKey(v)}
                    options={WATCHLIST_SORT_OPTIONS}
                    size="middle"
                    className="w-36 shrink-0 sm:w-56"
                    aria-label="Sort"
                />
            </div>

            {groups.length === 0 ? (
                <div className="py-10 text-center text-[14px] text-[var(--ink-muted)]">
                    {searchText.trim()
                        ? "No symbols match your search."
                        : sectorFilter !== SECTOR_FILTER_ALL
                            ? "No symbols in this sector."
                            : "No symbols yet."}
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {groups.map((group) => (
                        <WatchlistSectorCard key={group.sector} group={group} />
                    ))}
                </div>
            )}
        </div>
    );
}

/** Dark navy banner header + white card body — one section per sector. */
function WatchlistSectorCard({ group }: { group: SectorGroup }) {
    const hasBuySignals = group.buySignals > 0;
    const hasSellSignals = group.sellSignals > 0;
    const accent = hasBuySignals
        ? "bg-emerald-400"
        : hasSellSignals
            ? "bg-rose-400"
            : "bg-zinc-400";
    const symbolWord = group.items.length === 1 ? "symbol" : "symbols";

    return (
        <section>
            {/* Dark navy banner */}
            <div className="overflow-hidden rounded-t-lg border border-b-0 border-[var(--line)] bg-[var(--accent-900)] text-white">
                <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
                    <div className="flex items-center gap-3">
                        <span className={`inline-block h-5 w-1 shrink-0 rounded-full ${accent}`} />
                        <h2 className="text-[15px] tracking-tight">{group.sector}</h2>
                        <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] tracking-wide text-white/85">
                            {group.items.length} {symbolWord}
                        </span>
                    </div>
                </div>
            </div>

            {/* White card body — one grid row per symbol. */}
            <div className="overflow-hidden rounded-b-lg border border-[var(--line)] bg-[var(--bg-surface)]">
                {group.items.map((row, i) => (
                    <WatchlistRow key={row.key} row={row} isLast={i === group.items.length - 1} />
                ))}
            </div>
        </section>
    );
}

/** One watchlist symbol row. */
function WatchlistRow({ row, isLast }: { row: Row; isLast: boolean }) {
    const ltpKnown = row.ltp !== null && Number.isFinite(row.ltp);

    const rowBorder = isLast ? "" : "border-b border-[var(--line)]";

    const fromLowPct =
        ltpKnown &&
        row.week52Low !== null &&
        row.week52Low !== undefined &&
        Number.isFinite(row.week52Low) &&
        row.week52Low > 0
            ? ((row.ltp! - row.week52Low) / row.week52Low) * 100
            : null;
    const fromLowPositive = fromLowPct !== null && fromLowPct >= 0;
    const fromLowClass =
        fromLowPct === null
            ? "text-[var(--ink-muted)]"
            : fromLowPositive
                ? "text-[var(--gain-700)]"
                : "text-[var(--loss-700)]";
    const fmtFromLow = (n: number) => {
        const sign = n > 0 ? "+" : n < 0 ? "−" : "";
        return `${sign}${Math.abs(n).toFixed(2)}%`;
    };

    return (
        <div
            className={`grid grid-cols-2 items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[1.5fr_repeat(3,1fr)_auto] md:gap-4 md:px-5 md:py-3.5 ${rowBorder}`}
        >
            <div className="col-span-2 flex items-center gap-2.5 md:col-span-1">
                <div className="flex min-w-0 flex-col">
                    <span className="font-mono text-[14px] tracking-tight text-[var(--ink-strong)]">
                        {row.symbol}
                    </span>
                    {row.investedBdt > 0 ? (
                        <span
                            className="text-[11px] tabular-nums text-[var(--ink-muted)]"
                            title={`Invested ${formatBdt(row.investedBdt)} · ${row.pctOfPortfolio.toFixed(2)}% of watchlist · ${row.pctOfSector.toFixed(2)}% of sector`}
                        >
                            {row.pctOfPortfolio.toFixed(1)}% port · {row.pctOfSector.toFixed(1)}% sec
                        </span>
                    ) : null}
                </div>
            </div>

            <RowCell label="Break-even">
                <span className="tabular-nums text-[13px] text-[var(--ink-strong)]">
                    {row.breakEvenPrice !== null && Number.isFinite(row.breakEvenPrice)
                        ? formatBdt(row.breakEvenPrice)
                        : "—"}
                </span>
            </RowCell>

            <RowCell label="LTP">
                <span className="tabular-nums text-[14px] text-[var(--ink-strong)]">
                    {ltpKnown ? formatBdt(row.ltp!) : "—"}
                </span>
                <div
                    className="mt-0.5 text-[11px] tabular-nums text-[var(--ink-muted)]"
                    title="52-week low – high"
                >
                    {row.week52Low !== null && row.week52Low !== undefined ? formatBdt(row.week52Low) : "—"}
                    {" – "}
                    {row.week52High !== null && row.week52High !== undefined ? formatBdt(row.week52High) : "—"}
                </div>
            </RowCell>

            <RowCell label="From 52w low">
                <span
                    className={`tabular-nums text-[13px] ${fromLowClass}`}
                    title={
                        fromLowPct === null
                            ? "Needs both LTP and 52w low"
                            : `LTP vs 52-week low (${row.week52Low !== null && row.week52Low !== undefined ? formatBdt(row.week52Low) : "—"})`
                    }
                >
                    {fromLowPct !== null ? fmtFromLow(fromLowPct) : "—"}
                </span>
            </RowCell>

            <div className="col-span-2 flex justify-end md:col-span-1">
                <form action={deleteLongTermHolding} className="inline">
                    <input type="hidden" name="id" value={row.id} />
                    <Button type="link" danger size="small" htmlType="submit">
                        Remove
                    </Button>
                </form>
            </div>
        </div>
    );
}

/** One labelled cell inside a watchlist row. Stacks vertically; right-aligned on md+. */
function RowCell({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="md:text-right">
            <div className="text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">{label}</div>
            <div className="mt-0.5">{children}</div>
        </div>
    );
}
