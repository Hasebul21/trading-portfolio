-- Draft MIP: separate monthly plan tables with the same behavior as MIP.

create table if not exists public.draft_mip_monthly_headers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  year_month text not null,
  plan_date date not null,
  base_amount_bdt numeric not null check (base_amount_bdt > 0),
  carried_forward_bdt numeric not null default 0 check (carried_forward_bdt >= 0),
  locked_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint draft_mip_monthly_headers_year_month_chk check (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

create unique index if not exists draft_mip_monthly_headers_user_ym_uidx
  on public.draft_mip_monthly_headers (user_id, year_month);

create index if not exists draft_mip_monthly_headers_user_idx
  on public.draft_mip_monthly_headers (user_id, year_month desc);

alter table public.draft_mip_monthly_headers enable row level security;

drop policy if exists "draft_mip_monthly_headers_select_own" on public.draft_mip_monthly_headers;
create policy "draft_mip_monthly_headers_select_own"
  on public.draft_mip_monthly_headers for select
  using (auth.uid() = user_id);

drop policy if exists "draft_mip_monthly_headers_insert_own" on public.draft_mip_monthly_headers;
create policy "draft_mip_monthly_headers_insert_own"
  on public.draft_mip_monthly_headers for insert
  with check (auth.uid() = user_id);

drop policy if exists "draft_mip_monthly_headers_update_own" on public.draft_mip_monthly_headers;
create policy "draft_mip_monthly_headers_update_own"
  on public.draft_mip_monthly_headers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "draft_mip_monthly_headers_delete_own" on public.draft_mip_monthly_headers;
create policy "draft_mip_monthly_headers_delete_own"
  on public.draft_mip_monthly_headers for delete
  using (auth.uid() = user_id);

create table if not exists public.draft_mip_monthly_rows (
  id uuid primary key default gen_random_uuid(),
  header_id uuid not null references public.draft_mip_monthly_headers (id) on delete cascade,
  sort_order int not null check (sort_order >= 0 and sort_order < 12),
  symbol text,
  percentage numeric,
  note text,
  calculated_amount_bdt numeric,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  constraint draft_mip_monthly_rows_pct_chk check (
    percentage is null or (percentage > 0 and percentage <= 100)
  )
);

create unique index if not exists draft_mip_monthly_rows_header_order_uidx
  on public.draft_mip_monthly_rows (header_id, sort_order);

create index if not exists draft_mip_monthly_rows_header_idx
  on public.draft_mip_monthly_rows (header_id, sort_order);

alter table public.draft_mip_monthly_rows enable row level security;

drop policy if exists "draft_mip_monthly_rows_select_own" on public.draft_mip_monthly_rows;
create policy "draft_mip_monthly_rows_select_own"
  on public.draft_mip_monthly_rows for select
  using (
    exists (
      select 1 from public.draft_mip_monthly_headers h
      where h.id = draft_mip_monthly_rows.header_id and h.user_id = auth.uid()
    )
  );

drop policy if exists "draft_mip_monthly_rows_insert_own" on public.draft_mip_monthly_rows;
create policy "draft_mip_monthly_rows_insert_own"
  on public.draft_mip_monthly_rows for insert
  with check (
    exists (
      select 1 from public.draft_mip_monthly_headers h
      where h.id = draft_mip_monthly_rows.header_id and h.user_id = auth.uid()
    )
  );

drop policy if exists "draft_mip_monthly_rows_update_own" on public.draft_mip_monthly_rows;
create policy "draft_mip_monthly_rows_update_own"
  on public.draft_mip_monthly_rows for update
  using (
    exists (
      select 1 from public.draft_mip_monthly_headers h
      where h.id = draft_mip_monthly_rows.header_id and h.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.draft_mip_monthly_headers h
      where h.id = draft_mip_monthly_rows.header_id and h.user_id = auth.uid()
    )
  );

drop policy if exists "draft_mip_monthly_rows_delete_own" on public.draft_mip_monthly_rows;
create policy "draft_mip_monthly_rows_delete_own"
  on public.draft_mip_monthly_rows for delete
  using (
    exists (
      select 1 from public.draft_mip_monthly_headers h
      where h.id = draft_mip_monthly_rows.header_id and h.user_id = auth.uid()
    )
  );