"use client";

import { SymbolField, type SymbolFieldInstrument } from "@/components/symbol-field";
import {
  calculatedAllocationBdt,
  effectiveMonthlyTotalBdt,
  sumLockedPercentages,
  ymToDisplayTitle,
} from "@/lib/mip-monthly";
import { formatBdt } from "@/lib/format-bdt";
import { Alert, Button, Select, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

export type MipMonthlyHeaderDTO = {
  id: string;
  year_month: string;
  plan_date: string;
  base_amount_bdt: number | string;
  carried_forward_bdt: number | string;
  locked_at: string;
};

export type MipMonthlyRowDTO = {
  id: string;
  header_id: string;
  sort_order: number;
  symbol: string | null;
  percentage: number | string | null;
  note: string | null;
  calculated_amount_bdt: number | string | null;
  locked: boolean;
};

type Row = MipMonthlyRowDTO & { key: string };
const MIP_MAX_ROWS = 12;

const shell =
  "rounded-md border border-teal-200/60 bg-white/92 px-3 py-2 shadow-sm ring-1 ring-teal-500/5 dark:border-teal-900/45 dark:bg-zinc-900/85 dark:ring-teal-900/20";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymFromParts(year: number, month1: number) {
  return `${year}-${pad2(month1)}`;
}

function parseYm(ym: string): { y: number; m: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) };
}

