-- Per-user "sell plan" rows: a stock and how many shares you intend to sell.
--
-- One row per (user, symbol). Lets the user line up the shares they plan to
-- sell across stocks. The proceeds are NOT stored — they are computed live in
-- the UI from the current DSE last-traded price (LTP) × quantity, so the plan
-- always reflects today's market. Edited in bulk from the Settings UI
-- (Sell plan tab), mirroring sector_monthly_investments.

create table if not exists public.sell_plans (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  symbol text not null check (length(trim(symbol)) > 0),
  quantity_shares numeric not null check (quantity_shares > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

create index if not exists sell_plans_user_idx
  on public.sell_plans (user_id);

alter table public.sell_plans enable row level security;

drop policy if exists "sell_plans_select_own" on public.sell_plans;
create policy "sell_plans_select_own"
  on public.sell_plans for select
  using (auth.uid() = user_id);

drop policy if exists "sell_plans_insert_own" on public.sell_plans;
create policy "sell_plans_insert_own"
  on public.sell_plans for insert
  with check (auth.uid() = user_id);

drop policy if exists "sell_plans_update_own" on public.sell_plans;
create policy "sell_plans_update_own"
  on public.sell_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "sell_plans_delete_own" on public.sell_plans;
create policy "sell_plans_delete_own"
  on public.sell_plans for delete
  using (auth.uid() = user_id);
