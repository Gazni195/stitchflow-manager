-- Workstation Queue: separate "Assign" (supervisor books a job onto a
-- workstation) from "Start Work" (operator actually begins the clock).
-- Adds 'pending' and 'paused' to the activity lifecycle and splits
-- assigned_at (when a supervisor assigns it) from started_at (when the
-- operator starts it), so the timer reflects real work time instead of
-- assignment time.

ALTER TABLE public.production_activities
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_seconds integer NOT NULL DEFAULT 0;

-- Backfill: every existing row was created under the old "Start = Assign"
-- flow, so assigned_at = started_at for history.
UPDATE public.production_activities SET assigned_at = started_at WHERE assigned_at IS NULL;
ALTER TABLE public.production_activities ALTER COLUMN assigned_at SET NOT NULL;
ALTER TABLE public.production_activities ALTER COLUMN assigned_at SET DEFAULT now();

-- A pending assignment has no start time yet.
ALTER TABLE public.production_activities ALTER COLUMN started_at DROP NOT NULL;
ALTER TABLE public.production_activities ALTER COLUMN started_at DROP DEFAULT;

ALTER TABLE public.production_activities DROP CONSTRAINT IF EXISTS production_activities_status_check;
ALTER TABLE public.production_activities
  ADD CONSTRAINT production_activities_status_check
  CHECK (status IN ('pending','running','paused','completed','cancelled'));

-- Workstation Queue page groups by (workstation_id, status) constantly.
CREATE INDEX IF NOT EXISTS production_activities_workstation_status_idx
  ON public.production_activities (workstation_id, status)
  WHERE workstation_id IS NOT NULL;
