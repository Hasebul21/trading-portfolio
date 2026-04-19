/** Consistent page title across app routes (server-safe). */
export function AppPageHeader({ title }: { title: string }) {
  return (
    <h1 className="mb-10 border-b border-zinc-200 pb-5 text-center text-3xl font-semibold tracking-tight text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
      {title}
    </h1>
  );
}

export function AppSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100">
      {children}
    </h2>
  );
}
