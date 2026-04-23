"use client";

import { siteTextLinkNeutralClass } from "@/lib/site-typography";
import Link from "next/link";
import { useActionState } from "react";
import { register, type AuthActionState } from "./actions";

const initial: AuthActionState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(register, initial);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-[15px] font-normal tracking-normal text-zinc-900 dark:text-zinc-50">
        Create account
      </h2>
      <p className="mt-1 text-[15px] font-normal leading-snug text-zinc-600 dark:text-zinc-400">
        Your positions stay private to your login
      </p>
      {state.error ? (
        <p
          className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[15px] font-normal text-red-800 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-[15px] font-normal text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {state.message}
        </p>
      ) : null}
      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <label className="block text-[15px] font-normal text-zinc-700 dark:text-zinc-300">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[15px] font-normal text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="block text-[15px] font-normal text-zinc-700 dark:text-zinc-300">
          Password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[15px] font-normal text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-2.5 text-[15px] font-normal text-white shadow-md shadow-teal-600/25 transition hover:brightness-110 disabled:opacity-60 dark:from-teal-500 dark:to-emerald-500"
        >
          {pending ? "Creating…" : "Register"}
        </button>
      </form>
      <p className="mt-6 text-center text-[15px] font-normal text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className={siteTextLinkNeutralClass}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
