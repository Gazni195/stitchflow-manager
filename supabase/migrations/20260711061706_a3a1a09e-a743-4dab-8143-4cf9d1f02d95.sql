ALTER TABLE public.designs
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS parts jsonb NOT NULL DEFAULT '[]'::jsonb;