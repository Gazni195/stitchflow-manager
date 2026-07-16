ALTER TABLE public.production_activities
  ADD COLUMN IF NOT EXISTS issued_sizes JSONB,
  ADD COLUMN IF NOT EXISTS completed_sizes JSONB;