export function MipMonthlyModule({
  sectionTitle,
  routePath,
  viewYm,
  currentYmDhaka,
  header,
  rows,
  currentHeader,
  currentRows,
  totalBalanceBdt,
  instruments,
  instrumentsError,
  canSubmitThisMonth,
  canResetThisMonth,
  submitSetupAction,
  addRowAction,
  deleteRowAction,
  lockRowAction,
  resetSetupAction,
}: {
  sectionTitle: string;
  routePath: string;
  viewYm: string;
  currentYmDhaka: string;
  header: MipMonthlyHeaderDTO | null;
  rows: MipMonthlyRowDTO[];
  /** Header for the current Dhaka month (may differ from viewed month). */
  currentHeader: MipMonthlyHeaderDTO | null;
  currentRows: MipMonthlyRowDTO[];
  /** Running wallet: SUM(all base_amount_bdt) − SUM(all locked calculated_amount_bdt). */
  totalBalanceBdt: number;
  instruments: SymbolFieldInstrument[];
  instrumentsError: string | null;
  canSubmitThisMonth: boolean;
  canResetThisMonth: boolean;
  submitSetupAction: (formData: FormData) => Promise<{ ok: true } | { ok: false; error: string }>;
  addRowAction: (headerId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  deleteRowAction?: (rowId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  lockRowAction: (formData: FormData) => Promise<{ ok: true } | { ok: false; error: string }>;
  resetSetupAction: (headerId: string, yearMonth: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const parsedYm = parseYm(viewYm);
  const [searchYear, setSearchYear] = useState(parsedYm?.y ?? new Date().getUTCFullYear());
  const [searchMonth, setSearchMonth] = useState(parsedYm?.m ?? 1);

  const [planDate, setPlanDate] = useState(() => {
    if (parsedYm) return `${viewYm}-15`;
    return `${currentYmDhaka}-15`;
  });
  const [baseAmount, setBaseAmount] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);

  const [addRowBusy, setAddRowBusy] = useState(false);
  const [addRowError, setAddRowError] = useState<string | null>(null);
  const [lockErrors, setLockErrors] = useState<Record<string, string | null>>({});
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string | null>>({});

  const [draftSymbol, setDraftSymbol] = useState<Record<string, string>>({});
  const [draftPct, setDraftPct] = useState<Record<string, string>>({});
  const [draftNote, setDraftNote] = useState<Record<string, string>>({});
  const [lockBusyId, setLockBusyId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const headerNum = header
    ? {
      base: Number(header.base_amount_bdt),
      carried: Number(header.carried_forward_bdt),
    }
    : null;
  const effective = headerNum
    ? effectiveMonthlyTotalBdt({
      base_amount_bdt: headerNum.base,
      carried_forward_bdt: headerNum.carried,
    })
    : 0;

  // Balance for the current Dhaka month — shown in the header bar regardless of which month is viewed.
  const currentEffective = useMemo(() => {
    if (!currentHeader) return 0;
    return effectiveMonthlyTotalBdt({
      base_amount_bdt: Number(currentHeader.base_amount_bdt),
      carried_forward_bdt: Number(currentHeader.carried_forward_bdt),
    });
  }, [currentHeader]);
  const summaryEffective = useMemo(() => {
    if (!header) return currentEffective;
    return effectiveMonthlyTotalBdt({
      base_amount_bdt: Number(header.base_amount_bdt),
      carried_forward_bdt: Number(header.carried_forward_bdt),
    });
  }, [currentEffective, header]);
  const liveAllocatedPct = useMemo(() => {
    return rows.reduce((sum, row) => {
      if (row.locked) return sum + Number(row.percentage ?? 0);
      const raw = draftPct[row.id];
      const parsed = raw == null || raw.trim() === "" ? 0 : Number(raw);
      return sum + (Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
    }, 0);
  }, [draftPct, rows]);
  const currentRemainingPct = Math.max(0, Math.round((100 - liveAllocatedPct) * 10000) / 10000);
  const currentRemainingBdt =
    summaryEffective > 0
      ? Math.round((currentRemainingPct / 100) * summaryEffective * 100) / 100
      : 0;

  const applySearch = useCallback(() => {
    const ym = ymFromParts(searchYear, searchMonth);
    router.push(`${routePath}?ym=${ym}`);
  }, [routePath, router, searchMonth, searchYear]);

  const data: Row[] = useMemo(
    () => [...rows].sort((a, b) => a.sort_order - b.sort_order).map((r) => ({ ...r, key: r.id })),
    [rows],
  );

  const handleSubmitSetup = useCallback(async () => {
    setSetupError(null);
    setSetupBusy(true);
    const fd = new FormData();
    fd.set("plan_date", planDate.trim());
    fd.set("base_amount_bdt", baseAmount.trim());
    const res = await submitSetupAction(fd);
    setSetupBusy(false);
    if (!res.ok) {
      setSetupError(res.error);
      return;
    }
    setBaseAmount("");
    router.refresh();
  }, [baseAmount, planDate, router, submitSetupAction]);

  const handleAddRow = useCallback(async () => {
    if (!header) return;
    setAddRowError(null);
    setAddRowBusy(true);
    const res = await addRowAction(header.id);
    setAddRowBusy(false);
    if (!res.ok) {
      setAddRowError(res.error);
      return;
    }
    router.refresh();
  }, [addRowAction, header, router]);

  const handleLockRow = useCallback(
    async (rowId: string) => {
      const sym = (draftSymbol[rowId] ?? "").trim().toUpperCase();
      const pct = (draftPct[rowId] ?? "").trim();
      setLockErrors((e) => ({ ...e, [rowId]: null }));
      setLockBusyId(rowId);
      const fd = new FormData();
      fd.set("row_id", rowId);
      fd.set("symbol", sym);
      fd.set("percentage", pct);
      fd.set("note", (draftNote[rowId] ?? "").trim());
      const res = await lockRowAction(fd);
      setLockBusyId(null);
      if (!res.ok) {
        setLockErrors((e) => ({ ...e, [rowId]: res.error }));
        return;
      }
      setDraftSymbol((d) => {
        const n = { ...d };
        delete n[rowId];
        return n;
      });
      setDraftPct((d) => {
        const n = { ...d };
        delete n[rowId];
        return n;
      });
      setDraftNote((d) => {
        const n = { ...d };
        delete n[rowId];
        return n;
      });
      router.refresh();
    },
    [draftNote, draftPct, draftSymbol, lockRowAction, router],
  );

  const handleDeleteRow = useCallback(
    async (rowId: string) => {
      if (!deleteRowAction) return;
      const confirmed = window.confirm("Delete this row from Draft MIP?");
      if (!confirmed) return;

      setDeleteErrors((e) => ({ ...e, [rowId]: null }));
      setDeleteBusyId(rowId);
      const res = await deleteRowAction(rowId);
      setDeleteBusyId(null);
      if (!res.ok) {
        setDeleteErrors((e) => ({ ...e, [rowId]: res.error }));
        return;
      }
      router.refresh();
    },
    [deleteRowAction, router],
  );

  const handleReset = useCallback(async () => {
    if (!header) return;
    const confirmed = window.confirm(
      `Reset ${ymToDisplayTitle(header.year_month)} ${sectionTitle}? This will delete all rows and the monthly total so you can start again.`,
    );
    if (!confirmed) return;

    setResetError(null);
    setResetBusy(true);
    const res = await resetSetupAction(header.id, header.year_month);
    setResetBusy(false);
    if (!res.ok) {
      setResetError(res.error);
      return;
    }
    router.refresh();
  }, [header, resetSetupAction, router, sectionTitle]);

  const columns: ColumnsType<Row> = useMemo(
    () => [
      {
        title: "DSE stock name",
        dataIndex: "symbol",
        render: (_: unknown, record) =>
          record.locked ? (
            <Typography.Text className="font-mono">{String(record.symbol).toUpperCase()}</Typography.Text>
          ) : (
            <SymbolField
              instruments={instruments}
              loadError={instrumentsError}
              aria-label="Stock symbol"
              placeholder="Symbol"
              size="sm"
              value={draftSymbol[record.id] ?? record.symbol ?? ""}
              onValueChange={(v) => setDraftSymbol((d) => ({ ...d, [record.id]: v }))}
              className="box-border h-9 w-full min-w-[6rem] max-w-[11rem] rounded border border-zinc-300/90 bg-white px-2 font-mono text-[15px] font-normal text-zinc-900 outline-none ring-teal-500/30 focus:ring-1 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
            />
          ),
      },
      {
        title: "Investment %",
        key: "pct",
        align: "right",
        width: 120,
        render: (_: unknown, record) =>
          record.locked ? (
            <span className="tabular-nums">
              {Number(record.percentage).toLocaleString(undefined, { maximumFractionDigits: 2 })}%
            </span>
          ) : (
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.01"
              aria-label="Percentage"
              placeholder="%"
              value={draftPct[record.id] ?? (record.percentage != null ? String(record.percentage) : "")}
              onChange={(e) => setDraftPct((d) => ({ ...d, [record.id]: e.target.value }))}
              className="box-border h-9 w-full rounded border border-zinc-300/90 bg-white px-2 text-right text-[15px] font-normal tabular-nums text-zinc-900 outline-none dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
            />
          ),
      },
      {
        title: "Calculated amount (BDT)",
        key: "calc",
        align: "right",
        render: (_: unknown, record) => {
          if (record.locked && record.calculated_amount_bdt != null) {
            return <span className="tabular-nums">{formatBdt(Number(record.calculated_amount_bdt))}</span>;
          }
          const pct = Number(draftPct[record.id] ?? record.percentage ?? "");
          if (!record.locked && Number.isFinite(pct) && pct > 0 && effective > 0) {
            const preview = calculatedAllocationBdt(pct, effective);
            return (
              <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatBdt(preview)}
                <span className="ml-1 text-[13px]">(preview)</span>
              </span>
            );
          }
          return <Typography.Text type="secondary">—</Typography.Text>;
        },
      },
      {
        title: "Note",
        dataIndex: "note",
        width: 240,
        render: (_: unknown, record) =>
          record.locked ? (
            record.note ? (
              <span>{record.note}</span>
            ) : (
              <Typography.Text type="secondary">—</Typography.Text>
            )
          ) : (
            <input
              type="text"
              aria-label="Note"
              maxLength={300}
              placeholder="Optional note"
              value={draftNote[record.id] ?? record.note ?? ""}
              onChange={(e) => setDraftNote((d) => ({ ...d, [record.id]: e.target.value }))}
              className="box-border h-9 w-full rounded border border-zinc-300/90 bg-white px-2 text-[15px] font-normal text-zinc-900 outline-none dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
            />
          ),
      },
      {
        title: deleteRowAction ? "Actions" : "Status",
        key: "status",
        width: deleteRowAction ? 176 : 160,
        render: (_: unknown, record: Row) => (
          <div className="flex flex-col items-end gap-1">
            {record.locked ? (
              <Tag color="blue" className="m-0 border-0 font-normal">
                Locked
              </Tag>
            ) : (
              <Button
                type="primary"
                size="small"
                loading={lockBusyId === record.id}
                disabled={
                  lockBusyId !== null || deleteBusyId !== null || (deleteRowAction ? deleteBusyId === record.id : false)
                }
                onClick={() => void handleLockRow(record.id)}
              >
                Lock row
              </Button>
            )}
            {deleteRowAction ? (
              <Button
                danger
                type="default"
                size="small"
                loading={deleteBusyId === record.id}
                disabled={lockBusyId !== null || deleteBusyId !== null}
                onClick={() => void handleDeleteRow(record.id)}
              >
                Delete
              </Button>
            ) : null}
            {lockErrors[record.id] ? (
              <Typography.Text type="danger" className="max-w-[14rem] text-right text-[13px]">
                {lockErrors[record.id]}
              </Typography.Text>
            ) : null}
            {deleteErrors[record.id] ? (
              <Typography.Text type="danger" className="max-w-[14rem] text-right text-[13px]">
                {deleteErrors[record.id]}
              </Typography.Text>
            ) : null}
          </div>
        ),
      },
    ],
    [
      draftNote,
      draftPct,
      draftSymbol,
      deleteBusyId,
      deleteErrors,
      deleteRowAction,
      handleLockRow,
      handleDeleteRow,
      instruments,
      instrumentsError,
      lockBusyId,
      lockErrors,
      effective,
    ],
  );

  const yearOptions = useMemo(() => {
    const cy = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => cy - 5 + i);
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-5 text-left">

      {/* ── Month selector & Total Amount ── */}
      <div className={`${shell} flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end`}>
        <label className="text-[15px] font-normal text-zinc-600 dark:text-zinc-400">
          <span className="mb-1 block">Select Month</span>
          <Select
            size="middle"
            className="min-w-[9rem]"
            value={searchMonth}
            onChange={(v) => {
              const ym = ymFromParts(searchYear, Number(v));
              router.push(`${routePath}?ym=${ym}`);
            }}
            options={Array.from({ length: 12 }, (_, i) => ({
              value: i + 1,
              label: new Date(2000, i, 1).toLocaleString("en-GB", { month: "long" }),
            }))}
          />
        </label>
        {currentHeader ? (
          <div className="rounded-md border border-blue-200/70 bg-blue-50/60 px-3 py-1.5 dark:border-blue-800/50 dark:bg-blue-950/40">
            <p className="text-[12px] font-normal uppercase tracking-wide text-blue-600 dark:text-blue-400">
              Total %
            </p>
            <p className="tabular-nums text-[18px] font-semibold text-blue-800 dark:text-blue-200">
              {currentRemainingPct.toFixed(2)}%
            </p>
          </div>
        ) : null}
        {currentHeader ? (
          <div className="rounded-md border border-teal-200/70 bg-teal-50/60 px-3 py-1.5 dark:border-teal-800/50 dark:bg-teal-950/40">
            <p className="text-[12px] font-normal uppercase tracking-wide text-teal-600 dark:text-teal-400">
              Total Balance
            </p>
            <p className="tabular-nums text-[18px] font-semibold text-teal-800 dark:text-teal-200">
              {formatBdt(currentRemainingBdt)} BDT
            </p>
          </div>
        ) : null}
      </div>

      {!header && canSubmitThisMonth ? (
        <div className={shell}>
          <Typography.Title level={5} className="!mb-2 !mt-0 !text-[15px] !font-normal text-zinc-800 dark:text-zinc-100">
            {sectionTitle} setup (once this month)
          </Typography.Title>
          <p className="mb-3 text-[15px] font-normal leading-snug text-zinc-600 dark:text-zinc-400">
            Choose a date between the 5th and 25th (Asia/Dhaka) in {ymToDisplayTitle(viewYm)}, and your total monthly
            investment. After submit, fields lock and you fill the allocation table below.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="text-[15px] font-normal text-zinc-600 dark:text-zinc-400">
              <span className="mb-1 block">Date</span>
              <input
                type="date"
                min={`${viewYm}-05`}
                max={`${viewYm}-25`}
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className="box-border h-9 rounded border border-zinc-300/90 bg-white px-2 text-[15px] font-normal text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </label>
            <label className="min-w-0 flex-1 sm:max-w-xs">
              <span className="mb-1 block text-[15px] font-normal text-zinc-600 dark:text-zinc-400">
                Total monthly investment (BDT)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value)}
                className="box-border h-9 w-full rounded border border-zinc-300/90 bg-white px-2 text-right text-[15px] font-normal tabular-nums text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </label>
            <Button type="primary" loading={setupBusy} disabled={setupBusy} onClick={() => void handleSubmitSetup()}>
              Submit {sectionTitle}
            </Button>
          </div>
          {setupError ? <Alert type="error" showIcon className="mt-3" title={setupError} /> : null}
        </div>
      ) : null}

      {!header && !canSubmitThisMonth && viewYm === currentYmDhaka ? (
        <Alert
          type="info"
          showIcon
          title="Submission window"
          description={`${sectionTitle} setup for this month is only available from the 5th through the 25th (Asia/Dhaka). Use search to review other months.`}
        />
      ) : null}

      {!header && viewYm !== currentYmDhaka ? (
        <Alert
          type="warning"
          showIcon
          title={`No ${sectionTitle} for this month`}
          description="There is no saved plan for the selected month. You can only create a plan for the current month during its submission window."
        />
      ) : null}

      {header ? (
        <>
          <div>
            <Typography.Title
              level={5}
              className="!mb-2 !mt-0 text-center !text-[15px] !font-normal text-zinc-800 dark:text-zinc-100"
            >
              {ymToDisplayTitle(header.year_month)}
            </Typography.Title>
            <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
              {canResetThisMonth ? (
                <Button
                  danger
                  type="default"
                  size="middle"
                  loading={resetBusy}
                  disabled={resetBusy || addRowBusy}
                  onClick={() => void handleReset()}
                >
                  Reset month
                </Button>
              ) : null}
              <Button
                type="default"
                size="middle"
                disabled={rows.length >= MIP_MAX_ROWS || addRowBusy || resetBusy}
                loading={addRowBusy}
                onClick={() => void handleAddRow()}
              >
                Add row ({rows.length}/{MIP_MAX_ROWS})
              </Button>
            </div>
            {resetError ? (
              <Alert type="error" showIcon className="mb-2" title={resetError} />
            ) : null}
            {addRowError ? (
              <Alert type="error" showIcon className="mb-2" title={addRowError} />
            ) : null}
            <Table<Row>
              className="w-full min-w-0"
              columns={columns}
              dataSource={data}
              scroll={{ x: "max-content" }}
              pagination={false}
              size="middle"
              bordered
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
