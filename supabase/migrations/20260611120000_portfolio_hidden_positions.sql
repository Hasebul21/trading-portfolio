-- Symbols the user has explicitly removed from their portfolio view.
-- The transaction ledger is preserved (trade history is untouched);
-- merge logic just filters these symbols out of the holdings list and
-- every aggregate derived from it (KPIs, sector groups, totals, etc.).
--
-- Hiding is reversible: clearing the row from this table restores the
-- position immediately from the ledger.

create table if not exists public.portfolio_hidden_positions (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  symbol text not null,
  hidden_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

create index if not exists portfolio_hidden_positions_user_idx
  on public.portfolio_hidden_positions (user_id);

alter table public.portfolio_hidden_positions enable row level security;

drop policy if exists "portfolio_hidden_select_own" on public.portfolio_hidden_positions;
create policy "portfolio_hidden_select_own"
  on public.portfolio_hidden_positions for select
  using (auth.uid() = user_id);

drop policy if exists "portfolio_hidden_insert_own" on public.portfolio_hidden_positions;
create policy "portfolio_hidden_insert_own"
  on public.portfolio_hidden_positions for insert
  with check (auth.uid() = user_id);

drop policy if exists "portfolio_hidden_delete_own" on public.portfolio_hidden_positions;
create policy "portfolio_hidden_delete_own"
  on public.portfolio_hidden_positions for delete
  using (auth.uid() = user_id);
