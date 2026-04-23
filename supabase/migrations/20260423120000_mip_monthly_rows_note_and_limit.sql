-- Expand monthly MIP rows to 12 and allow an optional per-row note.

alter table public.mip_monthly_rows
  add column if not exists note text;

alter table public.mip_monthly_rows
  drop constraint if exists mip_monthly_rows_sort_order_check;

alter table public.mip_monthly_rows
  add constraint mip_monthly_rows_sort_order_check
  check (sort_order >= 0 and sort_order < 12);