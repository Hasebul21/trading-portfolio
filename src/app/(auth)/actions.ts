"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnvError } from "@/lib/supabase/env-check";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type AuthActionState = { error?: string; message?: string };

function networkAuthErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("fetch failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror")
  ) {
    return "Cannot reach Supabase (network). Confirm .env.local has your real Project URL and anon key from Supabase → Project Settings → API, then restart `npm run dev` / `make dev`.";
  }
  return raw;
}

export async function login(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const envErr = getSupabaseEnvError();
  if (envErr) {
    return { error: envErr };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  let error;
  try {
    const res = await supabase.auth.signInWithPassword({ email, password });
    error = res.error;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: networkAuthErrorMessage(msg) };
  }

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/portfolio");
}

export async function register(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const envErr = getSupabaseEnvError();
  if (envErr) {
    return { error: envErr };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = await createClient();
  let data;
  let error;
  try {
    const res = await supabase.auth.signUp({ email, password });
    data = res.data;
    error = res.error;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: networkAuthErrorMessage(msg) };
  }

  if (error) {
    return { error: error.message };
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/portfolio");
  }

  return {
    message:
      "Check your email to confirm your account, then sign in. You can disable email confirmation in Supabase Auth settings for personal projects.",
  };
}
