-- Planning lists: manual invested capital, long-term symbols, immediate trade targets.
-- Run once if your project was created before these tables existed.

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

create table if not exists public.long_term_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  symbol text not null,
  notes text,
  buy_point_bdt numeric,
  sell_point_bdt numeric,
  manual_avg_cost_bdt numeric,
  manual_total_invested_bdt numeric
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
