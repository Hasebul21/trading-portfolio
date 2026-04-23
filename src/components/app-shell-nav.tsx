"use client";

import {
  siteNavLinkActiveClass,
  siteNavLinkBaseClass,
  siteNavLinkIdleClass,
} from "@/lib/site-typography";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem =
  | { type: "link"; href: string; label: string }
  | { type: "divider" };

const NAV_ITEMS: NavItem[] = [
  // ── Portfolio group ────────────────────────────
  { type: "link", href: "/portfolio", label: "Portfolio" },
  { type: "link", href: "/record", label: "Transaction" },
  { type: "link", href: "/long-term", label: "Watchlist" },
  { type: "divider" },
  // ── Trading group ─────────────────────────────
  { type: "link", href: "/trade-plans", label: "Quick-trade" },
  { type: "link", href: "/mip", label: "MIP" },
  { type: "link", href: "/draft-mip", label: "Draft MIP" },
  { type: "divider" },
  // ── Records / misc ────────────────────────────
  { type: "link", href: "/trade-history", label: "History" },
  { type: "link", href: "/invested", label: "Capital" },
  { type: "link", href: "/knowledge", label: "Knowledge" },
  { type: "link", href: "/settings", label: "Settings" },
];

/** Mobile: wrapped pill navigation. md+: full-width pill spanning the header. */
const stripClass =
  "flex w-full flex-wrap items-center justify-center gap-1 rounded-xl border border-zinc-200/90 bg-zinc-50/90 p-1 shadow-inner shadow-zinc-900/[0.03] dark:border-zinc-700/80 dark:bg-zinc-900/55 dark:shadow-black/20 md:justify-between md:gap-0.5";

const dividerClass =
  "mx-0.5 hidden h-5 w-px shrink-0 rounded-full bg-zinc-300/80 dark:bg-zinc-700/80 md:block";

export function AppShellNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Main" className={stripClass}>
      {NAV_ITEMS.map((item, i) => {
        if (item.type === "divider") {
          return <span key={`div-${i}`} className={dividerClass} aria-hidden />;
        }
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
