-- ---------------------------------------------------------------------------
-- Positions — record which brokerage house each plan row is placed through.
-- Nullable so plans created before this column was added stay valid; the UI
-- requires a value when inserting/updating a row.
-- ---------------------------------------------------------------------------

alter table public.position_plans
  add column if not exists brokerage text
    check (brokerage is null or brokerage in ('IDLC', 'LankaBangla', 'BRAC EPL'));
