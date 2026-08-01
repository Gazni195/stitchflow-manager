alter table public.materials
  add column if not exists consumption_rule_id uuid references public.consumption_reduction_rules(id) on delete set null;

alter table public.materials
  drop column if exists fabric_type;