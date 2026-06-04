-- Per-user, per-sector planned monthly investment amounts (in BDT).
--
-- One row per (user, sector). Lets the user budget how much money they intend
-- to put into each sector every month. Edited in bulk from the Settings UI
-- (Monthly investment tab), mirroring sector_target_allocations.
--
-- `amount_bdt` is a non-negative numeric taka amount. We don't enforce a
-- target total; the UI simply shows the monthly sum so the user can see what
-- they have planned.

create table if not exists public.sector_monthly_investments (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  sector text not null check (length(trim(sector)) > 0),
  amount_bdt numeric not null check (amount_bdt >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, sector)
);

create index if not exists sector_monthly_investments_user_idx
  on public.sector_monthly_investments (user_id);

alter table public.sector_monthly_investments enable row level security;

drop policy if exists "sector_monthly_investments_select_own" on public.sector_monthly_investments;
create policy "sector_monthly_investments_select_own"
  on public.sector_monthly_investments for select
  using (auth.uid() = user_id);

drop policy if exists "sector_monthly_investments_insert_own" on public.sector_monthly_investments;
create policy "sector_monthly_investments_insert_own"
  on public.sector_monthly_investments for insert
  with check (auth.uid() = user_id);

drop policy if exists "sector_monthly_investments_update_own" on public.sector_monthly_investments;
create policy "sector_monthly_investments_update_own"
  on public.sector_monthly_investments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "sector_monthly_investments_delete_own" on public.sector_monthly_investments;
create policy "sector_monthly_investments_delete_own"
  on public.sector_monthly_investments for delete
  using (auth.uid() = user_id);
