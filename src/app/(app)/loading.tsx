/**
 * Route-group level loading UI. Renders instantly when navigating between any
 * page under (app), so route transitions feel snappy while server work runs.
 */
export default function AppLoading() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-4 sm:px-4">
      <div className="flex flex-col gap-3">
        <div className="h-7 w-40 animate-pulse rounded bg-[var(--bg-surface-soft)]" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-32 w-full animate-pulse rounded-xl bg-[var(--bg-surface-soft)]" />
          <div className="h-32 w-full animate-pulse rounded-xl bg-[var(--bg-surface-soft)]" />
        </div>
        <div className="h-48 w-full animate-pulse rounded-xl bg-[var(--bg-surface-soft)]" />
        <div className="h-32 w-full animate-pulse rounded-xl bg-[var(--bg-surface-soft)]" />
      </div>
    </div>
  );
}
