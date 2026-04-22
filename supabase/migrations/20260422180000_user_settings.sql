-- ---------------------------------------------------------------------------
-- user_settings (store per-user preferences like report email)
-- ---------------------------------------------------------------------------

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  portfolio_report_email text not null default 'hasebulhassan21@gmail.com',
  updated_at timestamptz not null default now()
);

create index if not exists user_settings_user_id_idx on public.user_settings (user_id);

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
  on public.user_settings for select
  using (auth.uid() = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
