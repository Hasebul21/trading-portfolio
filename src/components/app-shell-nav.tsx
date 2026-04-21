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
  { href: "/record", label: "Transaction" },
  { href: "/trade-history", label: "Transaction History" },
  { href: "/invested", label: "Capital" },
  { href: "/long-term", label: "Long-horizon plan" },
  { href: "/trade-plans", label: "Quick-trade board" },
  { href: "/knowledge", label: "Knowledge" },
] as const;

/** Mobile: one row, horizontal scroll. `md+`: wrap and cap width like a pill cluster. */
const stripClass =
  "inline-flex w-max max-w-none flex-nowrap items-stretch gap-0.5 rounded-lg border border-zinc-200/90 bg-zinc-50/90 p-0.5 shadow-inner shadow-zinc-900/[0.03] dark:border-zinc-700/80 dark:bg-zinc-900/55 dark:shadow-black/20 md:flex md:w-full md:max-w-3xl md:flex-wrap md:items-center md:justify-center md:gap-1 md:p-1";

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
