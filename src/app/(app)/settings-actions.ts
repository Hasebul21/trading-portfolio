"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CashAdjustmentRow = {
  id: string;
  amount_bdt: number;
  note: string | null;
  occurred_on: string;
  created_at: string;
};

export type UserSettings = {
  id: string;
  user_id: string;
  portfolio_report_email: string;
  full_name: string | null;
  trade_commission_rate: number | null;
  currency: string;
  top_sectors: string[];
  positions_balance_bdt: number;
  updated_at: string;
};

const TOP_SECTORS_MAX = 8;
const TOP_SECTOR_LABEL_MAX = 60;

function sanitizeTopSectors(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const label = item.trim().replace(/\s+/g, " ").slice(0, TOP_SECTOR_LABEL_MAX);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= TOP_SECTORS_MAX) break;
  }
  return out;
}

export async function getUserSettings(): Promise<{
  ok: true;
  settings: UserSettings;
} | {
  ok: false;
  error: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data, error } = await supabase
    .from("user_settings")
    .select("id, user_id, portfolio_report_email, full_name, trade_commission_rate, currency, top_sectors, positions_balance_bdt, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };

  if (!data) {
    // Create default settings for new user
    const { data: created, error: createError } = await supabase
      .from("user_settings")
      .insert({
        user_id: user.id,
        portfolio_report_email: "hasebulhassan21@gmail.com",
        currency: "BDT",
      })
      .select("id, user_id, portfolio_report_email, full_name, trade_commission_rate, currency, top_sectors, positions_balance_bdt, updated_at")
      .single();

    if (createError) return { ok: false, error: createError.message };
    const c = created as Record<string, unknown>;
    return {
      ok: true,
      settings: { ...(created as UserSettings), top_sectors: sanitizeTopSectors(c.top_sectors) },
    };
  }

  const d = data as Record<string, unknown>;
  return {
    ok: true,
    settings: { ...(data as UserSettings), top_sectors: sanitizeTopSectors(d.top_sectors) },
  };
}

