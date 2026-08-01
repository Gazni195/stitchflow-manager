
ALTER TABLE public.workflow_steps
  ADD COLUMN IF NOT EXISTS garment_part text,
  ADD COLUMN IF NOT EXISTS work_area text,
  ADD COLUMN IF NOT EXISTS custom_area text;
