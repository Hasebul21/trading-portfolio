-- ---------------------------------------------------------------------------
-- cash_adjustments — manual additions/deductions that flow into Net G/L.
--
-- Positive `amount_bdt` adds to net gain (cash injection / dividends / refunds).
-- Negative `amount_bdt` deducts from net gain (withdrawals / external losses).
-- ---------------------------------------------------------------------------

create table if not exists public.cash_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_bdt numeric(18, 2) not null,
  note text,
  occurred_on date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);

create index if not exists cash_adjustments_user_id_idx
  on public.cash_adjustments (user_id, occurred_on desc, created_at desc);

alter table public.cash_adjustments enable row level security;

drop policy if exists "cash_adjustments_select_own" on public.cash_adjustments;
create policy "cash_adjustments_select_own"
  on public.cash_adjustments for select
  using (auth.uid() = user_id);

drop policy if exists "cash_adjustments_insert_own" on public.cash_adjustments;
create policy "cash_adjustments_insert_own"
  on public.cash_adjustments for insert
  with check (auth.uid() = user_id);

drop policy if exists "cash_adjustments_update_own" on public.cash_adjustments;
create policy "cash_adjustments_update_own"
  on public.cash_adjustments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cash_adjustments_delete_own" on public.cash_adjustments;
create policy "cash_adjustments_delete_own"
  on public.cash_adjustments for delete
  using (auth.uid() = user_id);