export async function updateTopSectors(
  sectors: ReadonlyArray<string>,
): Promise<{ ok: true; top_sectors: string[] } | { ok: false; error: string }> {
  const clean = sanitizeTopSectors(sectors);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("user_settings")
    .update({ top_sectors: clean, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/portfolio");
  revalidatePath("/record");
  revalidatePath("/long-term");
  revalidatePath("/allocation");
  revalidatePath("/trade-history");
  revalidatePath("/settings");
  return { ok: true, top_sectors: clean };
}

export async function updatePortfolioReportEmail(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = email.trim().toLowerCase();

  // Basic email validation
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("user_settings")
    .update({ portfolio_report_email: trimmed, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateUserProfile(
  fullName: string,
  commissionRate: string | null,
  currency: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmedName = fullName.trim();
  const rate = commissionRate ? Number(commissionRate) : null;

  if (trimmedName === "") {
    return { ok: false, error: "Full name cannot be empty." };
  }

  if (rate !== null && (typeof rate !== "number" || rate < 0 || rate > 1 || !Number.isFinite(rate))) {
    return { ok: false, error: "Commission rate must be between 0 and 1." };
  }

  if (!currency || currency.trim() === "") {
    return { ok: false, error: "Currency cannot be empty." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("user_settings")
    .update({
      full_name: trimmedName,
      trade_commission_rate: rate,
      currency: currency.trim().toUpperCase(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateUserPassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!currentPassword || !newPassword) {
    return { ok: false, error: "Both current and new passwords are required." };
  }

  if (newPassword.length < 6) {
    return { ok: false, error: "New password must be at least 6 characters long." };
  }

  if (currentPassword === newPassword) {
    return { ok: false, error: "New password must be different from current password." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // Update password via Supabase Auth
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateUserEmail(
  newEmail: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = newEmail.trim().toLowerCase();

  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  if (trimmed === user.email) {
    return { ok: false, error: "New email must be different from current email." };
  }

  // Update email via Supabase Auth
  const { error } = await supabase.auth.updateUser({
    email: trimmed,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cash adjustments — manual amounts that flow into Net Gain/Loss.
// ---------------------------------------------------------------------------

function parseAmount(raw: string | number): number | null {
  const n = typeof raw === "number" ? raw : Number(String(raw).trim().replace(/,/g, ""));
  if (!Number.isFinite(n) || n === 0) return null;
  return Math.round(n * 100) / 100;
}

export async function listCashAdjustments(): Promise<
  { ok: true; rows: CashAdjustmentRow[]; total: number } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data, error } = await supabase
    .from("cash_adjustments")
    .select("id, amount_bdt, note, occurred_on, created_at")
    .eq("user_id", user.id)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []).map((r) => ({
    id: String(r.id),
    amount_bdt: typeof r.amount_bdt === "number" ? r.amount_bdt : Number(r.amount_bdt ?? 0),
    note: r.note ?? null,
    occurred_on: String(r.occurred_on),
    created_at: String(r.created_at),
  })) as CashAdjustmentRow[];

  let total = 0;
  for (const r of rows) if (Number.isFinite(r.amount_bdt)) total += r.amount_bdt;
  total = Math.round(total * 100) / 100;

  return { ok: true, rows, total };
}

export async function createCashAdjustment(input: {
  amount: string | number;
  kind: "add" | "deduct";
  note?: string | null;
  occurredOn?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const magnitude = parseAmount(input.amount);
  if (magnitude === null || magnitude < 0) {
    return { ok: false, error: "Enter a positive amount." };
  }
  const signed = input.kind === "deduct" ? -Math.abs(magnitude) : Math.abs(magnitude);

  const trimmedNote = (input.note ?? "").trim();
  const occurred = (input.occurredOn ?? "").trim();
  const occurredOn = occurred && /^\d{4}-\d{2}-\d{2}$/.test(occurred) ? occurred : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const payload: Record<string, unknown> = {
    user_id: user.id,
    amount_bdt: signed,
    note: trimmedNote === "" ? null : trimmedNote,
  };
  if (occurredOn) payload.occurred_on = occurredOn;

  const { error } = await supabase.from("cash_adjustments").insert(payload);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/portfolio");
  revalidatePath("/settings");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Positions cash — standalone "available amount" for the Positions page. Only
// manual top-ups (here) and buy/sell marks (positions-actions) move it; it does
// NOT flow into the portfolio Net Gain/Loss.
// ---------------------------------------------------------------------------

export async function adjustPositionsBalance(input: {
  amount: string | number;
  kind: "add" | "deduct";
}): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  const magnitude = parseAmount(input.amount);
  if (magnitude === null || magnitude < 0) {
    return { ok: false, error: "Enter a positive amount." };
  }
  const delta = input.kind === "deduct" ? -Math.abs(magnitude) : Math.abs(magnitude);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: current, error: readErr } = await supabase
    .from("user_settings")
    .select("positions_balance_bdt")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };

  const newBalance = Math.round((Number(current?.positions_balance_bdt ?? 0) + delta) * 100) / 100;

  const { error } = await supabase
    .from("user_settings")
    .update({ positions_balance_bdt: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/positions");
  revalidatePath("/settings");
  return { ok: true, balance: newBalance };
}

/** Reset the Positions available amount back to zero. */
export async function resetPositionsBalance(): Promise<
  { ok: true; balance: number } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("user_settings")
    .update({ positions_balance_bdt: 0, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/positions");
  revalidatePath("/settings");
  return { ok: true, balance: 0 };
}

// ---------------------------------------------------------------------------
// Brokerage accounts — per-user brokerage house records (BO info, deposit
// bank, relation manager). Edited from the Settings page.
// ---------------------------------------------------------------------------

export type BrokerageAccountRow = {
  id: string;
  broker_name: string;
  account_type: string | null;
  bo_id: string | null;
  bo_name: string | null;
  client_code: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_routing_number: string | null;
  bank_branch: string | null;
  bank_address: string | null;
  rm_name: string | null;
  rm_phone: string | null;
  rm_email: string | null;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type BrokerageAccountInput = {
  broker_name: string;
  account_type?: string | null;
  bo_id?: string | null;
  bo_name?: string | null;
  client_code?: string | null;
  bank_name?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_routing_number?: string | null;
  bank_branch?: string | null;
  bank_address?: string | null;
  rm_name?: string | null;
  rm_phone?: string | null;
  rm_email?: string | null;
  notes?: string | null;
};

const BROKERAGE_TEXT_FIELDS = [
  "account_type",
  "bo_id",
  "bo_name",
  "client_code",
  "bank_name",
  "bank_account_name",
  "bank_account_number",
  "bank_routing_number",
  "bank_branch",
  "bank_address",
  "rm_name",
  "rm_phone",
  "rm_email",
  "notes",
] as const;

function cleanBrokerageInput(input: BrokerageAccountInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const name = input.broker_name?.trim() ?? "";
  if (!name) throw new Error("Broker name is required.");
  out.broker_name = name.slice(0, 120);
  for (const key of BROKERAGE_TEXT_FIELDS) {
    const raw = (input as Record<string, unknown>)[key];
    if (raw == null) {
      out[key] = null;
      continue;
    }
    const trimmed = String(raw).trim();
    out[key] = trimmed === "" ? null : trimmed.slice(0, 500);
  }
  return out;
}

function mapBrokerageRow(row: Record<string, unknown>): BrokerageAccountRow {
  const str = (v: unknown) => (v == null ? null : String(v));
  return {
    id: String(row.id),
    broker_name: String(row.broker_name ?? ""),
    account_type: str(row.account_type),
    bo_id: str(row.bo_id),
    bo_name: str(row.bo_name),
    client_code: str(row.client_code),
    bank_name: str(row.bank_name),
    bank_account_name: str(row.bank_account_name),
    bank_account_number: str(row.bank_account_number),
    bank_routing_number: str(row.bank_routing_number),
    bank_branch: str(row.bank_branch),
    bank_address: str(row.bank_address),
    rm_name: str(row.rm_name),
    rm_phone: str(row.rm_phone),
    rm_email: str(row.rm_email),
    notes: str(row.notes),
    position: Number.isFinite(Number(row.position)) ? Number(row.position) : 0,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

const BROKERAGE_SELECT =
  "id, broker_name, account_type, bo_id, bo_name, client_code, bank_name, bank_account_name, bank_account_number, bank_routing_number, bank_branch, bank_address, rm_name, rm_phone, rm_email, notes, position, created_at, updated_at";

export async function listBrokerageAccounts(): Promise<
  { ok: true; rows: BrokerageAccountRow[] } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data, error } = await supabase
    .from("brokerage_accounts")
    .select(BROKERAGE_SELECT)
    .eq("user_id", user.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []).map((r) => mapBrokerageRow(r as Record<string, unknown>));
  return { ok: true, rows };
}

export async function createBrokerageAccount(
  input: BrokerageAccountInput,
): Promise<{ ok: true; row: BrokerageAccountRow } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  let payload: Record<string, unknown>;
  try {
    payload = cleanBrokerageInput(input);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid input" };
  }
  payload.user_id = user.id;

  const { data: maxRow } = await supabase
    .from("brokerage_accounts")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  payload.position = Number(maxRow?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("brokerage_accounts")
    .insert(payload)
    .select(BROKERAGE_SELECT)
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true, row: mapBrokerageRow(data as Record<string, unknown>) };
}

export async function updateBrokerageAccount(
  id: string,
  input: BrokerageAccountInput,
): Promise<{ ok: true; row: BrokerageAccountRow } | { ok: false; error: string }> {
  const trimmedId = id.trim();
  if (!trimmedId) return { ok: false, error: "Missing id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  let payload: Record<string, unknown>;
  try {
    payload = cleanBrokerageInput(input);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid input" };
  }
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("brokerage_accounts")
    .update(payload)
    .eq("id", trimmedId)
    .eq("user_id", user.id)
    .select(BROKERAGE_SELECT)
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true, row: mapBrokerageRow(data as Record<string, unknown>) };
}

export async function deleteBrokerageAccount(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = id.trim();
  if (!trimmed) return { ok: false, error: "Missing id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("brokerage_accounts")
    .delete()
    .eq("id", trimmed)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteCashAdjustment(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = id.trim();
  if (!trimmed) return { ok: false, error: "Missing id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("cash_adjustments")
    .delete()
    .eq("id", trimmed)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/portfolio");
  revalidatePath("/settings");
  return { ok: true };
}
