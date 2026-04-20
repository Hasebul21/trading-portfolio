import type { ReactNode } from "react";

/** Consistent page title — same size/weight as body; gradient for emphasis (no bold). */
export function AppPageHeader({ title }: { title: string }) {
  return (
    <div className="text-center">
      <h1 className="bg-gradient-to-r from-zinc-900 via-teal-700 to-zinc-900 bg-clip-text text-[15px] font-normal tracking-normal text-transparent dark:from-zinc-100 dark:via-teal-300 dark:to-zinc-100">
        {title}
      </h1>
      <div
        className="mx-auto mt-3 h-0.5 w-28 max-w-[min(45%,14rem)] rounded-full bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-500 opacity-90 shadow-md shadow-teal-500/25 dark:from-teal-500 dark:via-emerald-400 dark:to-teal-400 dark:shadow-teal-900/40"
        aria-hidden
      />
    </div>
  );
}

export function AppSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-center text-[15px] font-normal tracking-normal text-zinc-800 dark:text-zinc-100">
      <span className="relative inline-block">
        {children}
        <span
          className="absolute -bottom-0.5 left-1/2 h-px w-[calc(100%+0.25rem)] -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-teal-500/50 to-transparent"
          aria-hidden
        />
      </span>
    </h2>
  );
}
