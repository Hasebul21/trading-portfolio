"use client";

import {
    removePortfolioPosition,
    restorePortfolioPosition,
    savePortfolioPositions,
    type PortfolioSaveRow,
} from "@/app/(app)/actions";
import {
    formatBdt,
    formatNumberMax2Decimals,
    formatPlainNumberMax2Decimals,
} from "@/lib/format-bdt";
import { calculateBreakEvenPrice, computePortfolioSummary } from "@/lib/portfolio";
import type { PortfolioMarketRow } from "@/lib/market/portfolio-with-quotes";
import { sectorMatchKey } from "@/lib/sector-targets";
import { normalizeSymbol } from "@/lib/sell-plans";
import { Alert, AutoComplete, Button, Popconfirm, Select, Space } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SECTOR_FILTER_ALL = "__all__";

type DataRow = PortfolioMarketRow & { key: string };
type SectorGroup = {
    sector: string;
    items: DataRow[];
    invested: number;
    unrealizedPl: number;
    hasQuote: boolean;
    sharePct: number;
    targetPct: number | null;
};

const SECTOR_FALLBACK = "Unsectorised";

function sectorLabel(s: string | null | undefined): string {
    const t = (s ?? "").trim();
    return t || SECTOR_FALLBACK;
}

type PortfolioSortKey =
    | "default"
    | "invested-desc"
    | "invested-asc"
    | "pl-desc"
    | "pl-asc";

const PORTFOLIO_SORT_OPTIONS: Array<{ value: PortfolioSortKey; label: string }> = [
    { value: "default", label: "Default (invested ↓)" },
    { value: "invested-desc", label: "Invested — high to low" },
    { value: "invested-asc", label: "Invested — low to high" },
    { value: "pl-desc", label: "Unrealized P/L — high to low" },
    { value: "pl-asc", label: "Unrealized P/L — low to high" },
];

function applyPortfolioSort(
    items: PortfolioMarketRow[],
    key: PortfolioSortKey,
): PortfolioMarketRow[] {
    if (key === "default") return items.slice().sort((a, b) => b.totalCost - a.totalCost);
    const dir = key.endsWith("-asc") ? 1 : -1;
    const pick: (r: PortfolioMarketRow) => number | null = key.startsWith("invested")
        ? (r) => (Number.isFinite(r.totalCost) ? r.totalCost : null)
        : (r) => (r.unrealizedPl !== null && Number.isFinite(r.unrealizedPl) ? r.unrealizedPl : null);
    return items.slice().sort((a, b) => {
        const va = pick(a);
        const vb = pick(b);
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        return (va - vb) * dir;
    });
}

/**
 * Group holdings by sector. Each group carries per-sector aggregates
 * (invested, unrealized P/L, share of portfolio) so the banner header can
 * render without re-summing in the render path.
 */
function groupBySector(
    rows: PortfolioMarketRow[],
    totalInvested: number,
    sortKey: PortfolioSortKey = "default",
    sectorTargetsByKey: Record<string, number> = {},
): SectorGroup[] {
    const bySector = new Map<string, PortfolioMarketRow[]>();
    for (const r of rows) {
        const k = sectorLabel(r.sector);
        const list = bySector.get(k) ?? [];
        list.push(r);
        bySector.set(k, list);
    }
    const sectors = [...bySector.keys()].sort((a, b) => {
        if (a === SECTOR_FALLBACK && b !== SECTOR_FALLBACK) return 1;
        if (b === SECTOR_FALLBACK && a !== SECTOR_FALLBACK) return -1;
        return a.localeCompare(b);
    });
    return sectors.map((sector) => {
        const raw = bySector.get(sector)!;
        let invested = 0;
        let unrealizedPl = 0;
        let hasQuote = false;
        for (const r of raw) {
            invested += r.totalCost;
            if (r.unrealizedPl !== null && Number.isFinite(r.unrealizedPl)) {
                unrealizedPl += r.unrealizedPl;
                hasQuote = true;
            }
        }
        const targetRaw = sectorTargetsByKey[sectorMatchKey(sector)];
        return {
            sector,
            invested,
            unrealizedPl,
            hasQuote,
            sharePct: totalInvested > 0 ? (invested / totalInvested) * 100 : 0,
            targetPct:
                typeof targetRaw === "number" && Number.isFinite(targetRaw) ? targetRaw : null,
            items: applyPortfolioSort(raw, sortKey).map((h) => ({ ...h, key: h.symbol })),
        };
    });
}

