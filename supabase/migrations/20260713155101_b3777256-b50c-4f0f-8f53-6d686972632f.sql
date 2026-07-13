
-- Inventory Material Master: shared catalog for all authenticated users.
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS available_stock numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_per_unit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Backfill cost_per_unit from legacy rate column when present.
UPDATE public.materials SET cost_per_unit = rate WHERE cost_per_unit = 0 AND rate IS NOT NULL;

-- Backfill code for any legacy rows so unique index can be added.
UPDATE public.materials SET code = 'MAT-' || substr(id::text, 1, 8) WHERE code IS NULL OR code = '';

ALTER TABLE public.materials ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS materials_code_unique ON public.materials (code);

-- Switch to shared inventory access model: any authenticated user can read/write.
DROP POLICY IF EXISTS "materials owner all" ON public.materials;
DROP POLICY IF EXISTS "materials read all authenticated" ON public.materials;
DROP POLICY IF EXISTS "materials write all authenticated" ON public.materials;

CREATE POLICY "materials read all authenticated"
  ON public.materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "materials write all authenticated"
  ON public.materials FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- created_by should not block inserts; make it default to auth.uid() and nullable-safe.
ALTER TABLE public.materials ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.materials ALTER COLUMN created_by SET DEFAULT auth.uid();
