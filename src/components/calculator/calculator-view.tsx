"use client";

import { useState, useTransition } from "react";
import { fetchShareAnalytics, type ShareAnalytics } from "@/app/(app)/calculator/actions";
import { SymbolField, type SymbolFieldInstrument } from "@/components/symbol-field";

type Tab = "analytics" | "dividend";

type Props = {
  instruments: SymbolFieldInstrument[];
  instrumentsError: string | null;
};

export function CalculatorView({ instruments, instrumentsError }: Props) {
  const [tab, setTab] = useState<Tab>("analytics");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-2">
        <h2 className="mr-auto text-[16px] font-semibold text-[var(--ink-strong)]">Calculator</h2>
        <TabButton active={tab === "analytics"} onClick={() => setTab("analytics")}>
          Advanced Analytics
        </TabButton>
        <TabButton active={tab === "dividend"} onClick={() => setTab("dividend")}>
          Dividend &amp; Bonus
        </TabButton>
      </div>

      {tab === "analytics" ? (
        <AdvancedAnalyticsCard instruments={instruments} instrumentsError={instrumentsError} />
      ) : (
        <DividendCalculatorCard instruments={instruments} instrumentsError={instrumentsError} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const cls = active
    ? "bg-[var(--accent-700)] text-white"
    : "bg-[var(--bg-surface)] text-[var(--ink-muted)] hover:text-[var(--ink-strong)]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium transition-colors ${cls}`}
    >
      {children}
    </button>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const cls = active
    ? "bg-[var(--accent-700)] text-white border-[var(--accent-700)]"
    : "bg-[var(--bg-surface)] text-[var(--ink-muted)] hover:text-[var(--ink-strong)]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border border-[var(--line)] px-3 py-1 text-[12px] font-medium transition-colors ${cls}`}
    >
      {children}
    </button>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function fmt(n: number | null, suffix = "", dec = 2): string {
  if (n === null) return "—";
  return n.toFixed(dec) + suffix;
}
function fmtPrice(n: number | null): string {
  if (n === null) return "—";
  return `৳${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtMoney(n: number | null): string {
  if (n === null) return "—";
  return `৳${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function AdvRow({
  label,
  value,
  context,
  highlight,
}: {
  label: string;
  value: string;
  context?: string;
  highlight?: "positive" | "negative" | "neutral";
}) {
  const valueColor =
    highlight === "positive"
      ? "text-emerald-700"
      : highlight === "negative"
        ? "text-red-600"
        : "text-[var(--ink-strong)]";
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-4 py-1 text-[12px]">
      <div>
        <span className="text-[var(--ink-muted)]">{label}</span>
        {context && (
          <span className="ml-1.5 text-[10px] text-[var(--ink-muted)] opacity-60">{context}</span>
        )}
      </div>
      <span className={`font-semibold tabular-nums ${valueColor}`}>{value}</span>
    </div>
  );
}

// ─── Symbol picker shared between cards ───────────────────────────────────────
function SymbolPicker({
  symbol,
  onChange,
  instruments,
  instrumentsError,
  disabled,
}: {
  symbol: string;
  onChange: (next: string) => void;
  instruments: SymbolFieldInstrument[];
  instrumentsError: string | null;
  disabled?: boolean;
}) {
  return (
    <div className="flex-1 min-w-0">
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
        Trading code
      </label>
      <SymbolField
        instruments={instruments}
        loadError={instrumentsError}
        value={symbol}
        onValueChange={(v) => onChange(v.toUpperCase())}
        disabled={disabled}
        size="sm"
        aria-label="Trading code"
      />
    </div>
  );
}

// ─── Advanced Analytics card ─────────────────────────────────────────────────
function AdvancedAnalyticsCard({ instruments, instrumentsError }: Props) {
  const [symbol, setSymbol] = useState("");
  const [data, setData] = useState<ShareAnalytics | null>(null);
  const [pending, startTransition] = useTransition();

  const handleCalculate = () => {
    const trimmed = symbol.trim().toUpperCase();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await fetchShareAnalytics(trimmed);
      setData(res);
    });
  };

  const adv = data?.advanced ?? null;
  const eyHighlight =
    adv?.earningsYield != null
      ? adv.earningsYield / 100 >= 0.095
        ? ("positive" as const)
        : ("negative" as const)
      : ("neutral" as const);
  const mosHighlight =
    adv?.marginOfSafety != null
      ? adv.marginOfSafety > 0
        ? ("positive" as const)
        : ("negative" as const)
      : ("neutral" as const);
  const roeHighlight =
    adv?.roe != null
      ? adv.roe >= 15
        ? ("positive" as const)
        : adv.roe >= 8
          ? ("neutral" as const)
          : ("negative" as const)
      : ("neutral" as const);
  const ddHighlight =
    adv?.drawdownFromHigh != null
      ? adv.drawdownFromHigh >= -20
        ? ("positive" as const)
        : ("negative" as const)
      : ("neutral" as const);
  const payoutHighlight =
    adv?.dividendPayoutRatio != null
      ? adv.dividendPayoutRatio <= 75
        ? ("positive" as const)
        : ("negative" as const)
      : ("neutral" as const);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <h3 className="text-[14px] font-semibold text-[var(--ink-strong)]">Advanced Analytics</h3>
      <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
        Pick a DSE trading code to compute Graham Number, margin of safety, earnings yield, ROE, payout, and 52W drawdown / recovery.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <SymbolPicker
          symbol={symbol}
          onChange={setSymbol}
          instruments={instruments}
          instrumentsError={instrumentsError}
          disabled={pending}
        />
        <button
          type="button"
          onClick={handleCalculate}
          disabled={pending || symbol.trim().length === 0}
          className="rounded-md border border-[var(--line)] bg-[var(--accent-700)] px-4 py-2 text-[13px] font-medium text-white shadow-sm disabled:opacity-50"
        >
          {pending ? "Calculating…" : "Calculate"}
        </button>
      </div>

      {data && data.error && (
        <p className="mt-3 rounded-md bg-[var(--warn-50)] px-3 py-2 text-[12px] text-amber-900">
          {data.error}
        </p>
      )}

      {data && adv && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold text-[var(--ink-strong)]">{data.symbol}</span>
            {data.sector && (
              <span className="text-[12px] text-[var(--ink-muted)]">{data.sector}</span>
            )}
            {data.category && (
              <span className="rounded-full border border-[var(--line)] bg-[var(--bg-surface-soft)] px-2 py-0.5 text-[11px] text-[var(--ink-muted)]">
                Category {data.category}
              </span>
            )}
            {data.currentPrice !== null && (
              <span className="ml-auto text-[12px] text-[var(--ink-muted)]">
                LTP <span className="font-semibold text-[var(--ink-strong)]">{fmtPrice(data.currentPrice)}</span>
              </span>
            )}
          </div>

          <div className="rounded-lg bg-[var(--bg-canvas)] px-3 py-2">
            <AdvRow
              label="Graham Number"
              value={fmtPrice(adv.grahamNumber)}
              context="Intrinsic value ceiling"
            />
            <AdvRow
              label="Margin of Safety"
              value={
                adv.marginOfSafety !== null
                  ? `${adv.marginOfSafety > 0 ? "+" : ""}${fmt(adv.marginOfSafety, "%")}`
                  : "—"
              }
              context="vs Graham Number"
              highlight={mosHighlight}
            />
            <AdvRow
              label="Earnings Yield"
              value={fmt(adv.earningsYield, "%")}
              context="BD risk-free ~9.5%"
              highlight={eyHighlight}
            />
            <AdvRow
              label="Return on Equity"
              value={fmt(adv.roe, "%")}
              context="≥15% = strong"
              highlight={roeHighlight}
            />
            <AdvRow
              label="Div Payout Ratio"
              value={fmt(adv.dividendPayoutRatio, "%")}
              context="<75% = sustainable"
              highlight={payoutHighlight}
            />
            <AdvRow
              label="Drawdown from Peak"
              value={adv.drawdownFromHigh !== null ? `${fmt(adv.drawdownFromHigh, "%")}` : "—"}
              context="Entry timing signal"
              highlight={ddHighlight}
            />
            <AdvRow
              label="Recovery from Low"
              value={adv.recoveryFromLow !== null ? `+${fmt(adv.recoveryFromLow, "%")}` : "—"}
              context="Off 52W trough"
              highlight={adv.recoveryFromLow !== null ? "positive" : "neutral"}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dividend / bonus card ────────────────────────────────────────────────────
type DividendMode = "take" | "reinvest";

function DividendCalculatorCard({ instruments, instrumentsError }: Props) {
  const [symbol, setSymbol] = useState("");
  const [sharesStr, setSharesStr] = useState("");
  const [yearsStr, setYearsStr] = useState("");
  const [mode, setMode] = useState<DividendMode>("take");
  const [data, setData] = useState<ShareAnalytics | null>(null);
  const [pending, startTransition] = useTransition();

  const handleCalculate = () => {
    const trimmed = symbol.trim().toUpperCase();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await fetchShareAnalytics(trimmed);
      setData(res);
    });
  };

  const shares = Math.max(0, Math.floor(Number(sharesStr)) || 0);
  const years = Math.max(0, Math.floor(Number(yearsStr)) || 0);

  const dps = data?.annualDividendPerShare ?? null;
  const ltp = data?.currentPrice ?? null;
  const yieldFrac =
    data?.divYieldPct !== null && data?.divYieldPct !== undefined && data.divYieldPct > 0
      ? data.divYieldPct / 100
      : null;

  // Take-cash path: flat sum of payouts at the current DPS.
  const annualTotal = dps !== null ? Math.round(dps * shares * 100) / 100 : null;
  const totalOverYears = dps !== null ? Math.round(dps * shares * years * 100) / 100 : null;

  // Reinvest path: dividends buy more shares at the latest price each year, so
  // the share count grows at the dividend yield. Closed form: shares × (1+r)^Y.
  // Cumulative cash reinvested = shares × dps × ((1+r)^Y − 1) / r.
  const reinvestFinalShares =
    yieldFrac !== null && shares > 0 && years > 0
      ? shares * Math.pow(1 + yieldFrac, years)
      : null;
  const reinvestCumulativeCash =
    yieldFrac !== null && dps !== null && shares > 0 && years > 0
      ? (shares * dps * (Math.pow(1 + yieldFrac, years) - 1)) / yieldFrac
      : null;
  const reinvestFinalValue =
    reinvestFinalShares !== null && ltp !== null
      ? Math.round(reinvestFinalShares * ltp * 100) / 100
      : null;
  const reinvestExtraShares =
    reinvestFinalShares !== null ? reinvestFinalShares - shares : null;

  const inputsReady = shares > 0 && years > 0;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <h3 className="text-[14px] font-semibold text-[var(--ink-strong)]">
        Dividend &amp; Bonus Calculator
      </h3>
      <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
        Estimates total cash dividends if you hold a given share count for a number of years, using the latest DSE-published dividend yield × LTP as the annual dividend per share.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_100px_auto] sm:items-end">
        <SymbolPicker
          symbol={symbol}
          onChange={setSymbol}
          instruments={instruments}
          instrumentsError={instrumentsError}
          disabled={pending}
        />
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Shares
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={sharesStr}
            onChange={(e) => setSharesStr(e.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-md border border-[var(--line-strong)] bg-[var(--bg-surface)] px-2 py-1.5 font-mono text-[15px] text-[var(--ink-strong)] outline-none focus:ring-1 ring-zinc-400"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Years
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={yearsStr}
            onChange={(e) => setYearsStr(e.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-md border border-[var(--line-strong)] bg-[var(--bg-surface)] px-2 py-1.5 font-mono text-[15px] text-[var(--ink-strong)] outline-none focus:ring-1 ring-zinc-400"
          />
        </div>
        <button
          type="button"
          onClick={handleCalculate}
          disabled={pending || symbol.trim().length === 0}
          className="rounded-md border border-[var(--line)] bg-[var(--accent-700)] px-4 py-2 text-[13px] font-medium text-white shadow-sm disabled:opacity-50"
        >
          {pending ? "Loading…" : "Load share"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
          Dividend handling
        </span>
        <ModeButton active={mode === "take"} onClick={() => setMode("take")}>
          Take dividend (cash)
        </ModeButton>
        <ModeButton active={mode === "reinvest"} onClick={() => setMode("reinvest")}>
          Reinvest dividend
        </ModeButton>
      </div>

      {data && data.error && (
        <p className="mt-3 rounded-md bg-[var(--warn-50)] px-3 py-2 text-[12px] text-amber-900">
          {data.error}
        </p>
      )}

      {data && !data.error && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold text-[var(--ink-strong)]">{data.symbol}</span>
            {data.sector && (
              <span className="text-[12px] text-[var(--ink-muted)]">{data.sector}</span>
            )}
            {data.currentPrice !== null && (
              <span className="ml-auto text-[12px] text-[var(--ink-muted)]">
                LTP <span className="font-semibold text-[var(--ink-strong)]">{fmtPrice(data.currentPrice)}</span>
              </span>
            )}
          </div>

          <div className="rounded-lg bg-[var(--bg-canvas)] px-3 py-2">
            <AdvRow
              label="Dividend Yield"
              value={fmt(data.divYieldPct, "%")}
              context="Latest DSE-published"
            />
            <AdvRow
              label="Annual Dividend / share"
              value={dps !== null ? fmtMoney(dps) : "—"}
              context="Yield × LTP"
            />
            {inputsReady && mode === "take" && (
              <>
                <AdvRow
                  label={`Annual cash for ${shares.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} shares`}
                  value={annualTotal !== null ? fmtMoney(annualTotal) : "—"}
                />
                <AdvRow
                  label={`Total over ${years} year${years === 1 ? "" : "s"}`}
                  value={totalOverYears !== null ? fmtMoney(totalOverYears) : "—"}
                  context="Flat — paid out as cash"
                  highlight={totalOverYears !== null && totalOverYears > 0 ? "positive" : "neutral"}
                />
              </>
            )}
            {inputsReady && mode === "reinvest" && (
              <>
                <AdvRow
                  label={`Final share count after ${years} year${years === 1 ? "" : "s"}`}
                  value={
                    reinvestFinalShares !== null
                      ? reinvestFinalShares.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                      : "—"
                  }
                  context={
                    reinvestExtraShares !== null
                      ? `+${reinvestExtraShares.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} from reinvestment`
                      : undefined
                  }
                  highlight={
                    reinvestExtraShares !== null && reinvestExtraShares > 0 ? "positive" : "neutral"
                  }
                />
                <AdvRow
                  label="Cumulative dividends reinvested"
                  value={reinvestCumulativeCash !== null ? fmtMoney(reinvestCumulativeCash) : "—"}
                  context="Sum of all reinvested payouts"
                />
                <AdvRow
                  label="Final position value"
                  value={reinvestFinalValue !== null ? fmtMoney(reinvestFinalValue) : "—"}
                  context="Final shares × LTP"
                  highlight={
                    reinvestFinalValue !== null && reinvestFinalValue > 0 ? "positive" : "neutral"
                  }
                />
              </>
            )}
          </div>

          {dps === null && (
            <p className="text-[11.5px] text-[var(--ink-muted)]">
              No dividend yield published for this share — projection unavailable.
            </p>
          )}
          {!inputsReady && dps !== null && (
            <p className="text-[11.5px] text-[var(--ink-muted)]">
              Enter share count and years to see the total projection.
            </p>
          )}
          <p className="text-[10.5px] leading-relaxed text-[var(--ink-muted)]">
            Estimate only. Uses the latest DSE-published dividend yield as a flat annual rate; actual future dividends depend on company performance, board decisions, and AGM approval. Reinvest mode assumes payouts buy more shares at the current price (zero price drift) — real results vary with market and re-entry timing.
          </p>
        </div>
      )}
    </div>
  );
}
