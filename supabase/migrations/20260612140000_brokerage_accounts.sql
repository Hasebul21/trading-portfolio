-- ---------------------------------------------------------------------------
-- brokerage_accounts — per-user brokerage house records (BO info, deposit
-- bank, relation manager). Editable from the Settings page.
-- ---------------------------------------------------------------------------

create table if not exists public.brokerage_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  broker_name text not null,
  account_type text,
  bo_id text,
  bo_name text,
  client_code text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_routing_number text,
  bank_branch text,
  bank_address text,
  rm_name text,
  rm_phone text,
  rm_email text,
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brokerage_accounts_user_id_idx
  on public.brokerage_accounts (user_id, position, created_at);

alter table public.brokerage_accounts enable row level security;

drop policy if exists "brokerage_accounts_select_own" on public.brokerage_accounts;
create policy "brokerage_accounts_select_own"
  on public.brokerage_accounts for select
  using (auth.uid() = user_id);

drop policy if exists "brokerage_accounts_insert_own" on public.brokerage_accounts;
create policy "brokerage_accounts_insert_own"
  on public.brokerage_accounts for insert
  with check (auth.uid() = user_id);

drop policy if exists "brokerage_accounts_update_own" on public.brokerage_accounts;
create policy "brokerage_accounts_update_own"
  on public.brokerage_accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "brokerage_accounts_delete_own" on public.brokerage_accounts;
create policy "brokerage_accounts_delete_own"
  on public.brokerage_accounts for delete
  using (auth.uid() = user_id);
