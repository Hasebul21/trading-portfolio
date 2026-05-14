"use client";

import { siteTextLinkNeutralClass } from "@/lib/site-typography";
import Link from "next/link";
import { useActionState } from "react";
import { login, type AuthActionState } from "./actions";

const initial: AuthActionState = {};

export function LoginForm() {
 const [state, formAction, pending] = useActionState(login, initial);

 return (
 <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] p-8 shadow-sm ">
 <h2 className="text-[15px] font-normal tracking-normal text-[var(--ink-strong)] ">
 Sign in
 </h2>
 {state.error ? (
 <p
 className="mt-4 rounded-lg bg-[var(--loss-50)] px-3 py-2 text-[15px] font-normal text-[var(--loss-700)] "
 role="alert"
 >
 {state.error}
 </p>
 ) : null}
 <form action={formAction} className="mt-6 flex flex-col gap-4">
 <label className="block text-[15px] font-normal text-[var(--ink-strong)] ">
 Email
 <input
 name="email"
 type="email"
 autoComplete="email"
 required
 className="mt-1 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg-surface)] px-3 py-2 text-[15px] font-normal text-[var(--ink-strong)] outline-none ring-zinc-400 focus:ring-2 "
 />
 </label>
 <label className="block text-[15px] font-normal text-[var(--ink-strong)] ">
 Password
 <input
 name="password"
 type="password"
 autoComplete="current-password"
 required
 className="mt-1 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--bg-surface)] px-3 py-2 text-[15px] font-normal text-[var(--ink-strong)] outline-none ring-zinc-400 focus:ring-2 "
 />
 </label>
 <button
 type="submit"
 disabled={pending}
 className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-2.5 text-[15px] font-normal text-white shadow-md shadow-teal-600/25 transition hover:brightness-110 disabled:opacity-60 "
 >
 {pending ? (
 <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 ) : null}
 {pending ? "Signing in…" : "Sign in"}
 </button>
 </form>
 <p className="mt-6 text-center text-[15px] font-normal text-[var(--ink-muted)] ">
 No account?{" "}
 <Link href="/register" className={siteTextLinkNeutralClass}>
 Register
 </Link>
 </p>
 </div>
 );
}
