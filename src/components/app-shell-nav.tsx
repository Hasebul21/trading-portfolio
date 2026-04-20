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
    /** Long label: slightly tighter pill so it fits on small screens. */
    linkClassName: "px-2.5 py-1.5 text-[11px] leading-snug sm:px-3.5 sm:py-2 sm:text-sm sm:leading-normal",
  },
] as const;

export function AppShellNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex flex-1 flex-wrap items-center justify-center gap-2 sm:justify-start sm:gap-2.5">
      {LINKS.map((item) => {
        const { href, label } = item;
        const linkClassName = "linkClassName" in item ? item.linkClassName : undefined;
        const active =
          pathname === href || pathname.startsWith(`${href}/`);
        const base =
          active
            ? "rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-md shadow-teal-600/25 ring-1 ring-white/20 transition hover:brightness-110 dark:from-teal-500 dark:to-emerald-500 dark:shadow-teal-900/40"
            : "rounded-full px-3.5 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100";
        return (
          <Link
            key={href}
            href={href}
            className={linkClassName ? `${base} ${linkClassName}` : base}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
