"use client";

import { AppSectionTitle } from "@/components/app-page-header";
import { formatBdt, formatPlainNumberMax2Decimals } from "@/lib/format-bdt";
import { Alert, AutoComplete, Button, Card, DatePicker, Input, InputNumber, Popconfirm, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  createDividend,
  deleteDividend,
  listDividends,
  type DividendRow,
} from "../dividend-actions";

type SummaryRow = { symbol: string; cash: number; shares: number; payouts: number };

export function DividendForm({
  instruments,
  instrumentsError,
  initialRows,
  initialTotalCash,
  initialTotalStockShares,
  initialError,
}: {
  instruments: { symbol: string }[];
  instrumentsError: string | null;
  initialRows: DividendRow[];
  initialTotalCash: number;
  initialTotalStockShares: number;
  initialError: string | null;
}) {
  const [rows, setRows] = useState<DividendRow[]>(initialRows);
  const [totalCash, setTotalCash] = useState(initialTotalCash);
  const [totalStockShares, setTotalStockShares] = useState(initialTotalStockShares);
  const [loadError, setLoadError] = useState<string | null>(initialError);

  const [symbol, setSymbol] = useState("");
  const [cash, setCash] = useState<number | null>(null);
  const [stockShares, setStockShares] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [occurredOn, setOccurredOn] = useState<Dayjs | null>(dayjs());

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [, startTransition] = useTransition();

  const symbolOptions = useMemo(
    () => instruments.map((i) => ({ value: i.symbol })),
    [instruments],
  );

  // Per-stock totals from every recorded dividend — drives the summary table.
  const summary = useMemo<SummaryRow[]>(() => {
    const map = new Map<string, SummaryRow>();
    for (const r of rows) {
      const e =
        map.get(r.symbol) ?? { symbol: r.symbol, cash: 0, shares: 0, payouts: 0 };
      e.cash += r.cash_dividend_bdt;
      e.shares += r.stock_dividend_shares;
      e.payouts += 1;
      map.set(r.symbol, e);
    }
    return [...map.values()]
      .map((e) => ({
        ...e,
        cash: Math.round(e.cash * 100) / 100,
        shares: Math.round(e.shares * 10000) / 10000,
      }))
      .sort((a, b) => b.cash - a.cash || b.shares - a.shares || a.symbol.localeCompare(b.symbol));
  }, [rows]);

  const refresh = useCallback(async () => {
    const res = await listDividends();
    if (res.ok) {
      setRows(res.rows);
      setTotalCash(res.totalCash);
      setTotalStockShares(res.totalStockShares);
      setLoadError(null);
    } else {
      setLoadError(res.error);
    }
  }, []);

  const resetForm = useCallback(() => {
    setSymbol("");
    setCash(null);
    setStockShares(null);
    setNote("");
    setOccurredOn(dayjs());
  }, []);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setSaveOk(false);

    const sym = symbol.trim().toUpperCase();
    if (!sym) {
      setSaveError("Select a stock.");
      return;
    }
    const cashAmt = cash ?? 0;
    const stockAmt = stockShares ?? 0;
    if (!(cashAmt > 0) && !(stockAmt > 0)) {
      setSaveError("Enter a cash dividend, a stock dividend, or both.");
      return;
    }

    setSaving(true);
    try {
      const res = await createDividend({
        symbol: sym,
        cashDividend: cashAmt,
        stockDividendShares: stockAmt,
        note,
        occurredOn: occurredOn ? occurredOn.format("YYYY-MM-DD") : null,
      });
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      setSaveOk(true);
      resetForm();
      startTransition(() => {
        void refresh();
      });
      setTimeout(() => setSaveOk(false), 3000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [symbol, cash, stockShares, note, occurredOn, refresh, resetForm]);

  const handleDelete = useCallback(
    async (id: string) => {
      const res = await deleteDividend(id);
      if (!res.ok) {
        setLoadError(res.error);
        return;
      }
      await refresh();
    },
    [refresh],
  );

  const columns: ColumnsType<DividendRow> = [
    {
      title: "Date",
      dataIndex: "occurred_on",
      width: 116,
      render: (v: string) => (
        <span className="text-[14px] tabular-nums text-[var(--ink-strong)]">{v}</span>
      ),
    },
    {
      title: "Stock",
      dataIndex: "symbol",
      width: 110,
      render: (v: string) => (
        <span className="font-mono text-[14px] text-[var(--ink-strong)]">{v}</span>
      ),
    },
    {
      title: "Cash",
      dataIndex: "cash_dividend_bdt",
      width: 130,
      align: "right",
      render: (v: number) =>
        v > 0 ? (
          <span className="text-[14px] tabular-nums text-[var(--gain-700)]">
            +{formatBdt(v)}
          </span>
        ) : (
          <span className="text-[14px] text-[var(--ink-muted)]">—</span>
        ),
    },
    {
      title: "Bonus shares",
      dataIndex: "stock_dividend_shares",
      width: 120,
      align: "right",
      render: (v: number) =>
        v > 0 ? (
          <span className="text-[14px] tabular-nums text-[var(--ink-strong)]">
            +{formatPlainNumberMax2Decimals(v)}
          </span>
        ) : (
          <span className="text-[14px] text-[var(--ink-muted)]">—</span>
        ),
    },
    {
      title: "Note",
      dataIndex: "note",
      render: (v: string | null) => (
        <span className="text-[14px] text-[var(--ink-strong)]">{v ?? "—"}</span>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 72,
      align: "right",
      render: (_, row) => (
        <Popconfirm
          title="Delete this dividend?"
          description={
            row.bonus_tx_id
              ? "The cash will be removed from your Net P/L and the bonus shares removed from your position."
              : "The cash will be removed from your Net P/L."
          }
          okText="Delete"
          okButtonProps={{ danger: true }}
          cancelText="Cancel"
          onConfirm={() => void handleDelete(row.id)}
        >
          <Button danger size="small" type="text">
            Delete
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const summaryColumns: ColumnsType<SummaryRow> = [
    {
      title: "Stock",
      dataIndex: "symbol",
      render: (v: string) => (
        <span className="font-mono text-[14px] text-[var(--ink-strong)]">{v}</span>
      ),
    },
    {
      title: "Cash dividend",
      dataIndex: "cash",
      align: "right",
      render: (v: number) =>
        v > 0 ? (
          <span className="text-[14px] tabular-nums text-[var(--gain-700)]">+{formatBdt(v)}</span>
        ) : (
          <span className="text-[14px] text-[var(--ink-muted)]">—</span>
        ),
    },
    {
      title: "Stock dividend (shares)",
      dataIndex: "shares",
      align: "right",
      render: (v: number) =>
        v > 0 ? (
          <span className="text-[14px] tabular-nums text-[var(--ink-strong)]">
            +{formatPlainNumberMax2Decimals(v)}
          </span>
        ) : (
          <span className="text-[14px] text-[var(--ink-muted)]">—</span>
        ),
    },
    {
      title: "Payouts",
      dataIndex: "payouts",
      align: "right",
      width: 90,
      render: (v: number) => (
        <span className="text-[14px] tabular-nums text-[var(--ink-muted)]">{v}</span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <AppSectionTitle>Dividends</AppSectionTitle>

      <Card variant="outlined" className="rounded-xl" styles={{ body: { padding: "20px 24px" } }}>
        <div className="space-y-4">
          <div>
            <h3 className="text-[14px] text-[var(--ink-strong)]">Record a dividend</h3>
            <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
              Pick the stock, then enter the cash and/or stock (bonus share)
              dividend you received. The cash amount rolls into your{" "}
              <span className="text-[var(--ink-strong)]">Net P/L</span> on the
              Portfolio page alongside realized sell P/L. Bonus shares are added
              to that position, which lowers its average cost.
            </p>
          </div>

          <div>
            <label className="block text-[14px] text-[var(--ink-strong)]">Stock</label>
            {instrumentsError ? (
              <p className="mt-1 text-[12px] text-[var(--warn-700)]">
                Symbol list offline — type the trading code manually.
              </p>
            ) : null}
            <AutoComplete
              value={symbol}
              onChange={(v) => {
                setSymbol(typeof v === "string" ? v : "");
                setSaveError(null);
                setSaveOk(false);
              }}
              onSelect={(v) => setSymbol(typeof v === "string" ? v.toUpperCase() : "")}
              options={symbolOptions}
              placeholder="Type or choose a trading code (e.g. BATBC)"
              filterOption={(input, option) =>
                String(option?.value ?? "")
                  .toUpperCase()
                  .includes(input.trim().toUpperCase())
              }
              size="large"
              className="mt-2 w-full font-mono"
              popupMatchSelectWidth={false}
              dropdownStyle={{ minWidth: 220, maxHeight: 300, overflow: "auto", fontFamily: "monospace" }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[14px] text-[var(--ink-strong)]">
                Cash dividend (BDT)
              </label>
              <InputNumber
                value={cash}
                onChange={(v) => {
                  setCash(typeof v === "number" ? v : null);
                  setSaveError(null);
                  setSaveOk(false);
                }}
                placeholder="0.00"
                min={0}
                step={100}
                size="large"
                className="mt-2 w-full rounded-md"
              />
            </div>

            <div>
              <label className="block text-[14px] text-[var(--ink-strong)]">
                Stock dividend (bonus shares)
              </label>
              <InputNumber
                value={stockShares}
                onChange={(v) => {
                  setStockShares(typeof v === "number" ? v : null);
                  setSaveError(null);
                  setSaveOk(false);
                }}
                placeholder="0"
                min={0}
                step={1}
                size="large"
                className="mt-2 w-full rounded-md"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[14px] text-[var(--ink-strong)]">Date</label>
              <DatePicker
                value={occurredOn}
                onChange={(d) => setOccurredOn(d)}
                size="large"
                className="mt-2 w-full rounded-md"
                allowClear={false}
              />
            </div>

            <div>
              <label className="block text-[14px] text-[var(--ink-strong)]">
                Note (optional)
              </label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. FY2025 final dividend"
                size="large"
                className="mt-2 rounded-md"
                maxLength={200}
              />
            </div>
          </div>

          <Button
            type="primary"
            size="large"
            loading={saving}
            disabled={saving}
            onClick={() => void handleSave()}
          >
            Save dividend
          </Button>

          {saveError && <Alert type="error" showIcon message="Error" description={saveError} />}
          {saveOk && (
            <Alert type="success" showIcon message="Saved" description="Dividend recorded." />
          )}
        </div>
      </Card>

      <Card variant="outlined" className="rounded-xl" styles={{ body: { padding: "20px 24px" } }}>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14px] text-[var(--ink-strong)]">Dividend summary</h3>
            <span className="text-[13px] text-[var(--ink-muted)]">
              Total cash:{" "}
              <span className="tabular-nums text-[var(--gain-700)]">+{formatBdt(totalCash)}</span>
              {totalStockShares > 0 ? (
                <>
                  {" · "}Bonus shares:{" "}
                  <span className="tabular-nums text-[var(--ink-strong)]">
                    +{formatPlainNumberMax2Decimals(totalStockShares)}
                  </span>
                </>
              ) : null}
            </span>
          </div>
          <p className="text-[12px] text-[var(--ink-muted)]">
            Cash and stock (bonus share) dividends you&apos;ve recorded, totalled per stock.
          </p>

          <Table<SummaryRow>
            rowKey="symbol"
            columns={summaryColumns}
            dataSource={summary}
            pagination={false}
            size="small"
            scroll={{ x: "max-content" }}
            locale={{ emptyText: "No dividends recorded yet." }}
          />
        </div>
      </Card>

      <Card variant="outlined" className="rounded-xl" styles={{ body: { padding: "20px 24px" } }}>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14px] text-[var(--ink-strong)]">History</h3>
            <span className="text-[13px] text-[var(--ink-muted)]">
              Total cash:{" "}
              <span className="tabular-nums text-[var(--gain-700)]">
                +{formatBdt(totalCash)}
              </span>
              {totalStockShares > 0 ? (
                <>
                  {" · "}Bonus shares:{" "}
                  <span className="tabular-nums text-[var(--ink-strong)]">
                    +{formatPlainNumberMax2Decimals(totalStockShares)}
                  </span>
                </>
              ) : null}
            </span>
          </div>

          {loadError ? (
            <Alert type="error" showIcon message="Could not load dividends" description={loadError} />
          ) : null}

          <Table<DividendRow>
            rowKey="id"
            columns={columns}
            dataSource={rows}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            size="small"
            scroll={{ x: "max-content" }}
            locale={{ emptyText: "No dividends recorded yet." }}
          />
        </div>
      </Card>
    </div>
  );
}
