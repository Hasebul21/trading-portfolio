/**
 * Returns a user-facing error if Supabase env is missing or still placeholder.
 */
export function getSupabaseEnvError(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  if (!url || !key) {
    return "Supabase is not configured: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see .env.example).";
  }

  if (
    url.includes("your-project") ||
    url.includes("example.supabase") ||
    key === "your-anon-key" ||
    key.length < 30
  ) {
    return "Supabase still has placeholder values in .env.local. In the Supabase dashboard open Project Settings → API, copy the Project URL and anon public key, then paste them into .env.local and restart the dev server.";
  }

  try {
    new URL(url);
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL in .env.local is not a valid URL.";
  }

  return null;
}
