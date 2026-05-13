#!/usr/bin/env node
/**
 * Automatic migration runner for Supabase.
 *
 * Reads every *.sql file in supabase/migrations/ and applies the ones not yet
 * recorded in public._schema_migrations, in lexicographic (timestamp) order.
 *
 * Required environment variables:
 *   SUPABASE_ACCESS_TOKEN  — Personal access token
 *                            https://supabase.com/dashboard/account/tokens
 *   SUPABASE_PROJECT_REF   — Project reference ID
 *                            Supabase Dashboard → Settings → General
 */

import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── env validation ────────────────────────────────────────────────────────────

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;

if (!ACCESS_TOKEN || !PROJECT_REF) {
  console.error(`
ERROR: Missing required environment variables for database migrations.

  SUPABASE_ACCESS_TOKEN — create one at:
    https://supabase.com/dashboard/account/tokens

  SUPABASE_PROJECT_REF  — find it at:
    Supabase Dashboard → Settings → General → Reference ID

Set both in your Vercel project environment variables (Settings → Environment Variables).
`);
  process.exit(1);
}

// ── Supabase Management API helper ───────────────────────────────────────────

const QUERY_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

/**
 * Run a SQL statement against the project database via the Management API.
 * Returns the result rows (array of objects) on success.
 * Throws on HTTP or query error.
 */
async function runQuery(sql) {
  const res = await fetch(QUERY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  // The API returns a JSON array of row objects on success.
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

// ── migration tracking table ──────────────────────────────────────────────────

const CREATE_TRACKING_TABLE = `
CREATE TABLE IF NOT EXISTS public._schema_migrations (
  name        text        PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);
`;

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("▶  Running database migrations…\n");

  // 1. Ensure the tracking table exists.
  await runQuery(CREATE_TRACKING_TABLE);

  // 2. Fetch the names of already-applied migrations.
  const rows = await runQuery(
    "SELECT name FROM public._schema_migrations ORDER BY name;",
  );
  const applied = new Set(rows.map((r) => r.name));

  // 3. Collect all migration files, sorted by name (timestamps sort correctly).
  const migrationsDir = join(__dirname, "..", "supabase", "migrations");
  const allFiles = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pending = allFiles.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log("✓  Nothing to migrate — database is up to date.\n");
    return;
  }

  console.log(`   ${pending.length} pending migration(s):\n`);

  // 4. Apply each pending migration inside an explicit transaction so a
  //    partial failure does NOT leave the DB in an inconsistent state.
  for (const file of pending) {
    const sql = await readFile(join(migrationsDir, file), "utf8");

    // Wrap user SQL in a transaction; record the migration name at the end.
    const escapedName = file.replace(/'/g, "''");
    const wrapped = `
BEGIN;
${sql}
INSERT INTO public._schema_migrations (name)
  VALUES ('${escapedName}')
  ON CONFLICT (name) DO NOTHING;
COMMIT;
`;

    process.stdout.write(`   • ${file}  …  `);
    try {
      await runQuery(wrapped);
      console.log("✓");
    } catch (err) {
      console.log("✗  FAILED");
      console.error(`\nError while applying "${file}":\n${err.message}\n`);
      process.exit(1);
    }
  }

  console.log(`\n✓  Applied ${pending.length} migration(s) successfully.\n`);
}

main().catch((err) => {
  console.error("Migration runner crashed:", err.message);
  process.exit(1);
});
