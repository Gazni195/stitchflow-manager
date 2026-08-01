
ALTER TABLE public.workflow_steps
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2) NOT NULL DEFAULT 150;
