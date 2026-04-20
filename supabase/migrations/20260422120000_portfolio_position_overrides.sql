-- Manual book values per symbol (merged with transaction ledger on read).
-- When values match the ledger again, the app deletes the override row.

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
