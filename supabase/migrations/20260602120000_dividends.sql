-- ---------------------------------------------------------------------------
-- dividends — per-stock cash & stock (bonus share) dividends.
--
--   * cash_dividend_bdt flows into the Portfolio "Unrealized P/L" KPI via the
--     same totalCashAdjustments bucket that Settings → Cash adjustments uses.
--   * stock_dividend_shares (bonus shares) are injected into the holdings
--     ledger as a zero-cost `buy` transaction; bonus_tx_id links back to it so
--     deleting the dividend also removes the injected shares.
-- ---------------------------------------------------------------------------

create table if not exists public.dividends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  symbol text not null check (length(trim(symbol)) > 0),
  cash_dividend_bdt numeric(18, 2) not null default 0 check (cash_dividend_bdt >= 0),
  stock_dividend_shares numeric(18, 4) not null default 0 check (stock_dividend_shares >= 0),
  bonus_tx_id uuid references public.transactions (id) on delete set null,
  note text,
  occurred_on date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);

create index if not exists dividends_user_id_idx
  on public.dividends (user_id, occurred_on desc, created_at desc);

alter table public.dividends enable row level security;

drop policy if exists "dividends_select_own" on public.dividends;
create policy "dividends_select_own"
  on public.dividends for select
  using (auth.uid() = user_id);

drop policy if exists "dividends_insert_own" on public.dividends;
create policy "dividends_insert_own"
  on public.dividends for insert
  with check (auth.uid() = user_id);

drop policy if exists "dividends_update_own" on public.dividends;
create policy "dividends_update_own"
  on public.dividends for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "dividends_delete_own" on public.dividends;
create policy "dividends_delete_own"
  on public.dividends for delete
  using (auth.uid() = user_id);
