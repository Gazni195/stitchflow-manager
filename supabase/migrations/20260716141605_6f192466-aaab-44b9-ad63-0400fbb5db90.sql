ALTER TABLE public.production_activities
  ADD COLUMN IF NOT EXISTS size_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS variance_reason TEXT;