"use client";

import type { ReactNode } from "react";

/* ── Card shell ─────────────────────────────────────────────────────────── */

type Tone = "acc" | "gain" | "warn" | "loss";

export function SCard({ children }: { children: ReactNode }) {
  return <div className="card">{children}</div>;
}

export function SCardHead({
  tone,
  icon,
  title,
  desc,
  right,
}: {
  tone: Tone;
  icon: ReactNode;
  title: string;
  desc?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="card-head">
      <span className={`card-ico ${tone}`}>{icon}</span>
      <div
        className="card-head-text"
        style={
          right
            ? { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: 8 }
            : undefined
        }
      >
        <div>
          <h2>{title}</h2>
          {desc ? <p>{desc}</p> : null}
        </div>
        {right}
      </div>
    </div>
  );
}

export function SCardBody({ children }: { children: ReactNode }) {
  return <div className="card-body">{children}</div>;
}

/* ── Stat chips ─────────────────────────────────────────────────────────── */

export function SStats({ children }: { children: ReactNode }) {
  return <div className="stats">{children}</div>;
}

export function SStat({
  k,
  v,
  d,
  tone,
  small,
}: {
  k: string;
  v: ReactNode;
  d?: ReactNode;
  tone?: "gain" | "loss";
  small?: boolean;
}) {
  return (
    <div className="stat">
      <p className="k">{k}</p>
      <p className={`v ${tone ?? ""}`} style={small ? { fontSize: 15 } : undefined}>
        {v}
      </p>
      {d ? <p className="d">{d}</p> : null}
    </div>
  );
}

/* ── Inline feedback ────────────────────────────────────────────────────── */

export function SOk({ children }: { children: ReactNode }) {
  return (
    <div className="alert ok">
      <div className="at">{children}</div>
    </div>
  );
}

export function SErr({ children }: { children: ReactNode }) {
  return (
    <div className="alert err">
      <div className="at">{children}</div>
    </div>
  );
}

export function SWarn({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="alert warn">
      <div className="at">
        {title ? <b>{title}</b> : null}
        {children}
      </div>
    </div>
  );
}

/* ── Icons (18px sidebar / 20px card-head; size set by caller) ──────────── */

function svg(path: ReactNode, size = 20) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

export const Icons = {
  profile: (s?: number) =>
    svg(
      <>
        <circle cx="12" cy="8" r="3.6" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>,
      s,
    ),
  password: (s?: number) =>
    svg(
      <>
        <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      </>,
      s,
    ),
  targets: (s?: number) =>
    svg(
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="0.7" fill="currentColor" />
      </>,
      s,
    ),
  monthly: (s?: number) =>
    svg(
      <>
        <rect x="4" y="5.5" width="16" height="14" rx="2" />
        <path d="M4 9.5h16M8 3.5v3M16 3.5v3" />
      </>,
      s,
    ),
  sell: (s?: number) =>
    svg(
      <>
        <path d="M4 16l5-5 3.5 3.5L20 7" />
        <path d="M20 11V7h-4" />
      </>,
      s,
    ),
  topsectors: (s?: number) =>
    svg(
      <>
        <path d="M5.5 4h7l6.5 6.5a2 2 0 0 1 0 2.8l-4.7 4.7a2 2 0 0 1-2.8 0L5 11.5V4Z" />
        <circle cx="9" cy="8" r="1.2" />
      </>,
      s,
    ),
  cash: (s?: number) =>
    svg(
      <>
        <rect x="3" y="6.5" width="18" height="11" rx="2" />
        <circle cx="12" cy="12" r="2.4" />
      </>,
      s,
    ),
  positions: (s?: number) =>
    svg(
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <rect x="7" y="11" width="3" height="5" />
        <rect x="13" y="7" width="3" height="9" />
      </>,
      s,
    ),
  email: (s?: number) =>
    svg(
      <>
        <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
        <path d="m4.5 7 7.5 5.5L19.5 7" />
      </>,
      s,
    ),
  delivery: (s?: number) =>
    svg(
      <>
        <path d="M12 3v9l5 3" />
        <circle cx="12" cy="12" r="8.5" />
      </>,
      s,
    ),
  warn: (s?: number) =>
    svg(
      <>
        <path d="M12 9v4M12 16.5v.5" />
        <path d="M10.3 4.3 3 17a2 2 0 0 0 1.7 3h14.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      </>,
      s,
    ),
  history: (s?: number) =>
    svg(<path d="M5 7h14M5 12h14M5 17h9" />, s),
  search: (s?: number) =>
    svg(
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" />
      </>,
      s,
    ),
};
