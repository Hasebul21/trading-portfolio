"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/portfolio", label: "Portfolio" },
  { href: "/record", label: "Record" },
  { href: "/trade-history", label: "Trade history" },
  { href: "/invested", label: "Invested" },
  { href: "/long-term", label: "Watchlist" },
  { href: "/trade-plans", label: "Targets" },
] as const;

export function AppShellNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex flex-1 flex-wrap items-center justify-center gap-2 sm:justify-start sm:gap-2.5">
      {LINKS.map(({ href, label }) => {
        const active =
          pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={
              active
                ? "rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-md shadow-teal-600/25 ring-1 ring-white/20 transition hover:brightness-110 dark:from-teal-500 dark:to-emerald-500 dark:shadow-teal-900/40"
                : "rounded-full px-3.5 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100"
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
