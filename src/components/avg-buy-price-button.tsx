"use client";

import {
  getAvgBuyPriceSince,
  listUserSymbols,
  type AvgBuyPriceRow,
} from "@/app/(app)/avg-buy-actions";
import { formatBdt, formatNumberMax2Decimals } from "@/lib/format-bdt";
import { Button, DatePicker, Modal, Select, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { useState, useTransition } from "react";

export function AvgBuyPriceButton() {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<Dayjs | null>(() =>
    dayjs().subtract(30, "day"),
  );
  const [symbol, setSymbol] = useState<string | undefined>(undefined);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [symbolsLoaded, setSymbolsLoaded] = useState(false);
  const [rows, setRows] = useState<AvgBuyPriceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function openModal() {
    setOpen(true);
    setRows(null);
    setError(null);
    if (!symbolsLoaded) {
      const res = await listUserSymbols();
      setSymbols(res.symbols);
      setSymbolsLoaded(true);
    }
  }

  function onCalculate() {
    if (!from) {
      setError("Pick a from-date.");
      return;
    }
    const dateStr = from.format("YYYY-MM-DD");
    setError(null);
    startTransition(async () => {
      const res = await getAvgBuyPriceSince(dateStr, symbol ?? null);
      if (res.error) {
        setError(res.error);
        setRows(null);
        return;
      }
      setRows(res.rows);
    });
  }

  const columns: ColumnsType<AvgBuyPriceRow> = [
    {
      title: "Symbol",
      dataIndex: "symbol",
      render: (v: string) => <span className="font-mono">{v}</span>,
    },
    {
      title: "Avg Buy",
      dataIndex: "avgPrice",
      align: "right",
      render: (v: number) => (
        <span className="tabular-nums font-mono">{formatBdt(v)}</span>
      ),
    },
    {
      title: "Qty",
      dataIndex: "totalQty",
      align: "right",
      render: (v: number) => (
        <span className="tabular-nums">{formatNumberMax2Decimals(v)}</span>
      ),
    },
    {
      title: "Trades",
      dataIndex: "trades",
      align: "right",
      width: 64,
      render: (v: number) => <span className="tabular-nums">{v}</span>,
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => void openModal()}
        aria-label="Average buy price"
        title="Average buy price"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--bg-surface)] px-3 text-[13px] text-[var(--ink-default)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--ink-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-500)]"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M14 7h7v7" />
        </svg>
        <span className="hidden sm:inline">Avg Buy</span>
      </button>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        title="Average buy price since"
        footer={null}
        destroyOnHidden
        width={560}
      >
        <div className="flex flex-col gap-3 pt-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <DatePicker
              value={from}
              onChange={(d) => setFrom(d)}
              format="YYYY-MM-DD"
              maxDate={dayjs()}
              className="w-full"
              placeholder="From date"
            />
            <Select
              value={symbol}
              onChange={(v) => setSymbol(v)}
              placeholder="All stocks"
              allowClear
              showSearch
              className="w-full"
              options={symbols.map((s) => ({ value: s, label: s }))}
            />
          </div>
          <Button
            type="primary"
            loading={isPending}
            onClick={onCalculate}
            disabled={!from}
            block
          >
            Calculate
          </Button>
          {error ? (
            <Typography.Paragraph type="danger" className="m-0">
              {error}
            </Typography.Paragraph>
          ) : null}
          {rows !== null && !isPending ? (
            rows.length === 0 ? (
              <Typography.Paragraph type="secondary" className="m-0">
                No buy transactions since {from?.format("YYYY-MM-DD")}.
              </Typography.Paragraph>
            ) : (
              <Table<AvgBuyPriceRow>
                size="small"
                pagination={false}
                rowKey="symbol"
                dataSource={rows}
                columns={columns}
                bordered
              />
            )
          ) : null}
        </div>
      </Modal>
    </>
  );
}

