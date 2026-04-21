import { AppShellNav } from "@/components/app-shell-nav";
import { AntdAppProvider } from "./antd-app-provider";
import { signOut } from "./actions";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AntdAppProvider>
    <div className="app-shell flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/75 shadow-sm shadow-zinc-900/5 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/75 dark:shadow-black/20">
        <div className="mx-auto flex w-full max-w-[min(100%,1920px)] items-center gap-3 px-3 py-2 sm:px-4 sm:py-2.5 lg:px-6">
          {/* Nav — scrollable on mobile, full-width pill on larger screens */}
          <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
            <AppShellNav />
          </div>
          <form action={signOut} className="shrink-0">
            <button
              type="submit"
              className="rounded-full border border-zinc-300/90 bg-white px-3 py-1.5 text-[15px] font-normal text-zinc-700 shadow-sm transition hover:border-teal-500/40 hover:bg-teal-50/80 hover:text-teal-900 sm:px-3.5 sm:py-2 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:border-teal-500/30 dark:hover:bg-teal-950/50 dark:hover:text-teal-100"
            >
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="relative mx-auto w-full min-w-0 max-w-[min(100%,1920px)] flex-1 px-3 py-4 pb-10 text-center text-[15px] leading-relaxed text-zinc-800 sm:px-6 sm:py-6 lg:px-8 dark:text-zinc-200">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_90%_50%_at_50%_-20%,rgba(20,184,166,0.12),transparent_55%)] dark:bg-[radial-gradient(ellipse_80%_45%_at_50%_-15%,rgba(45,212,191,0.08),transparent_50%)]" aria-hidden />
        {children}
      </main>
      <footer className="mt-6 border-t border-zinc-200/80 bg-gradient-to-b from-white/90 to-zinc-50 py-4 dark:border-zinc-800/80 dark:from-zinc-950/90 dark:to-zinc-950">
        <div className="mx-auto max-w-[min(100%,1920px)] px-4 sm:px-6 lg:px-8" aria-hidden />
      </footer>
    </div>
    </AntdAppProvider>
  );
}
