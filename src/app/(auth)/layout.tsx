export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 via-emerald-500 to-teal-700 text-white shadow-lg shadow-teal-900/20">
            <span className="font-mono text-[18px] tracking-tight">TP</span>
          </div>
          <div className="space-y-1">
            <h1 className="text-[20px] font-normal tracking-tight text-zinc-900 dark:text-zinc-50">
              Trading Portfolio
            </h1>
            <p className="text-[14px] font-normal text-zinc-600 dark:text-zinc-400">
              Track holdings, plans, and history in one place.
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
