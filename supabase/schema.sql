-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to re-run (idempotent). Project: https://supabase.com/dashboard → your project → SQL Editor.

-- ---------------------------------------------------------------------------
-- transactions (buy/sell ledger)
-- ---------------------------------------------------------------------------

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  quantity numeric not null check (quantity > 0),
  price_per_share numeric not null check (price_per_share >= 0),
  category text,
  fees_bdt numeric not null default 0 check (fees_bdt >= 0)
);

create index if not exists transactions_user_created_idx
  on public.transactions (user_id, created_at, id);

alter table public.transactions enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
  on public.transactions for select
  using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
  on public.transactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- capital_contributions
-- ---------------------------------------------------------------------------

create table if not exists public.capital_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  amount_bdt numeric not null check (amount_bdt > 0),
  note text
);

create index if not exists capital_contributions_user_idx
  on public.capital_contributions (user_id, created_at desc);

alter table public.capital_contributions enable row level security;

drop policy if exists "capital_select_own" on public.capital_contributions;
create policy "capital_select_own"
  on public.capital_contributions for select
  using (auth.uid() = user_id);

drop policy if exists "capital_insert_own" on public.capital_contributions;
create policy "capital_insert_own"
  on public.capital_contributions for insert
  with check (auth.uid() = user_id);

drop policy if exists "capital_update_own" on public.capital_contributions;
create policy "capital_update_own"
  on public.capital_contributions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "capital_delete_own" on public.capital_contributions;
create policy "capital_delete_own"
  on public.capital_contributions for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- long_term_holdings
-- ---------------------------------------------------------------------------

create table if not exists public.long_term_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  symbol text not null,
  notes text,
  buy_point_bdt numeric,
  sell_point_bdt numeric,
  manual_avg_cost_bdt numeric,
  manual_total_invested_bdt numeric,
  classification text
);

create index if not exists long_term_holdings_user_idx
  on public.long_term_holdings (user_id, symbol);

alter table public.long_term_holdings enable row level security;

drop policy if exists "long_term_select_own" on public.long_term_holdings;
create policy "long_term_select_own"
  on public.long_term_holdings for select
  using (auth.uid() = user_id);

drop policy if exists "long_term_insert_own" on public.long_term_holdings;
create policy "long_term_insert_own"
  on public.long_term_holdings for insert
  with check (auth.uid() = user_id);

drop policy if exists "long_term_update_own" on public.long_term_holdings;
create policy "long_term_update_own"
  on public.long_term_holdings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "long_term_delete_own" on public.long_term_holdings;
create policy "long_term_delete_own"
  on public.long_term_holdings for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- immediate_trade_plans
-- ---------------------------------------------------------------------------

create table if not exists public.immediate_trade_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  target_price numeric not null check (target_price >= 0),
  notes text
);

create index if not exists immediate_trade_plans_user_idx
  on public.immediate_trade_plans (user_id, created_at desc);

alter table public.immediate_trade_plans enable row level security;

drop policy if exists "trade_plans_select_own" on public.immediate_trade_plans;
create policy "trade_plans_select_own"
  on public.immediate_trade_plans for select
  using (auth.uid() = user_id);

drop policy if exists "trade_plans_insert_own" on public.immediate_trade_plans;
create policy "trade_plans_insert_own"
  on public.immediate_trade_plans for insert
  with check (auth.uid() = user_id);

drop policy if exists "trade_plans_update_own" on public.immediate_trade_plans;
create policy "trade_plans_update_own"
  on public.immediate_trade_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "trade_plans_delete_own" on public.immediate_trade_plans;
create policy "trade_plans_delete_own"
  on public.immediate_trade_plans for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- mip_plans (planned total investment per symbol)
-- ---------------------------------------------------------------------------

create table if not exists public.mip_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  symbol text not null check (length(trim(symbol)) > 0),
  total_investment_plan_bdt numeric not null check (total_investment_plan_bdt > 0)
);

create index if not exists mip_plans_user_symbol_idx
  on public.mip_plans (user_id, symbol);

create unique index if not exists mip_plans_user_symbol_uidx
  on public.mip_plans (user_id, symbol);

alter table public.mip_plans enable row level security;

drop policy if exists "mip_plans_select_own" on public.mip_plans;
create policy "mip_plans_select_own"
  on public.mip_plans for select
  using (auth.uid() = user_id);

drop policy if exists "mip_plans_insert_own" on public.mip_plans;
create policy "mip_plans_insert_own"
  on public.mip_plans for insert
  with check (auth.uid() = user_id);

drop policy if exists "mip_plans_update_own" on public.mip_plans;
create policy "mip_plans_update_own"
  on public.mip_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "mip_plans_delete_own" on public.mip_plans;
create policy "mip_plans_delete_own"
  on public.mip_plans for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- mip_monthly_headers / mip_monthly_rows (Monthly Investment Plan)
-- ---------------------------------------------------------------------------

