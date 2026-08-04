ALTER TABLE public.production_activities
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_seconds integer NOT NULL DEFAULT 0;

UPDATE public.production_activities SET assigned_at = started_at WHERE assigned_at IS NULL;

ALTER TABLE public.production_activities ALTER COLUMN assigned_at SET NOT NULL;
ALTER TABLE public.production_activities ALTER COLUMN assigned_at SET DEFAULT now();

ALTER TABLE public.production_activities ALTER COLUMN started_at DROP NOT NULL;
ALTER TABLE public.production_activities ALTER COLUMN started_at DROP DEFAULT;

ALTER TABLE public.production_activities DROP CONSTRAINT IF EXISTS production_activities_status_check;

ALTER TABLE public.production_activities
  ADD CONSTRAINT production_activities_status_check
  CHECK (status IN ('pending','running','paused','completed','cancelled'));

CREATE INDEX IF NOT EXISTS production_activities_workstation_status_idx
  ON public.production_activities (workstation_id, status)
  WHERE workstation_id IS NOT NULL;