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
        href: "/record",
        label: "Transaction",
        icon: <TransactionsIcon />,
    },
    {
        href: "/trade-history",
        label: "History",
        icon: <HistoryIcon />,
    },
    {
        href: "/allocation",
        label: "Allocation",
        icon: <AllocationIcon />,
    },
    {
        href: "/dividend",
        label: "Dividend",
        icon: <DividendIcon />,
    },
    {
        href: "/settings",
        label: "Settings",
        icon: <SettingsIcon />,
    },
];

/**
 * Fixed bottom navigation shown only on `< md` viewports (iPhone 12/13/14/15
 * widths 375–414px). Tabs: Portfolio, Transaction (record), History (trade
 * history), Allocation, Dividend, Settings — and respect the iOS safe-area
 * inset so the bar never sits under the home gesture.
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
            <ul className="flex items-stretch justify-around gap-0.5 px-1 pt-1.5">
                {TABS.map((tab) => {
                    const active =
                        pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                    return (
                        <li key={tab.href} className="flex-1">
                            <Link
                                href={tab.href}
                                aria-label={tab.label}
                                aria-current={active ? "page" : undefined}
                                className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 transition-colors no-underline hover:no-underline ${
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
                                <span className="text-[10px] leading-tight tracking-tight">
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

function HistoryIcon() {
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
            <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
            <path d="M3 4v4h4" />
            <path d="M12 8v4l3 1.5" />
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

function DividendIcon() {
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
            <circle cx="9" cy="11" r="6" />
            <path d="M9 8v6" />
            <path d="M11 9.5c-.5-.7-1.5-1-2.5-1-1.5 0-2.5.7-2.5 1.7 0 2.3 5 1.3 5 3.6 0 1-.9 1.7-2.5 1.7-1 0-2-.3-2.5-1" />
            <path d="M16.5 7.5a6 6 0 0 1 0 7" />
            <path d="M19 5a9 9 0 0 1 0 12" />
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
