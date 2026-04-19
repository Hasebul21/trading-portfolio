-- Run in Supabase SQL Editor if you already created `transactions` without fees.

alter table public.transactions
  add column if not exists fees_bdt numeric not null default 0 check (fees_bdt >= 0);

comment on column public.transactions.fees_bdt is
  'Total BDT charges for this trade (transfer-in/out, optional demat/remat/pledge, manual extras).';
