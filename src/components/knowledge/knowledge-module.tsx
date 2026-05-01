"use client";

import { addKnowledgeNote, deleteKnowledgeNote } from "@/app/(app)/knowledge/actions";
import { Alert, Button, Input, Pagination, Tag } from "antd";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

// ─── Static entries ──────────────────────────────────────────────────────────

type StaticEntry = {
  id: string;
  source: "fundamental" | "playbook";
  title: string;
  body: string;
};

const STATIC_ENTRIES: StaticEntry[] = [
  {
    id: "s-roe",
    source: "fundamental",
    title: "ROE (Return on Equity)",
    body: "This measures how much profit a company generates with the money shareholders have invested. If you give a company $100 and they make $20 in profit, the ROE is 20%. A high ROE means management is money-smart — they are efficient at turning your investment into more profit without needing to borrow massive amounts of debt.",
  },
  {
    id: "s-navps",
    source: "fundamental",
    title: "NAVPS (Net Asset Value Per Share)",
    body: "Imagine the company closed down today, sold every desk, building, and computer, paid off all its debts, and divided the leftover cash among shareholders. That leftover cash per share is the NAVPS. It acts as a safety floor — if a stock's market price is much lower than its NAVPS it might be a bargain because the company is selling for less than the value of its physical parts.",
  },
  {
    id: "s-eps",
    source: "fundamental",
    title: "EPS (Earnings Per Share)",
    body: "This is the portion of a company's profit allocated to each individual share of stock. If a company makes $1,000 profit and has 1,000 shares, the EPS is $1. This is the most watched number in the stock market — when EPS goes up, the stock price eventually follows. It tells you exactly how much earning power your single share holds.",
  },
  {
    id: "s-pe",
    source: "fundamental",
    title: "P/E Ratio (Price-to-Earnings)",
    body: "This tells you how much investors are willing to pay today for $1 of the company's earnings. If the P/E is 15, you are paying $15 for every $1 the company earns. High P/E means investors expect massive growth; they pay a premium now. Low P/E can mean the stock is undervalued, or investors are worried about the company's future.",
  },
  {
    id: "s-div",
    source: "fundamental",
    title: "Dividend Yield",
    body: "Think of this like the interest rate on a savings account, but for a stock. It is the percentage of the stock price the company pays back to you in cash every year. If a stock costs $100 and has a 5% yield, you get $5 in cash per year just for owning it, regardless of whether the stock price goes up or down.",
  },
  {
    id: "s-pb-last",
    source: "playbook",
    title: "Last Price (DSE)",
    body: "Buy when the last price is moving up with strength — especially above the session midpoint or breaking upside targets with conviction. Sell when price drops below key levels you care about, or you have reached your target profit. Always compare with your average cost before acting so you know if you are green, red, or adding risk.",
  },
  {
    id: "s-pb-pivot",
    source: "playbook",
    title: "Session Midpoint (Pivot)",
    body: "If price stays above the pivot and holds — the session is often showing relative strength. If price stays below the pivot — weakness tends to dominate; be careful chasing longs. If price chops around the pivot — direction is unclear; let the market pick a side first.",
  },
  {
    id: "s-pb-support",
    source: "playbook",
    title: "Downside Targets (Support)",
    body: "Buy near support only if price shows signs of bouncing — not only because the number is there. If support breaks strongly — more downside is likely; protect capital per your rules. First target often marks a shallow reaction; the second can be a deeper bounce zone if buyers return.",
  },
  {
    id: "s-pb-resist",
    source: "playbook",
    title: "Upside Targets (Resistance)",
    body: "Near resistance zones is a natural place to trim or take profit if your plan says so. Only buy if price breaks resistance with strong momentum — continuation setups, not guesses. Buying just below resistance is often poor risk-reward unless you have a clear breakout plan.",
  },
  {
    id: "s-pb-52",
    source: "playbook",
    title: "52-Week High / Low",
    body: "Buy near yearly lows only if real recovery signs show up — never blindly because it looks cheap. Near yearly highs, if momentum slows, be cautious about new buys — pullback risk rises. Highs often mean strength plus elevated risk; lows can mean weakness plus potential opportunity — context only.",
  },
  {
    id: "s-pb-avg",
    source: "playbook",
    title: "Average Cost Per Share",
    body: "If price is near support and below your average, averaging down can make sense only if you size it carefully and accept the risk. When price is above your average and near resistance, taking some profit can match a disciplined exit plan. Always know your average cost before any decision — it is your anchor for P/L and sizing.",
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

export type KnowledgeNoteDTO = {
  id: string;
  created_at: string;
  title: string;
  body: string;
};

type Entry =
  | (StaticEntry & { kind: "static" })
  | (KnowledgeNoteDTO & { kind: "user" });

const PAGE_SIZE = 8;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sourceLabel(e: Entry) {
  if (e.kind === "user") return { label: "My note", color: "purple" as const };
  if (e.source === "fundamental") return { label: "Fundamental", color: "blue" as const };
  return { label: "Playbook", color: "green" as const };
}

function entryMatches(e: Entry, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    e.title.toLowerCase().includes(lower) || e.body.toLowerCase().includes(lower)
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function KnowledgeModule({ notes }: { notes: KnowledgeNoteDTO[] }) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [addTitle, setAddTitle] = useState("");
  const [addBody, setAddBody] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const allEntries: Entry[] = useMemo(() => {
    const staticMapped: Entry[] = STATIC_ENTRIES.map((e) => ({ ...e, kind: "static" as const }));
    const userMapped: Entry[] = notes.map((n) => ({ ...n, kind: "user" as const }));
    return [...userMapped, ...staticMapped];
  }, [notes]);

  const filtered = useMemo(() => {
    const q = search.trim();
    return allEntries.filter((e) => entryMatches(e, q));
  }, [allEntries, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageEntries = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearchChange = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);

  const handleAdd = useCallback(async () => {
    setAddError(null);
    setAddBusy(true);
    const fd = new FormData();
    fd.set("title", addTitle.trim());
    fd.set("body", addBody.trim());
    const res = await addKnowledgeNote(fd);
    setAddBusy(false);
    if (!res.ok) {
      setAddError(res.error);
      return;
    }
    setAddTitle("");
    setAddBody("");
    router.refresh();
  }, [addTitle, addBody, router]);

  const handleDelete = useCallback(
    async (id: string) => {
      setDeleteError(null);
      setDeleteBusyId(id);
      const fd = new FormData();
      fd.set("id", id);
      const res = await deleteKnowledgeNote(fd);
      setDeleteBusyId(null);
      if (!res.ok) {
        setDeleteError(res.error);
        return;
      }
      router.refresh();
    },
    [router],
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">

      {/* ── Add note card ── */}
      <div className="overflow-hidden rounded-2xl border border-teal-200/60 bg-gradient-to-br from-white to-teal-50/40 shadow-md ring-1 ring-teal-500/10 dark:border-teal-900/50 dark:from-zinc-900 dark:to-teal-950/30 dark:ring-teal-500/10">
        {/* Card header */}
        <div className="border-b border-teal-200/50 bg-teal-600/8 px-5 py-3.5 dark:border-teal-800/50 dark:bg-teal-500/10">
          <h2 className="text-[17px] font-normal leading-snug text-teal-900 dark:text-teal-100">
            Add a knowledge note
          </h2>
          <p className="mt-0.5 text-[14px] font-normal text-teal-800/70 dark:text-teal-300/70">
            Save anything you want to remember — concepts, rules, personal observations.
          </p>
        </div>
        {/* Card body */}
        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-normal text-zinc-50">
              Title
            </label>
            <input
              type="text"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              placeholder="e.g. EPS growth rule, P/B Ratio, Support bounce setup…"
              maxLength={200}
              className="box-border w-full rounded-lg border border-zinc-300/90 bg-white px-4 py-2.5 text-[15px] font-normal text-zinc-900 outline-none focus:ring-2 focus:ring-teal-500/40 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-normal text-zinc-50">
              Note
            </label>
            <textarea
              value={addBody}
              onChange={(e) => setAddBody(e.target.value)}
              placeholder="Write your note here — explain the concept, share a rule, or describe when to apply it…"
              rows={5}
              className="box-border w-full resize-y rounded-lg border border-zinc-300/90 bg-white px-4 py-2.5 text-[15px] font-normal leading-relaxed text-zinc-900 outline-none focus:ring-2 focus:ring-teal-500/40 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>
          {addError ? <Alert type="error" showIcon message={addError} /> : null}
          <div className="flex justify-end">
            <Button
              type="primary"
              size="large"
              loading={addBusy}
              disabled={addBusy || !addTitle.trim() || !addBody.trim()}
              onClick={() => void handleAdd()}
              className="px-8"
            >
              Add note
            </Button>
          </div>
        </div>
      </div>

      {/* ── Search bar ── */}
      <Input.Search
        value={search}
        onChange={(e) => handleSearchChange(e.target.value)}
        onSearch={handleSearchChange}
        placeholder="Search by keyword — e.g. EPS, NAV, pivot, ROE…"
        allowClear
        size="large"
        aria-label="Search knowledge entries"
      />

      {/* ── Results summary ── */}
      <p className="text-[14px] font-normal text-zinc-50">
        {search.trim()
          ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""} for "${search.trim()}"`
          : `${allEntries.length} entries`}
        {" — "}page {safePage} of {totalPages}
      </p>

      {deleteError ? (
        <Alert
          type="error"
          showIcon
          closable
          message={deleteError}
          onClose={() => setDeleteError(null)}
        />
      ) : null}

      {/* ── Entry list ── */}
      {pageEntries.length === 0 ? (
        <p className="rounded-lg border border-zinc-200/70 bg-zinc-50/80 px-4 py-6 text-center text-[15px] font-normal text-zinc-50 dark:border-zinc-700/50 dark:bg-zinc-900/50">
          No entries match your search.
        </p>
      ) : (
        <div className="space-y-3">
          {pageEntries.map((entry) => {
            const { label, color } = sourceLabel(entry);
            const isUser = entry.kind === "user";
            return (
              <article
                key={entry.id}
                className="rounded-xl border border-zinc-200/80 bg-white/85 px-4 py-3 shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900/60"
              >
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag color={color} className="m-0 shrink-0 text-[13px]">
                      {label}
                    </Tag>
                    <h3 className="text-[15px] font-normal leading-snug text-teal-800 dark:text-teal-200">
                      {entry.title}
                    </h3>
                  </div>
                  {isUser ? (
                    <Button
                      type="link"
                      danger
                      size="small"
                      loading={deleteBusyId === entry.id}
                      disabled={deleteBusyId !== null && deleteBusyId !== entry.id}
                      onClick={() => void handleDelete(entry.id)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
                <p className="text-[15px] font-normal leading-relaxed text-zinc-50">
                  {entry.body}
                </p>
                {isUser ? (
                  <p className="mt-1.5 text-[13px] font-normal text-zinc-50">
                    Added {new Date(entry.created_at).toLocaleDateString()}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 ? (
        <div className="flex justify-center">
          <Pagination
            current={safePage}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onChange={(p) => setPage(p)}
            showSizeChanger={false}
            showTotal={(total, range) => `${range[0]}–${range[1]} of ${total}`}
          />
        </div>
      ) : null}

      <p className="rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-center text-[15px] font-normal leading-snug text-zinc-50 dark:border-zinc-700/60 dark:bg-zinc-900/50">
        Personal use only — not financial advice.
      </p>
    </div>
  );
}
