ALTER TABLE public.consumption_reduction_rules
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100;
CREATE INDEX IF NOT EXISTS consumption_reduction_rules_priority_idx
  ON public.consumption_reduction_rules (priority);