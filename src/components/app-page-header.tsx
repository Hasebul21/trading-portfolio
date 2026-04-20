/** Consistent page title across app routes (server-safe). */
export function AppPageHeader({ title }: { title: string }) {
  return (
    <div className="text-center">
      <h1 className="bg-gradient-to-r from-zinc-900 via-teal-800 to-zinc-900 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl dark:from-zinc-100 dark:via-teal-200 dark:to-zinc-100">
        {title}
      </h1>
      <div
        className="mx-auto mt-4 h-1 w-24 max-w-[min(40%,12rem)] rounded-full bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-600 shadow-lg shadow-teal-500/30"
        aria-hidden
      />
    </div>
  );
}

export function AppSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-center text-lg font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
      <span className="relative inline-block">
        {children}
        <span
          className="absolute -bottom-1 left-1/2 h-0.5 w-[calc(100%+0.5rem)] -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-teal-500/60 to-transparent"
          aria-hidden
        />
      </span>
    </h2>
  );
}
