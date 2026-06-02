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
  { type: "link", href: "/allocation", label: "Allocation" },
  { type: "link", href: "/trade-desk", label: "Trade Desk" },
  { type: "link", href: "/calculator", label: "Calculator" },
  { type: "link", href: "/dividend", label: "Dividend" },
  { type: "divider" },
  // ── Records / misc ────────────────────────────
  { type: "link", href: "/trade-history", label: "History" },
  { type: "link", href: "/knowledge", label: "Knowledge" },
  { type: "link", href: "/settings", label: "Settings" },
];

/** Mobile: wrapped pill navigation. md+: full-width pill spanning the header. */
const stripClass =
  "flex w-full flex-wrap items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--bg-surface-soft)] p-1 md:justify-between md:gap-0.5";

const dividerClass =
  "mx-0.5 hidden h-5 w-px shrink-0 rounded-full bg-[var(--line)] md:block";

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
