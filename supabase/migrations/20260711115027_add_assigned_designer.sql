ALTER TABLE public.designs
  ADD COLUMN IF NOT EXISTS assigned_designer text NOT NULL DEFAULT '';
