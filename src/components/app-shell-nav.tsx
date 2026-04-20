"use client";

import {
  siteNavLinkActiveClass,
  siteNavLinkBaseClass,
  siteNavLinkIdleClass,
} from "@/lib/site-typography";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/portfolio", label: "Holdings" },
  { href: "/record", label: "Log" },
  { href: "/trade-history", label: "Ledger" },
  { href: "/invested", label: "Capital" },
  { href: "/long-term", label: "Long Term" },
  { href: "/charts", label: "Charts" },
  { href: "/trade-plans", label: "Instant Trade Action" },
  { href: "/knowledge", label: "Knowledge" },
] as const;

const stripClass =
  "flex w-full max-w-3xl flex-wrap items-center justify-center gap-1 rounded-lg border border-zinc-200/90 bg-zinc-50/90 p-1 shadow-inner shadow-zinc-900/[0.03] dark:border-zinc-700/80 dark:bg-zinc-900/55 dark:shadow-black/20";

export function AppShellNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Main" className={stripClass}>
      {LINKS.map((item) => {
        const { href, label } = item;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const state = active ? siteNavLinkActiveClass : siteNavLinkIdleClass;
        return (
          <Link key={href} href={href} className={`${siteNavLinkBaseClass} ${state}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
