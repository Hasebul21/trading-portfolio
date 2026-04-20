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
        <div className="mx-auto flex min-h-16 w-full max-w-[min(100%,1920px)] flex-wrap items-center gap-x-4 gap-y-4 px-4 py-4 sm:gap-x-5 sm:gap-y-4 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-xl bg-gradient-to-br from-teal-500 via-emerald-600 to-teal-700 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-md shadow-teal-600/30 dark:from-teal-400 dark:via-emerald-500 dark:to-teal-600">
              Trading
            </span>
          </div>
          <AppShellNav />
          <form action={signOut} className="ml-auto shrink-0">
            <button
              type="submit"
              className="rounded-full border border-zinc-300/90 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-teal-500/40 hover:bg-teal-50/80 hover:text-teal-900 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:border-teal-500/30 dark:hover:bg-teal-950/50 dark:hover:text-teal-100"
            >
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="relative mx-auto w-full max-w-[min(100%,1920px)] flex-1 px-4 py-10 pb-12 text-center text-[15px] leading-relaxed text-zinc-800 sm:px-6 sm:py-12 lg:px-8 dark:text-zinc-200">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_90%_50%_at_50%_-20%,rgba(20,184,166,0.12),transparent_55%)] dark:bg-[radial-gradient(ellipse_80%_45%_at_50%_-15%,rgba(45,212,191,0.08),transparent_50%)]" aria-hidden />
        {children}
      </main>
      <footer className="mt-10 border-t border-zinc-200/80 bg-gradient-to-b from-white/90 to-zinc-50 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800/80 dark:from-zinc-950/90 dark:to-zinc-950 dark:text-zinc-500">
        <div className="mx-auto flex max-w-[min(100%,1920px)] flex-col gap-2 px-4 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-teal-500/70" aria-hidden />
            Personal use only — not financial advice.
          </span>
        </div>
      </footer>
    </div>
    </AntdAppProvider>
  );
}