type BookDraft = { shares: string; avg: string; total: string };

function fmtSignedBdt(n: number) {
    const s = formatBdt(Math.abs(n));
    if (n > 0) return `+${s}`;
    if (n < 0) return `−${s}`;
    return s;
}

function fmtPct(n: number) {
    const sign = n > 0 ? "+" : n < 0 ? "−" : "";
    return `${sign}${Math.abs(n).toFixed(2)}%`;
}

/** Build the four KPI cards for the top strip from currently displayed rows. */
function summaryFromRows(
    rows: PortfolioMarketRow[],
    totalRealizedBdt: number,
    cashAdjustmentsBdt: number,
) {
    const ltpMap = new Map<string, number | null | undefined>();
    for (const h of rows) ltpMap.set(h.symbol, h.marketLtp);
    return computePortfolioSummary(rows, totalRealizedBdt, ltpMap, cashAdjustmentsBdt);
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
    "box-border w-full min-w-[4.5rem] rounded-md border border-[var(--line-strong)] bg-[var(--bg-surface)] px-2 py-1 text-right text-[13px] tabular-nums text-[var(--ink-strong)] outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500";

export function PortfolioHoldingsTable({
    holdings,
    hiddenSymbols = [],
    totalRealizedBdt = 0,
    totalInvestedBdt = 0,
    totalCashAdjustmentsBdt = 0,
    totalCashDividendsBdt = 0,
    sectorTargetsByKey = {},
    sellPlanSymbols = [],
    enableBookEdit = false,
    onAfterBookSave,
}: {
    holdings: PortfolioMarketRow[];
    /** Symbols the user removed from the portfolio — listed in the editor so they can be restored. */
    hiddenSymbols?: string[];
    /** Realized G/L from completed sells: Σ (sell price − avg at sell) × qty. */
    totalRealizedBdt?: number;
    /** Active capital only — buys add, sells deduct cost basis at avg. */
    totalInvestedBdt?: number;
    /** Net of manual cash add/deduct entries from Settings. */
    totalCashAdjustmentsBdt?: number;
    /** Σ of cash dividends recorded under /dividend — rolls into Net P/L. */
    totalCashDividendsBdt?: number;
    /** Per-sector target % (keys are sectorMatchKey-normalised). */
    sectorTargetsByKey?: Record<string, number>;
    /** Symbols in the user's sell plan — flagged with an ↑ arrow. */
    sellPlanSymbols?: string[];
    enableBookEdit?: boolean;
    onAfterBookSave?: () => void | Promise<void>;
}) {
    const sellPlanSet = useMemo(
        () => new Set(sellPlanSymbols.map((s) => normalizeSymbol(s))),
        [sellPlanSymbols],
    );
    const [symbolQuery, setSymbolQuery] = useState("");
    const [sectorFilter, setSectorFilter] = useState<string>(SECTOR_FILTER_ALL);
    const [sortKey, setSortKey] = useState<PortfolioSortKey>("pl-desc");
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
    // Prefer the server-provided invested total when nothing is being edited so
    // we honour any rounding/aggregation done server-side; while editing, fall
    // back to the rows-derived total which reflects the draft.
    const totalInvestedDisplay = bookEditing ? summary.totalInvested : totalInvestedBdt;
    // Cash adjustments (Settings → Cash adjustments) flow directly into the
    // Unrealized P/L card so deposits/dividends/withdrawals visibly nudge the
    // headline number on the portfolio page. Per-position rows and the sector
    // banner keep using mark-to-market only.
    const positionsUnrealized = summary.unrealizedGainLoss;
    const totalUnrealized = positionsUnrealized + summary.cashAdjustments;
    const totalUnrealizedPct =
        totalInvestedDisplay > 0 ? (totalUnrealized / totalInvestedDisplay) * 100 : 0;
    // Net P/L = cumulative realized G/L from every sell in the ledger plus the
    // cash dividends recorded under /dividend. Both are realized cash flows;
    // the sell-side number mirrors the per-row P/L on the Trade History page.
    const netRealizedPl = summary.realizedGainLoss + totalCashDividendsBdt;
    const positionCount = displayHoldings.length;

    // Expected upcoming-year cash dividend across the book. Each row's
    // expectedAnnualDividendBdt is shares × (5y-avg yield %) × LTP from DSE; we
    // re-multiply by `h.shares` here so the figure tracks any draft edits made
    // in the book editor (where `displayHoldings` already reflects the draft).
    const expectedAnnualDividendTotal = displayHoldings.reduce((sum, h) => {
        if (h.divYieldPct !== null && h.divYieldPct > 0 && h.marketLtp !== null && Number.isFinite(h.marketLtp)) {
            return sum + (h.divYieldPct / 100) * h.marketLtp * h.shares;
        }
        return sum;
    }, 0);
    const expectedAnnualDividendPct =
        totalInvestedDisplay > 0 ? (expectedAnnualDividendTotal / totalInvestedDisplay) * 100 : 0;

    const data: SectorGroup[] = useMemo(() => {
        const q = symbolQuery.trim().toUpperCase();
        const filtered = displayHoldings.filter((h) => {
            if (q && !h.symbol.toUpperCase().includes(q)) return false;
            if (sectorFilter !== SECTOR_FILTER_ALL && sectorLabel(h.sector) !== sectorFilter) return false;
            return true;
        });
        return groupBySector(filtered, totalInvestedDisplay, sortKey, sectorTargetsByKey);
    }, [displayHoldings, symbolQuery, sectorFilter, totalInvestedDisplay, sortKey, sectorTargetsByKey]);

    const sectorOptions = useMemo(() => {
        const set = new Set<string>();
        for (const h of displayHoldings) set.add(sectorLabel(h.sector));
        const sorted = Array.from(set).sort((a, b) => {
            if (a === SECTOR_FALLBACK && b !== SECTOR_FALLBACK) return 1;
            if (b === SECTOR_FALLBACK && a !== SECTOR_FALLBACK) return -1;
            return a.localeCompare(b);
        });
        return [
            { value: SECTOR_FILTER_ALL, label: `All sectors (${set.size})` },
            ...sorted.map((s) => ({ value: s, label: s })),
        ];
    }, [displayHoldings]);

    const symbolOptions = useMemo(
        () =>
            [...holdings]
                .map((h) => h.symbol)
                .sort((a, b) => a.localeCompare(b))
                .map((symbol) => ({ value: symbol, label: symbol })),
        [holdings],
    );

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
    }

    const [removingSymbol, setRemovingSymbol] = useState<string | null>(null);
    const [restoringSymbol, setRestoringSymbol] = useState<string | null>(null);

    const handleRemove = useCallback(
        async (symbol: string) => {
            setSaveError(null);
            setSaveOk(false);
            setRemovingSymbol(symbol);
            try {
                const res = await removePortfolioPosition(symbol);
                if (res.error) {
                    setSaveError(res.error);
                    return;
                }
                // Drop any unsaved draft for the removed symbol so the editor
                // doesn't keep stale numbers around if the user toggles back.
                setDraft((prev) => {
                    if (!(symbol in prev)) return prev;
                    const next = { ...prev };
                    delete next[symbol];
                    return next;
                });
                await onAfterBookSave?.();
            } catch (e) {
                setSaveError(e instanceof Error ? e.message : "Remove failed");
            } finally {
                setRemovingSymbol(null);
            }
        },
        [onAfterBookSave],
    );

    const handleRestore = useCallback(
        async (symbol: string) => {
            setSaveError(null);
            setSaveOk(false);
            setRestoringSymbol(symbol);
            try {
                const res = await restorePortfolioPosition(symbol);
                if (res.error) {
                    setSaveError(res.error);
                    return;
                }
                await onAfterBookSave?.();
            } catch (e) {
                setSaveError(e instanceof Error ? e.message : "Restore failed");
            } finally {
                setRestoringSymbol(null);
            }
        },
        [onAfterBookSave],
    );

    const emptyMessage = symbolQuery.trim()
        ? "No symbols match your search."
        : sectorFilter !== SECTOR_FILTER_ALL
            ? "No positions in this sector."
            : "No positions yet.";

    return (
        <div className="flex w-full min-w-0 flex-col gap-6 text-[var(--ink-strong)]">
            {/* KPI strip — 4 cells in a 1px-divided grid. */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-[var(--bg-inset)] md:grid-cols-4">
                <KpiCell label="Total invested">
                    <span className="tabular-nums">{formatBdt(totalInvestedDisplay)}</span>
                </KpiCell>
                <KpiCell label="Unrealized P/L">
                    <span
                        className={`tabular-nums ${totalUnrealized > 0
                            ? "text-[var(--gain-700)]"
                            : totalUnrealized < 0
                                ? "text-[var(--loss-700)]"
                                : ""
                            }`}
                    >
                        {fmtSignedBdt(totalUnrealized)}
                        <span className="ml-2 text-[12px] font-normal opacity-80">
                            {fmtPct(totalUnrealizedPct)}
                        </span>
                    </span>
                </KpiCell>
                <KpiCell label="Net P/L">
                    <span
                        className={`tabular-nums ${netRealizedPl > 0
                            ? "text-[var(--gain-700)]"
                            : netRealizedPl < 0
                                ? "text-[var(--loss-700)]"
                                : ""
                            }`}
                        title="Realized P/L from every sell in your trade history plus cash dividends from /dividend"
                    >
                        {fmtSignedBdt(netRealizedPl)}
                    </span>
                </KpiCell>
                <KpiCell label="Unrealized Dividend">
                    <span
                        className={`tabular-nums ${expectedAnnualDividendTotal > 0
                            ? "text-[var(--gain-700)]"
                            : ""
                            }`}
                        title="Expected upcoming-year cash dividend based on the 5-year average DSE dividend yield × LTP × shares"
                    >
                        {formatBdt(expectedAnnualDividendTotal)}
                        <span className="ml-2 text-[12px] font-normal opacity-80">
                            {fmtPct(expectedAnnualDividendPct)}
                        </span>
                    </span>
                </KpiCell>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col gap-2 border-b border-[var(--line)] pb-3 sm:flex-row sm:items-center sm:justify-between">
                <Space wrap className="w-full min-w-0 [&_.ant-space-item]:w-full sm:w-auto sm:[&_.ant-space-item]:w-auto">
                    <AutoComplete
                        allowClear
                        value={symbolQuery}
                        onChange={(v) => setSymbolQuery(typeof v === "string" ? v : "")}
                        onSelect={(v) => setSymbolQuery(typeof v === "string" ? v : "")}
                        options={symbolOptions}
                        placeholder="Search symbol…"
                        filterOption={(input, option) =>
                            String(option?.value ?? "")
                                .toUpperCase()
                                .includes(input.toUpperCase())
                        }
                        className="w-full max-w-full sm:max-w-sm"
                        size="middle"
                        getPopupContainer={(trigger) =>
                            (trigger.parentElement as HTMLElement) ?? document.body
                        }
                        popupMatchSelectWidth={false}
                        dropdownStyle={{ minWidth: 220, maxHeight: 320, overflow: "auto" }}
                    />
                    <span className="text-[12px] text-[var(--ink-muted)] tabular-nums">
                        {positionCount} {positionCount === 1 ? "position" : "positions"}
                    </span>
                    <Select<string>
                        value={sectorFilter}
                        onChange={(v) => setSectorFilter(v)}
                        options={sectorOptions}
                        size="middle"
                        showSearch
                        optionFilterProp="label"
                        className="w-full sm:w-64"
                        aria-label="Filter by sector"
                    />
                    <Select<PortfolioSortKey>
                        value={sortKey}
                        onChange={(v) => setSortKey(v)}
                        options={PORTFOLIO_SORT_OPTIONS}
                        size="middle"
                        className="w-full sm:w-64"
                        aria-label="Sort holdings"
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

            {data.length === 0 ? (
                <div className="py-10 text-center text-[14px] text-[var(--ink-muted)]">{emptyMessage}</div>
            ) : (
                <div className="flex flex-col gap-6">
                    {data.map((group) => (
                        <SectorCard
                            key={group.sector}
                            group={group}
                            bookEditing={bookEditing}
                            draft={draft}
                            onDraftChange={patchDraft}
                            sellPlanSet={sellPlanSet}
                            onRemoveSymbol={bookEditing ? handleRemove : null}
                            removingSymbol={removingSymbol}
                        />
                    ))}
                </div>
            )}

            {bookEditing ? (
                <div className="space-y-3 border-t border-[var(--line)] pt-4">
                    <p className="text-left text-[13px] leading-relaxed text-[var(--ink-muted)]">
                        Edit shares, average cost, and total invested for any row. Changing average updates total (and the other way
                        around); changing shares keeps average and updates total. You can save even if total and shares × average differ
                        slightly (e.g. fees or rounding). If all three match your transaction ledger, the manual override for that
                        symbol is removed.
                    </p>
                    <p className="text-left text-[13px] leading-relaxed text-[var(--ink-muted)]">
                        Use <span className="font-medium text-[var(--ink-strong)]">Remove</span> on any row to take the stock out of
                        the portfolio view entirely. Trade history is preserved — you can restore the row from the panel below.
                    </p>
                    {saveError ? (
                        <Alert type="error" showIcon title={saveError} className="text-left" />
                    ) : null}
                    {saveOk ? (
                        <Alert type="success" showIcon title="Portfolio book values saved." className="text-left" />
                    ) : null}
                    {hiddenSymbols.length > 0 ? (
                        <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-inset)] p-3">
                            <div className="mb-2 text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">
                                Removed from portfolio ({hiddenSymbols.length})
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {hiddenSymbols
                                    .slice()
                                    .sort((a, b) => a.localeCompare(b))
                                    .map((sym) => (
                                        <div
                                            key={sym}
                                            className="inline-flex items-center gap-2 rounded-md bg-[var(--bg-surface)] px-2 py-1 ring-1 ring-[var(--line)]"
                                        >
                                            <span className="font-mono text-[13px] tracking-tight text-[var(--ink-strong)]">
                                                {sym}
                                            </span>
                                            <Button
                                                size="small"
                                                type="default"
                                                loading={restoringSymbol === sym}
                                                onClick={() => void handleRestore(sym)}
                                            >
                                                Restore
                                            </Button>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ) : null}
                    <div className="flex flex-wrap justify-center gap-2">
                        <Button
                            type="primary"
                            size="large"
                            className="w-full sm:w-auto"
                            loading={saving}
                            disabled={!dirty || saving}
                            onClick={() => void handleSaveBook()}
                        >
                            Save portfolio book values
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

/** One cell of the top KPI grid — white surface, small uppercase label, big value. */
function KpiCell({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="bg-[var(--bg-surface)] px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">{label}</div>
            <div className="mt-0.5 text-[18px] md:text-[20px] tracking-tight">{children}</div>
        </div>
    );
}

/**
 * One sector "card": dark navy banner header (sector name + inline stats),
 * a thin progress bar coloured by sector P/L, then a white card body with
 * one grid row per holding.
 */
function SectorCard({
    group,
    bookEditing,
    draft,
    onDraftChange,
    sellPlanSet,
    onRemoveSymbol,
    removingSymbol,
}: {
    group: SectorGroup;
    bookEditing: boolean;
    draft: Record<string, BookDraft>;
    onDraftChange: (symbol: string, field: keyof BookDraft, value: string) => void;
    sellPlanSet: ReadonlySet<string>;
    onRemoveSymbol: ((symbol: string) => void | Promise<void>) | null;
    removingSymbol: string | null;
}) {
    const sectorPositive = group.unrealizedPl >= 0;
    const sectorAccent = sectorPositive ? "bg-emerald-400" : "bg-rose-400";
    const sectorPlClass = sectorPositive ? "text-[var(--gain-700)]" : "text-[var(--loss-700)]";
    const stockWord = group.items.length === 1 ? "stock" : "stocks";

    return (
        <section>
            {/* Dark navy banner */}
            <div className="overflow-hidden rounded-t-lg border border-b-0 border-[var(--line)] bg-[var(--accent-900)] text-white">
                <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
                    <div className="flex items-center gap-3">
                        <span className={`inline-block h-5 w-1 shrink-0 rounded-full ${sectorAccent}`} />
                        <h2 className="text-[15px] tracking-tight">{group.sector}</h2>
                        <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] tracking-wide text-white/85">
                            {group.items.length} {stockWord}
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] tabular-nums">
                        <BannerStat label="Invested" value={formatBdt(group.invested)} />
                        <BannerStat label="Share of portfolio" value={`${group.sharePct.toFixed(2)}%`} />
                        <BannerStat
                            label="Target"
                            value={group.targetPct !== null ? `${group.targetPct.toFixed(2)}%` : "—"}
                            valueClass={group.targetPct === null ? "text-white/60" : undefined}
                        />
                        <BannerStat
                            label="Unrealized P/L"
                            value={group.hasQuote ? fmtSignedBdt(group.unrealizedPl) : "—"}
                            valueClass={group.hasQuote ? sectorPlClass : "text-white/60"}
                        />
                    </div>
                </div>
                {/* Progress bar = sector share of portfolio. */}
                <div className="h-1 w-full bg-[var(--bg-surface)]">
                    <div
                        className={`h-full ${sectorAccent}`}
                        style={{ width: `${Math.min(100, Math.max(0, group.sharePct))}%` }}
                    />
                </div>
            </div>

            {/* White card body — one grid row per holding. */}
            <div className="overflow-hidden rounded-b-lg border border-[var(--line)] bg-[var(--bg-surface)]">
                {group.items.map((row, i) => (
                    <HoldingRow
                        key={row.key}
                        row={row}
                        isLast={i === group.items.length - 1}
                        bookEditing={bookEditing}
                        draft={draft[row.symbol]}
                        onDraftChange={onDraftChange}
                        inSellPlan={sellPlanSet.has(normalizeSymbol(row.symbol))}
                        onRemove={onRemoveSymbol}
                        removing={removingSymbol === row.symbol}
                    />
                ))}
            </div>
        </section>
    );
}

function BannerStat({
    label,
    value,
    valueClass,
}: {
    label: string;
    value: string;
    valueClass?: string;
}) {
    return (
        <div className="text-left sm:text-right">
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/60">{label}</div>
            <div className={`mt-0.5 text-[14px] tabular-nums text-white ${valueClass ?? ""}`}>
                {value}
            </div>
        </div>
    );
}

/** One holding row — grid on md+, stacked card on mobile. */
function HoldingRow({
    row,
    isLast,
    bookEditing,
    draft,
    onDraftChange,
    inSellPlan,
    onRemove,
    removing,
}: {
    row: DataRow;
    isLast: boolean;
    bookEditing: boolean;
    draft: BookDraft | undefined;
    onDraftChange: (symbol: string, field: keyof BookDraft, value: string) => void;
    /** True when this symbol is in the user's sell plan (Settings → Sell plan). */
    inSellPlan: boolean;
    /** Provided only while editing — clicking Remove drops this symbol from the portfolio. */
    onRemove: ((symbol: string) => void | Promise<void>) | null;
    /** True while this row's removal request is in flight. */
    removing: boolean;
}) {
    const ltpKnown = row.marketLtp !== null && Number.isFinite(row.marketLtp);
    const plKnown = row.unrealizedPl !== null && Number.isFinite(row.unrealizedPl);
    const plPositive = plKnown && (row.unrealizedPl as number) >= 0;
    const plPct = plKnown && row.totalCost > 0
        ? ((row.unrealizedPl as number) / row.totalCost) * 100
        : null;
    const plClass = plKnown
        ? plPositive
            ? "text-[var(--gain-700)]"
            : "text-[var(--loss-700)]"
        : "text-[var(--ink-muted)]";

    const rowBorder = isLast ? "" : "border-b border-[var(--line)]";

    const divKnown =
        row.expectedAnnualDividendBdt !== null && Number.isFinite(row.expectedAnnualDividendBdt);
    const divPct =
        divKnown && row.totalCost > 0
            ? ((row.expectedAnnualDividendBdt as number) / row.totalCost) * 100
            : null;

    return (
        <div
            className={`grid grid-cols-2 items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[1.5fr_repeat(5,1fr)] md:gap-4 md:px-5 md:py-3.5 ${rowBorder}`}
        >
            {/* Symbol + shares */}
            <div className="col-span-2 flex items-center gap-2.5 md:col-span-1">
                <div className="flex flex-col">
                    <span className="flex items-center gap-1.5 font-mono text-[14px] tracking-tight text-[var(--ink-strong)]">
                        {row.symbol}
                        {inSellPlan ? (
                            <span
                                aria-label="In your sell plan"
                                title="Marked for sale — in your sell plan"
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--loss-50)] text-[11px] font-bold leading-none text-[var(--loss-700)] ring-1 ring-[var(--loss-200)]"
                            >
                                ↑
                            </span>
                        ) : null}
                    </span>
                    <span className="text-[11px] text-[var(--ink-muted)] tabular-nums">
                        {formatNumberMax2Decimals(row.shares)} shares
                    </span>
                </div>
            </div>

            {/* Break-even */}
            <RowCell label="Break-even">
                <span className="tabular-nums text-[13px] text-[var(--ink-strong)]">
                    {formatBdt(row.breakEvenPrice)}
                </span>
            </RowCell>

            {/* Last price + 52-week range */}
            <RowCell label="Last price">
                <span className="tabular-nums text-[14px] text-[var(--ink-strong)]">
                    {ltpKnown ? formatBdt(row.marketLtp!) : "—"}
                </span>
                <div
                    className="mt-0.5 text-[11px] tabular-nums text-[var(--ink-muted)]"
                    title="52-week low – high"
                >
                    {row.week52Low !== null ? formatBdt(row.week52Low) : "—"}
                    {" – "}
                    {row.week52High !== null ? formatBdt(row.week52High) : "—"}
                </div>
            </RowCell>

            {/* Invested */}
            <RowCell label="Invested">
                {bookEditing ? (
                    <input
                        aria-label={`${row.symbol} total invested`}
                        className={bookInputClass}
                        value={draft?.total ?? formatPlainNumberMax2Decimals(row.totalCost)}
                        onChange={(e) => onDraftChange(row.symbol, "total", e.target.value)}
                    />
                ) : (
                    <span className="tabular-nums text-[13px] text-[var(--ink-strong)]">
                        {formatBdt(row.totalCost)}
                    </span>
                )}
            </RowCell>

            {/* Unrealized P/L */}
            <RowCell label="Unrealized P/L">
                <div className={`text-[14px] tabular-nums ${plClass}`}>
                    {plKnown ? fmtSignedBdt(row.unrealizedPl as number) : "—"}
                </div>
                {plPct !== null ? (
                    <div className={`text-[11px] tabular-nums opacity-80 ${plClass}`}>
                        {fmtPct(plPct)}
                    </div>
                ) : null}
            </RowCell>

            {/* Unrealized dividend — shares × (DSE-declared yield) × LTP. Null
                when either the yield or live price is unavailable. */}
            <RowCell label="Unrealized Div">
                <div
                    className={`text-[14px] tabular-nums ${divKnown && (row.expectedAnnualDividendBdt as number) > 0
                        ? "text-[var(--gain-700)]"
                        : "text-[var(--ink-strong)]"
                        }`}
                    title={
                        row.divYieldPct !== null && row.divYieldPct > 0
                            ? `5-year average DSE dividend yield ${row.divYieldPct.toFixed(2)}%`
                            : "No dividend yield published"
                    }
                >
                    {divKnown ? formatBdt(row.expectedAnnualDividendBdt as number) : "—"}
                </div>
                {divPct !== null ? (
                    <div className="text-[11px] tabular-nums text-[var(--ink-muted)]">
                        {fmtPct(divPct)}
                    </div>
                ) : null}
            </RowCell>

            {/* Hidden book-edit fields (shares + avg) — surfaced only in edit mode
 as a thin row underneath to keep the read view clean. */}
            {bookEditing ? (
                <div className="col-span-2 mt-1 grid grid-cols-2 gap-2 border-t border-[var(--line)] pt-2 md:col-span-6 md:grid-cols-[1.5fr_repeat(5,1fr)_auto] md:gap-4">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--ink-muted)] md:col-span-1">
                        Edit shares & avg
                    </div>
                    <RowCell label="Shares">
                        <input
                            aria-label={`${row.symbol} shares`}
                            className={bookInputClass}
                            value={draft?.shares ?? formatPlainNumberMax2Decimals(row.shares)}
                            onChange={(e) => onDraftChange(row.symbol, "shares", e.target.value)}
                        />
                    </RowCell>
                    <RowCell label="Avg cost">
                        <input
                            aria-label={`${row.symbol} average cost per share`}
                            className={bookInputClass}
                            value={draft?.avg ?? formatPlainNumberMax2Decimals(row.avgPrice)}
                            onChange={(e) => onDraftChange(row.symbol, "avg", e.target.value)}
                        />
                    </RowCell>
                    {onRemove ? (
                        <div className="col-span-2 flex items-center justify-end md:col-span-1 md:col-start-7">
                            <Popconfirm
                                title={`Remove ${row.symbol} from portfolio?`}
                                description="Trade history is kept. You can restore it from the editor."
                                okText="Remove"
                                okButtonProps={{ danger: true }}
                                cancelText="Cancel"
                                onConfirm={() => void onRemove(row.symbol)}
                            >
                                <Button
                                    danger
                                    size="small"
                                    loading={removing}
                                    aria-label={`Remove ${row.symbol} from portfolio`}
                                >
                                    Remove
                                </Button>
                            </Popconfirm>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

/** One labelled cell inside a holding row. Stacks vertically; right-aligned on md+. */
function RowCell({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="md:text-right">
            <div className="text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">{label}</div>
            <div className="mt-0.5">{children}</div>
        </div>
    );
}
