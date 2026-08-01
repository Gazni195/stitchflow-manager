
-- 1. Add color to materials
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS color text;

-- 2. Material code settings (singleton)
CREATE TABLE public.material_code_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  prefix text NOT NULL DEFAULT 'FAB',
  next_number integer NOT NULL DEFAULT 1 CHECK (next_number >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.material_code_settings TO authenticated;
GRANT ALL ON public.material_code_settings TO service_role;
ALTER TABLE public.material_code_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "code settings read" ON public.material_code_settings
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "code settings write" ON public.material_code_settings
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'settings.edit')
      OR public.has_role(auth.uid(), 'inventory_manager')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_permission(auth.uid(), 'settings.edit')
      OR public.has_role(auth.uid(), 'inventory_manager')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER material_code_settings_updated_at BEFORE UPDATE ON public.material_code_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.material_code_settings (id, prefix, next_number) VALUES (true, 'FAB', 1)
  ON CONFLICT DO NOTHING;

-- 3. next_material_code RPC (atomic)
CREATE OR REPLACE FUNCTION public.next_material_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _prefix text; _n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  UPDATE public.material_code_settings
    SET next_number = next_number + 1
    WHERE id = true
    RETURNING prefix, next_number - 1 INTO _prefix, _n;
  IF _prefix IS NULL THEN
    INSERT INTO public.material_code_settings (id, prefix, next_number) VALUES (true, 'FAB', 2)
      RETURNING prefix INTO _prefix;
    _n := 1;
  END IF;
  RETURN _prefix || '-' || lpad(_n::text, 4, '0');
END; $$;
REVOKE ALL ON FUNCTION public.next_material_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_material_code() TO authenticated;

-- 4. Inventory bundles
CREATE TABLE public.inventory_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  bundle_number integer NOT NULL,
  roll_number text,
  fabric_width text NOT NULL,
  purchased_length numeric(12,2) NOT NULL CHECK (purchased_length >= 0),
  usable_length numeric(12,2) NOT NULL CHECK (usable_length >= 0),
  consumed_length numeric(12,2) NOT NULL DEFAULT 0 CHECK (consumed_length >= 0),
  remaining_length numeric(12,2) GENERATED ALWAYS AS (usable_length - consumed_length) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bundles_usable_lte_purchased CHECK (usable_length <= purchased_length),
  CONSTRAINT bundles_consumed_lte_usable CHECK (consumed_length <= usable_length),
  UNIQUE (material_id, bundle_number)
);
CREATE INDEX inventory_bundles_material_idx ON public.inventory_bundles (material_id);

GRANT SELECT ON public.inventory_bundles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.inventory_bundles TO authenticated;
GRANT ALL ON public.inventory_bundles TO service_role;
ALTER TABLE public.inventory_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bundles read" ON public.inventory_bundles
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "bundles write" ON public.inventory_bundles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'inventory_manager')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'inventory_manager')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER inventory_bundles_updated_at BEFORE UPDATE ON public.inventory_bundles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Trigger: recompute materials.available_stock from bundles
CREATE OR REPLACE FUNCTION public.recompute_material_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE _mid uuid;
BEGIN
  _mid := COALESCE(NEW.material_id, OLD.material_id);
  UPDATE public.materials
     SET available_stock = COALESCE((
       SELECT SUM(usable_length - consumed_length)
       FROM public.inventory_bundles WHERE material_id = _mid
     ), 0)
   WHERE id = _mid;
  RETURN NULL;
END; $$;

CREATE TRIGGER inventory_bundles_recompute_stock
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_bundles
  FOR EACH ROW EXECUTE FUNCTION public.recompute_material_stock();

-- 6. Auto bundle_number sequencing helper
CREATE OR REPLACE FUNCTION public.assign_bundle_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.bundle_number IS NULL OR NEW.bundle_number = 0 THEN
    SELECT COALESCE(MAX(bundle_number), 0) + 1 INTO NEW.bundle_number
      FROM public.inventory_bundles WHERE material_id = NEW.material_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER inventory_bundles_assign_number
  BEFORE INSERT ON public.inventory_bundles
  FOR EACH ROW EXECUTE FUNCTION public.assign_bundle_number();

-- 7. Seed legacy bundles for existing materials so stock is preserved
INSERT INTO public.inventory_bundles (material_id, bundle_number, roll_number, fabric_width, purchased_length, usable_length, consumed_length)
SELECT id, 1, 'LEGACY', 'unspecified', available_stock, available_stock, 0
FROM public.materials
WHERE available_stock > 0
  AND NOT EXISTS (SELECT 1 FROM public.inventory_bundles b WHERE b.material_id = materials.id);
