-- Per-user sector target allocation percentages.
--
-- One row per (user, sector). Used by the /allocation page to render the
-- desired weight beside each sector's current weight, and by the settings
-- UI to bulk-edit them.
--
-- `target_percent` is a 0–100 numeric (not 0–1) so the column matches the
-- way it is rendered. We don't enforce that the per-user sum equals 100;
-- the UI nudges the user but allows partial allocations and dry-runs.

create table if not exists public.sector_target_allocations (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  sector text not null check (length(trim(sector)) > 0),
  target_percent numeric not null check (target_percent >= 0 and target_percent <= 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, sector)
);

create index if not exists sector_target_allocations_user_idx
  on public.sector_target_allocations (user_id);

alter table public.sector_target_allocations enable row level security;

drop policy if exists "sector_targets_select_own" on public.sector_target_allocations;
create policy "sector_targets_select_own"
  on public.sector_target_allocations for select
  using (auth.uid() = user_id);

drop policy if exists "sector_targets_insert_own" on public.sector_target_allocations;
create policy "sector_targets_insert_own"
  on public.sector_target_allocations for insert
  with check (auth.uid() = user_id);

drop policy if exists "sector_targets_update_own" on public.sector_target_allocations;
create policy "sector_targets_update_own"
  on public.sector_target_allocations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "sector_targets_delete_own" on public.sector_target_allocations;
create policy "sector_targets_delete_own"
  on public.sector_target_allocations for delete
  using (auth.uid() = user_id);
