-- MIP: planned total investment per symbol (user-managed list).

create table if not exists public.mip_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  symbol text not null check (length(trim(symbol)) > 0),
  total_investment_plan_bdt numeric not null check (total_investment_plan_bdt > 0)
);

create index if not exists mip_plans_user_symbol_idx
  on public.mip_plans (user_id, symbol);

create unique index if not exists mip_plans_user_symbol_uidx
  on public.mip_plans (user_id, symbol);

alter table public.mip_plans enable row level security;

drop policy if exists "mip_plans_select_own" on public.mip_plans;
create policy "mip_plans_select_own"
  on public.mip_plans for select
  using (auth.uid() = user_id);

drop policy if exists "mip_plans_insert_own" on public.mip_plans;
create policy "mip_plans_insert_own"
  on public.mip_plans for insert
  with check (auth.uid() = user_id);

drop policy if exists "mip_plans_update_own" on public.mip_plans;
create policy "mip_plans_update_own"
  on public.mip_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "mip_plans_delete_own" on public.mip_plans;
create policy "mip_plans_delete_own"
  on public.mip_plans for delete
  using (auth.uid() = user_id);
