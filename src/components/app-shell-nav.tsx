"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/portfolio", label: "Holdings" },
  { href: "/record", label: "Log" },
  { href: "/trade-history", label: "Ledger" },
  { href: "/invested", label: "Capital" },
  { href: "/long-term", label: "Long Term" },
  {
    href: "/trade-plans",
    label: "Instant Trade Action",
    linkClassName:
      "px-2.5 py-2 text-[11px] font-semibold leading-snug sm:px-3.5 sm:py-2.5 sm:text-[13px] sm:leading-tight",
  },
  { href: "/knowledge", label: "Knowledge" },
] as const;

const stripClass =
  "flex w-full max-w-5xl flex-wrap items-center justify-center gap-1 rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-1 shadow-inner shadow-zinc-900/[0.03] dark:border-zinc-700/80 dark:bg-zinc-900/55 dark:shadow-black/20";

export function AppShellNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Main" className={stripClass}>
      {LINKS.map((item) => {
        const { href, label } = item;
        const linkClassName = "linkClassName" in item ? item.linkClassName : undefined;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const base = linkClassName
          ? linkClassName
          : "px-3 py-2 text-[13px] font-semibold tracking-tight sm:px-3.5 sm:py-2.5 sm:text-sm";
        const state = active
          ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-600/30 ring-1 ring-white/25 dark:from-teal-500 dark:to-emerald-500 dark:shadow-teal-950/50"
          : "text-zinc-600 hover:bg-white/90 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/90 dark:hover:text-zinc-50";
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-xl transition duration-200 ${base} ${state}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
