import { AppShellNav } from "@/components/app-shell-nav";
import { AvgBuyPriceButton } from "@/components/avg-buy-price-button";
import { FloatingCalculator } from "@/components/floating-calculator";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { TopSectorsStrip } from "@/components/top-sectors-strip";
import { AntdAppProvider } from "./antd-app-provider";
import { signOut } from "./actions";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AntdAppProvider>
      <div className="app-shell flex min-h-full flex-1 flex-col bg-[var(--bg-canvas)] text-[var(--ink-strong)]">
        {/*
          Top app bar — minimal chrome. Mobile shows the brand + theme
          toggle; desktop replaces the brand with the pill nav and keeps
          theme + log-out on the right.
        */}
        <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--bg-surface)]">
          <div
            className="mx-auto flex w-full max-w-[min(100%,1400px)] items-center gap-3 px-3 py-2 sm:px-4 sm:py-2.5 lg:px-6"
            style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 8px)" }}
          >
            {/* Mobile brand */}
            <span className="text-[15px] tracking-tight text-[var(--ink-strong)] md:hidden">
              Portfolio
            </span>

            {/* Desktop pill nav (hidden on mobile) */}
            <div className="hidden min-w-0 flex-1 md:block">
              <AppShellNav />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <AvgBuyPriceButton />
              <ThemeToggle />

              {/* Desktop log-out (mobile uses Settings) */}
              <form action={signOut} className="hidden md:flex md:shrink-0">
                <button
                  type="submit"
                  className="h-9 rounded-full border border-[var(--line)] bg-[var(--bg-surface)] px-3 text-[13px] text-[var(--ink-default)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--ink-strong)] sm:px-4"
                >
                  Log out
                </button>
              </form>
            </div>
          </div>
        </header>

        <TopSectorsStrip />

        <main className="app-main relative mx-auto w-full min-w-0 max-w-[min(100%,1400px)] flex-1 px-4 py-6 pb-10 text-left text-[14px] leading-relaxed text-[var(--ink-default)] sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>

        <footer className="mt-6 hidden border-t border-[var(--line)] bg-[var(--bg-surface)] py-4 md:block">
          <div
            className="mx-auto max-w-[min(100%,1400px)] px-4 sm:px-6 lg:px-8"
            aria-hidden
          />
        </footer>

        <MobileBottomNav />
        <FloatingCalculator />
      </div>
    </AntdAppProvider>
  );
}
