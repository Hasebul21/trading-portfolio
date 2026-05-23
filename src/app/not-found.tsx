import { connection } from "next/server";
import Link from "next/link";

/**
 * Custom 404 page. `connection()` opts this route into dynamic rendering,
 * which prevents Next.js PPR from trying to statically prerender the root
 * layout (which includes AntdRegistry → @ant-design/cssinjs → Math.random()).
 */
export default async function NotFound() {
  await connection();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="text-[13px] uppercase tracking-widest text-[var(--ink-muted)]">404</p>
      <h1 className="text-[22px] font-semibold tracking-tight text-[var(--ink-strong)]">
        Page not found
      </h1>
      <Link
        href="/portfolio"
        className="mt-2 rounded-full border border-[var(--line)] px-4 py-1.5 text-[13px] text-[var(--ink-default)] transition-colors hover:border-[var(--line-strong)]"
      >
        Go to portfolio
      </Link>
    </div>
  );
}
