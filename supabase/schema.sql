-- Run in Supabase SQL Editor (or via migration) before using the app.

create table public.transactions (
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

create index transactions_user_created_idx
  on public.transactions (user_id, created_at, id);

alter table public.transactions enable row level security;

create policy "transactions_select_own"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "transactions_insert_own"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "transactions_update_own"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "transactions_delete_own"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- Manual capital (total invested = sum of rows per user)

create table public.capital_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  amount_bdt numeric not null check (amount_bdt > 0),
  note text
);

create index capital_contributions_user_idx
  on public.capital_contributions (user_id, created_at desc);

alter table public.capital_contributions enable row level security;

create policy "capital_select_own"
  on public.capital_contributions for select
  using (auth.uid() = user_id);

create policy "capital_insert_own"
  on public.capital_contributions for insert
  with check (auth.uid() = user_id);

create policy "capital_update_own"
  on public.capital_contributions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "capital_delete_own"
  on public.capital_contributions for delete
  using (auth.uid() = user_id);

-- Long-term investment watchlist (symbols you intend to hold long term)

create table public.long_term_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  symbol text not null,
  notes text
);

create index long_term_holdings_user_idx
  on public.long_term_holdings (user_id, symbol);

alter table public.long_term_holdings enable row level security;

create policy "long_term_select_own"
  on public.long_term_holdings for select
  using (auth.uid() = user_id);

create policy "long_term_insert_own"
  on public.long_term_holdings for insert
  with check (auth.uid() = user_id);

create policy "long_term_update_own"
  on public.long_term_holdings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "long_term_delete_own"
  on public.long_term_holdings for delete
  using (auth.uid() = user_id);

-- Short-term intentions: buy or sell soon at a target price

create table public.immediate_trade_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  target_price numeric not null check (target_price >= 0),
  notes text
);

create index immediate_trade_plans_user_idx
  on public.immediate_trade_plans (user_id, created_at desc);

alter table public.immediate_trade_plans enable row level security;

create policy "trade_plans_select_own"
  on public.immediate_trade_plans for select
  using (auth.uid() = user_id);

create policy "trade_plans_insert_own"
  on public.immediate_trade_plans for insert
  with check (auth.uid() = user_id);

create policy "trade_plans_update_own"
  on public.immediate_trade_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "trade_plans_delete_own"
  on public.immediate_trade_plans for delete
  using (auth.uid() = user_id);
