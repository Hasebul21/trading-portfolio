-- Add planned budget field for quick trade plans.

alter table public.immediate_trade_plans
  add column if not exists planned_budget_bdt numeric;

alter table public.immediate_trade_plans
  drop constraint if exists immediate_trade_plans_planned_budget_bdt_check;

alter table public.immediate_trade_plans
  add constraint immediate_trade_plans_planned_budget_bdt_check
  check (planned_budget_bdt is null or planned_budget_bdt > 0);