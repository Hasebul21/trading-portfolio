"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type MobileTab = {
    href: string;
    label: string;
    icon: ReactNode;
};

const TABS: MobileTab[] = [
    {
        href: "/portfolio",
        label: "Portfolio",
        icon: <PortfolioIcon />,
    },
    {
        href: "/long-term",
        label: "Watchlist",
        icon: <WatchlistIcon />,
    },
    {
        href: "/allocation",
        label: "Allocation",
        icon: <AllocationIcon />,
    },
    {
        href: "/settings",
        label: "Settings",
        icon: <SettingsIcon />,
    },
];

/**
 * Fixed bottom navigation shown only on `< md` viewports (iPhone 12/13/14/15
 * widths 375–414px). The four tabs match the spec — Portfolio, Transactions,
 * Allocation, Settings — and respect the iOS safe-area inset so the bar
 * never sits under the home gesture.
 */
export function MobileBottomNav() {
    const pathname = usePathname() ?? "";

    return (
        <nav
            aria-label="Mobile primary"
            className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--line)] bg-[var(--bg-surface)] md:hidden"
            style={{
                paddingBottom: "max(env(safe-area-inset-bottom, 0px), 6px)",
            }}
        >
            <ul className="flex items-stretch justify-around gap-1 px-2 pt-1.5">
                {TABS.map((tab) => {
                    const active =
                        pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                    return (
                        <li key={tab.href} className="flex-1">
                            <Link
                                href={tab.href}
                                aria-label={tab.label}
                                aria-current={active ? "page" : undefined}
                                className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 transition-colors no-underline hover:no-underline ${
                                    active
                                        ? "text-[var(--accent-700)]"
                                        : "text-[var(--ink-muted)]"
                                }`}
                            >
                                <span
                                    aria-hidden
                                    className={`flex h-6 w-6 items-center justify-center transition-transform ${
                                        active ? "scale-105" : ""
                                    }`}
                                >
                                    {tab.icon}
                                </span>
                                <span className="text-[11px] leading-tight tracking-tight">
                                    {tab.label}
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

/* ── Inline SVG icons (24px, currentColor — match the surrounding text colour). */

function PortfolioIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-full w-full"
        >
            <path d="M4 19V9.5l8-5 8 5V19" />
            <path d="M4 19h16" />
            <path d="M9 19v-5h6v5" />
        </svg>
    );
}

function TransactionsIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-full w-full"
        >
            <path d="M4 7h13" />
            <path d="m13 4 3 3-3 3" />
            <path d="M20 17H7" />
            <path d="m11 14-3 3 3 3" />
        </svg>
    );
}

function WatchlistIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-full w-full"
        >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function AllocationIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-full w-full"
        >
            <path d="M12 3a9 9 0 1 0 9 9h-9V3Z" />
            <path d="M14 4.4A8.5 8.5 0 0 1 19.6 10H14V4.4Z" />
        </svg>
    );
}

function SettingsIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-full w-full"
        >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
    );
}
