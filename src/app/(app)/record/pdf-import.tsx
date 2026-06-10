"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Checkbox,
  InputNumber,
  Modal,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { formatBdt } from "@/lib/format-bdt";
import {
  importTradeConfirmation,
  parseTradeConfirmationPdf,
  type ImportTradeRow,
} from "./pdf-import-actions";

type EditRow = ImportTradeRow & { key: number; include: boolean };

export function PdfImport() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, startImport] = useTransition();

  const [rows, setRows] = useState<EditRow[]>([]);
  const [tradeDate, setTradeDate] = useState<string | null>(null);
  const [confirmationNo, setConfirmationNo] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function pickFile() {
    setError(null);
    setSuccessMsg(null);
    fileInputRef.current?.click();
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setParsing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await parseTradeConfirmationPdf(fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setRows(
        res.trades.map((t, i) => ({ ...t, key: i, include: !t.duplicate })),
      );
      setTradeDate(res.tradeDate);
      setConfirmationNo(res.confirmationNo);
      setWarnings(res.warnings);
      setOpen(true);
    } catch {
      setError("Something went wrong reading that PDF.");
    } finally {
      setParsing(false);
    }
  }

  function patchRow(key: number, patch: Partial<EditRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const selected = rows.filter((r) => r.include);

  function doImport() {
    setError(null);
    startImport(async () => {
      const res = await importTradeConfirmation({
        tradeDate,
        trades: selected.map((r) => ({
          symbol: r.symbol,
          side: r.side,
          quantity: r.quantity,
          pricePerShare: r.pricePerShare,
          feesBdt: r.feesBdt,
        })),
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setRows([]);
      setSuccessMsg(res.summary ?? "Imported.");
      router.refresh();
    });
  }

  const columns: ColumnsType<EditRow> = [
    {
      title: "",
      dataIndex: "include",
      width: 44,
      render: (_v, r) => (
        <Checkbox
          checked={r.include}
          onChange={(e) => patchRow(r.key, { include: e.target.checked })}
        />
      ),
    },
    {
      title: "Symbol",
      dataIndex: "symbol",
      render: (_v, r) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium tracking-tight">{r.symbol}</span>
          <div className="flex flex-wrap gap-1">
            {!r.knownSymbol && (
              <Tooltip title="Not found in the DSE trading-code list — double-check the spelling.">
                <Tag color="warning" className="!m-0">
                  unknown
                </Tag>
              </Tooltip>
            )}
            {r.duplicate && (
              <Tooltip title="A matching transaction already exists on this date.">
                <Tag color="default" className="!m-0">
                  possible duplicate
                </Tag>
              </Tooltip>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Side",
      dataIndex: "side",
      width: 80,
      render: (_v, r) => (
        <Tag color={r.side === "buy" ? "success" : "error"} className="!m-0">
          {r.side.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      width: 110,
      render: (_v, r) => (
        <InputNumber
          value={r.quantity}
          min={0}
          step={1}
          controls={false}
          size="small"
          style={{ width: "100%" }}
          onChange={(v) => patchRow(r.key, { quantity: Number(v ?? 0) })}
        />
      ),
    },
    {
      title: "Price",
      dataIndex: "pricePerShare",
      width: 120,
      render: (_v, r) => (
        <InputNumber
          value={r.pricePerShare}
          min={0}
          step={0.1}
          controls={false}
          size="small"
          style={{ width: "100%" }}
          onChange={(v) => patchRow(r.key, { pricePerShare: Number(v ?? 0) })}
        />
      ),
    },
    {
      title: "Comm.",
      dataIndex: "feesBdt",
      width: 120,
      render: (_v, r) => (
        <InputNumber
          value={r.feesBdt}
          min={0}
          step={0.01}
          controls={false}
          size="small"
          style={{ width: "100%" }}
          onChange={(v) => patchRow(r.key, { feesBdt: Number(v ?? 0) })}
        />
      ),
    },
    {
      title: "Value",
      dataIndex: "value",
      width: 110,
      align: "right",
      render: (_v, r) => (
        <span className="tabular-nums text-[var(--ink-muted)]">
          {formatBdt(r.quantity * r.pricePerShare)}
        </span>
      ),
    },
  ];

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-surface)] p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-medium tracking-tight text-[var(--ink-strong)]">
            Import from confirmation note
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
            Upload a LankaBangla trade confirmation PDF to record every buy/sell at once.
          </p>
        </div>
        <Button onClick={pickFile} loading={parsing}>
          {parsing ? "Reading…" : "Upload PDF"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={onFileChosen}
        />
      </div>

      {error && !open && (
        <Alert
          type="error"
          showIcon
          className="mt-3 text-left"
          message="Could not import"
          description={error}
          role="alert"
        />
      )}
      {successMsg && (
        <Alert
          type="success"
          showIcon
          className="mt-3 text-left"
          message="Imported"
          description={successMsg}
        />
      )}

      <Modal
        open={open}
        title="Review trades before importing"
        width={760}
        onCancel={() => !importing && setOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setOpen(false)} disabled={importing}>
            Cancel
          </Button>,
          <Button
            key="import"
            type="primary"
            loading={importing}
            disabled={selected.length === 0}
            onClick={doImport}
          >
            {`Import ${selected.length} trade${selected.length === 1 ? "" : "s"}`}
          </Button>,
        ]}
        centered
      >
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
            <label className="flex items-center gap-2">
              <span className="text-[var(--ink-muted)]">Trade date</span>
              <input
                type="date"
                value={tradeDate ?? ""}
                onChange={(e) => setTradeDate(e.target.value || null)}
                className="rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-2 py-1 text-[13px]"
              />
            </label>
            {confirmationNo && (
              <span className="text-[var(--ink-muted)]">
                Note #{confirmationNo}
              </span>
            )}
          </div>

          {!tradeDate && (
            <Alert
              type="info"
              showIcon
              message="No trade date was read from the PDF — set one above, or trades will be stamped with today's date."
            />
          )}
          {warnings.map((w, i) => (
            <Alert key={i} type="warning" showIcon message={w} />
          ))}
          {error && (
            <Alert type="error" showIcon message={error} role="alert" />
          )}

          {rows.length > 0 ? (
            <Table<EditRow>
              columns={columns}
              dataSource={rows}
              pagination={false}
              size="small"
              scroll={{ x: 640 }}
            />
          ) : (
            <p className="text-[13px] text-[var(--ink-muted)]">
              No trades were recognised in this PDF.
            </p>
          )}
        </div>
      </Modal>
    </section>
  );
}