create table if not exists public.mip_monthly_headers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  year_month text not null,
  plan_date date not null,
  base_amount_bdt numeric not null check (base_amount_bdt > 0),
  carried_forward_bdt numeric not null default 0 check (carried_forward_bdt >= 0),
  locked_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint mip_monthly_headers_year_month_chk check (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

create unique index if not exists mip_monthly_headers_user_ym_uidx
  on public.mip_monthly_headers (user_id, year_month);

create index if not exists mip_monthly_headers_user_idx
  on public.mip_monthly_headers (user_id, year_month desc);

alter table public.mip_monthly_headers enable row level security;

drop policy if exists "mip_monthly_headers_select_own" on public.mip_monthly_headers;
create policy "mip_monthly_headers_select_own"
  on public.mip_monthly_headers for select
  using (auth.uid() = user_id);

drop policy if exists "mip_monthly_headers_insert_own" on public.mip_monthly_headers;
create policy "mip_monthly_headers_insert_own"
  on public.mip_monthly_headers for insert
  with check (auth.uid() = user_id);

drop policy if exists "mip_monthly_headers_update_own" on public.mip_monthly_headers;
create policy "mip_monthly_headers_update_own"
  on public.mip_monthly_headers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "mip_monthly_headers_delete_own" on public.mip_monthly_headers;
create policy "mip_monthly_headers_delete_own"
  on public.mip_monthly_headers for delete
  using (auth.uid() = user_id);

create table if not exists public.mip_monthly_rows (
  id uuid primary key default gen_random_uuid(),
  header_id uuid not null references public.mip_monthly_headers (id) on delete cascade,
  sort_order int not null check (sort_order >= 0 and sort_order < 6),
  symbol text,
  percentage numeric,
  calculated_amount_bdt numeric,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  constraint mip_monthly_rows_pct_chk check (
    percentage is null or (percentage > 0 and percentage <= 100)
  )
);

create unique index if not exists mip_monthly_rows_header_order_uidx
  on public.mip_monthly_rows (header_id, sort_order);

create index if not exists mip_monthly_rows_header_idx
  on public.mip_monthly_rows (header_id, sort_order);

alter table public.mip_monthly_rows enable row level security;

drop policy if exists "mip_monthly_rows_select_own" on public.mip_monthly_rows;
create policy "mip_monthly_rows_select_own"
  on public.mip_monthly_rows for select
  using (
    exists (
      select 1 from public.mip_monthly_headers h
      where h.id = mip_monthly_rows.header_id and h.user_id = auth.uid()
    )
  );

drop policy if exists "mip_monthly_rows_insert_own" on public.mip_monthly_rows;
create policy "mip_monthly_rows_insert_own"
  on public.mip_monthly_rows for insert
  with check (
    exists (
      select 1 from public.mip_monthly_headers h
      where h.id = mip_monthly_rows.header_id and h.user_id = auth.uid()
    )
  );

drop policy if exists "mip_monthly_rows_update_own" on public.mip_monthly_rows;
create policy "mip_monthly_rows_update_own"
  on public.mip_monthly_rows for update
  using (
    exists (
      select 1 from public.mip_monthly_headers h
      where h.id = mip_monthly_rows.header_id and h.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.mip_monthly_headers h
      where h.id = mip_monthly_rows.header_id and h.user_id = auth.uid()
    )
  );

drop policy if exists "mip_monthly_rows_delete_own" on public.mip_monthly_rows;
create policy "mip_monthly_rows_delete_own"
  on public.mip_monthly_rows for delete
  using (
    exists (
      select 1 from public.mip_monthly_headers h
      where h.id = mip_monthly_rows.header_id and h.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- portfolio_position_overrides (manual book per symbol; merged with ledger)
-- ---------------------------------------------------------------------------

create table if not exists public.portfolio_position_overrides (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  symbol text not null,
  shares numeric not null check (shares > 0),
  avg_price_bdt numeric not null check (avg_price_bdt >= 0),
  total_cost_bdt numeric not null check (total_cost_bdt >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

create index if not exists portfolio_position_overrides_user_idx
  on public.portfolio_position_overrides (user_id);

alter table public.portfolio_position_overrides enable row level security;

drop policy if exists "portfolio_overrides_select_own" on public.portfolio_position_overrides;
create policy "portfolio_overrides_select_own"
  on public.portfolio_position_overrides for select
  using (auth.uid() = user_id);

drop policy if exists "portfolio_overrides_insert_own" on public.portfolio_position_overrides;
create policy "portfolio_overrides_insert_own"
  on public.portfolio_position_overrides for insert
  with check (auth.uid() = user_id);

drop policy if exists "portfolio_overrides_update_own" on public.portfolio_position_overrides;
create policy "portfolio_overrides_update_own"
  on public.portfolio_position_overrides for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "portfolio_overrides_delete_own" on public.portfolio_position_overrides;
create policy "portfolio_overrides_delete_own"
  on public.portfolio_position_overrides for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Patches for databases created before these columns existed
-- (CREATE TABLE IF NOT EXISTS does not add columns to an existing table.)
-- ---------------------------------------------------------------------------

alter table public.long_term_holdings
  add column if not exists buy_point_bdt numeric,
  add column if not exists sell_point_bdt numeric,
  add column if not exists manual_avg_cost_bdt numeric,
  add column if not exists manual_total_invested_bdt numeric,
  add column if not exists classification text;

alter table public.long_term_holdings
  drop constraint if exists long_term_holdings_classification_check;

alter table public.long_term_holdings
  add constraint long_term_holdings_classification_check
  check (classification is null or classification in ('BLUE', 'GREEN'));

-- ---------------------------------------------------------------------------
-- knowledge_notes
-- ---------------------------------------------------------------------------

create table if not exists public.knowledge_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  title text not null,
  body text not null
);

create index if not exists knowledge_notes_user_created_idx
  on public.knowledge_notes (user_id, created_at desc);

alter table public.knowledge_notes enable row level security;

drop policy if exists "knowledge_notes_select_own" on public.knowledge_notes;
create policy "knowledge_notes_select_own"
  on public.knowledge_notes for select
  using (auth.uid() = user_id);

drop policy if exists "knowledge_notes_insert_own" on public.knowledge_notes;
create policy "knowledge_notes_insert_own"
  on public.knowledge_notes for insert
  with check (auth.uid() = user_id);

drop policy if exists "knowledge_notes_delete_own" on public.knowledge_notes;
create policy "knowledge_notes_delete_own"
  on public.knowledge_notes for delete
  using (auth.uid() = user_id);
