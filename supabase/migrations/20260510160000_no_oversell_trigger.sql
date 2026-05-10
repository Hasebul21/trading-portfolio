-- Atomic guard against overselling.
--
-- Without this trigger, two concurrent sell requests can each pass the
-- application-level "do you have enough shares?" check (because each request
-- reads the ledger before either has inserted) and produce a negative
-- aggregate share balance. A row-level trigger that runs *after* insert
-- inside the same transaction closes that race: the new row is included in
-- the aggregate, and any negative balance aborts the insert.
--
-- The check is per-(user_id, symbol). RLS restricts inserts to the
-- authenticated user, so summing without `user_id = new.user_id` would still
-- return the right number, but we filter explicitly for safety against
-- service-role inserts.

create or replace function public.check_transactions_no_oversell()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
  v_symbol text := upper(trim(new.symbol));
begin
  -- Only sells can drive the balance negative.
  if new.side <> 'sell' then
    return new;
  end if;

  select coalesce(sum(case when t.side = 'buy' then t.quantity else -t.quantity end), 0)
  into v_balance
  from public.transactions t
  where t.user_id = new.user_id
    and upper(trim(t.symbol)) = v_symbol;

  if v_balance < 0 then
    raise exception
      'Cannot sell more than held: balance would be % for symbol %',
      v_balance, v_symbol
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_no_oversell on public.transactions;
create constraint trigger transactions_no_oversell
  after insert on public.transactions
  deferrable initially immediate
  for each row execute function public.check_transactions_no_oversell();
