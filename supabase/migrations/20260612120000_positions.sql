-- ---------------------------------------------------------------------------
-- Positions — buy/sell plans plus a standalone "available cash" balance.
--
-- `position_plans` holds the rows a user lines up to buy or sell: a symbol, a
-- quantity and a target price. When a plan is executed the user "marks" it —
-- the balance is adjusted immediately (buy deducts cost incl. commission, sell
-- adds proceeds net of commission) and the row is flagged `executed`. Executed
-- rows are purged on the next page load, so a marked row disappears after a
-- refresh.
--
-- The running balance itself lives on `user_settings.positions_balance_bdt`. It
-- is independent of the portfolio Cash Adjustments / Net G/L; it is topped up
-- manually from the Settings → Positions cash tab and moved only by marks.
-- ---------------------------------------------------------------------------

alter table public.user_settings
  add column if not exists positions_balance_bdt numeric(18, 2) not null default 0;

create table if not exists public.position_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  side text not null check (side in ('buy', 'sell')),
  symbol text not null check (length(trim(symbol)) > 0),
  quantity_shares numeric not null check (quantity_shares > 0),
  target_price numeric not null check (target_price > 0),
  executed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists position_plans_user_idx
  on public.position_plans (user_id, side, created_at desc);

alter table public.position_plans enable row level security;

drop policy if exists "position_plans_select_own" on public.position_plans;
create policy "position_plans_select_own"
  on public.position_plans for select
  using (auth.uid() = user_id);

drop policy if exists "position_plans_insert_own" on public.position_plans;
create policy "position_plans_insert_own"
  on public.position_plans for insert
  with check (auth.uid() = user_id);

drop policy if exists "position_plans_update_own" on public.position_plans;
create policy "position_plans_update_own"
  on public.position_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "position_plans_delete_own" on public.position_plans;
create policy "position_plans_delete_own"
  on public.position_plans for delete
  using (auth.uid() = user_id);
