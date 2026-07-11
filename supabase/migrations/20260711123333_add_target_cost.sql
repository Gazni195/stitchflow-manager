ALTER TABLE public.designs
  ADD COLUMN IF NOT EXISTS target_cost_per_piece numeric NOT NULL DEFAULT 0;
