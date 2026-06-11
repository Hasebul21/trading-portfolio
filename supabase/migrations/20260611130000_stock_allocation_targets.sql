-- Per-user, per-stock target allocation percentages *within a sector*.
--
-- One row per (user, symbol). Lets the user split a sector's investment
-- across the individual stocks they hold in it — e.g. inside "Bank",
-- BRACBANK 30%, EBL 20%, … The percentages are relative to the sector
-- (they should sum to 100% per sector) and are rendered on the portfolio
-- page next to each stock's current weight within its sector.
--
-- `target_percent` is a 0–100 numeric (not 0–1). `sector` is stored for
-- reference/grouping but matching on the portfolio page is by symbol, since
-- a symbol's live DSE sector is the source of truth there. We don't enforce
-- that the per-sector sum equals 100; the UI nudges but allows partials.

create table if not exists public.stock_allocation_targets (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  symbol text not null check (length(trim(symbol)) > 0),
  sector text not null default '',
  target_percent numeric not null check (target_percent >= 0 and target_percent <= 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

create index if not exists stock_allocation_targets_user_idx
  on public.stock_allocation_targets (user_id);

alter table public.stock_allocation_targets enable row level security;

drop policy if exists "stock_alloc_select_own" on public.stock_allocation_targets;
create policy "stock_alloc_select_own"
  on public.stock_allocation_targets for select
  using (auth.uid() = user_id);

drop policy if exists "stock_alloc_insert_own" on public.stock_allocation_targets;
create policy "stock_alloc_insert_own"
  on public.stock_allocation_targets for insert
  with check (auth.uid() = user_id);

drop policy if exists "stock_alloc_update_own" on public.stock_allocation_targets;
create policy "stock_alloc_update_own"
  on public.stock_allocation_targets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "stock_alloc_delete_own" on public.stock_allocation_targets;
create policy "stock_alloc_delete_own"
  on public.stock_allocation_targets for delete
  using (auth.uid() = user_id);
