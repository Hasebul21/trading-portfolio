import Link from "next/link";
import { AntdAppProvider } from "./antd-app-provider";
import { signOut } from "./actions";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AntdAppProvider>
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex h-16 w-full max-w-[min(100%,1920px)] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <nav className="flex flex-1 flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center text-base font-medium text-zinc-800 sm:justify-start dark:text-zinc-200">
            <Link
              href="/portfolio"
              className="text-zinc-900 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
            >
              Portfolio
            </Link>
            <Link
              href="/record"
              className="text-zinc-900 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
            >
              Record
            </Link>
            <Link
              href="/trade-history"
              className="text-zinc-900 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
            >
              Trade history
            </Link>
            <Link
              href="/invested"
              className="text-zinc-900 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
            >
              Invested
            </Link>
            <Link
              href="/long-term"
              className="text-zinc-900 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
            >
              Long-term
            </Link>
            <Link
              href="/trade-plans"
              className="text-zinc-900 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
            >
              Trade plans
            </Link>
          </nav>
          <form action={signOut} className="shrink-0">
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[min(100%,1920px)] flex-1 px-4 py-10 text-center text-[15px] leading-relaxed text-zinc-800 sm:px-6 lg:px-8 dark:text-zinc-200">
        {children}
      </main>
      <footer className="mt-auto border-t border-zinc-200 bg-zinc-50/90 py-4 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400">
        <div className="mx-auto max-w-[min(100%,1920px)] px-4 sm:px-6 lg:px-8">
          Personal trading ledger — not financial advice.
        </div>
      </footer>
    </div>
    </AntdAppProvider>
  );
}
