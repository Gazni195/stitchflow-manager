ALTER TABLE public.production_activities ADD COLUMN workstation_id text;
CREATE INDEX production_activities_workstation_id_idx
  ON public.production_activities (workstation_id)
  WHERE workstation_id IS NOT NULL;