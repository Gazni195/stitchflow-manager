
-- 1. materials.fabric_type
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS fabric_type text;

-- 2. production_reservations.bundle_id
ALTER TABLE public.production_reservations
  ADD COLUMN IF NOT EXISTS bundle_id uuid REFERENCES public.inventory_bundles(id) ON DELETE SET NULL;

-- 3. consumption_reduction_rules
CREATE TABLE IF NOT EXISTS public.consumption_reduction_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  fabric_type text NOT NULL,
  width_min numeric NOT NULL,
  width_max numeric NOT NULL,
  layer_min numeric NOT NULL,
  layer_max numeric NOT NULL,
  reduction_pct numeric NOT NULL CHECK (reduction_pct >= 0 AND reduction_pct <= 100),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consumption_reduction_rules TO authenticated;
GRANT ALL ON public.consumption_reduction_rules TO service_role;

ALTER TABLE public.consumption_reduction_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reduction_rules_read_authenticated"
  ON public.consumption_reduction_rules FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "reduction_rules_write_settings_edit"
  ON public.consumption_reduction_rules FOR ALL
  TO authenticated
  USING (public.has_permission(auth.uid(), 'settings.edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'settings.edit'));

CREATE TRIGGER trg_reduction_rules_updated_at
  BEFORE UPDATE ON public.consumption_reduction_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. start_production_v2
CREATE OR REPLACE FUNCTION public.start_production_v2(
  _design_id uuid,
  _order_quantity integer,
  _start_date date,
  _supervisor text,
  _bundle_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _po_id uuid;
  _code text;
  _bundle record;
BEGIN
  IF NOT public.has_design_access(_design_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _code := 'PO' || LPAD(nextval('public.production_order_seq')::text, 3, '0');

  INSERT INTO public.production_orders (code, design_id, order_quantity, start_date, supervisor, created_by)
  VALUES (_code, _design_id, _order_quantity, COALESCE(_start_date, CURRENT_DATE), NULLIF(_supervisor,''), auth.uid())
  RETURNING id INTO _po_id;

  -- Seed the 5 fixed operations
  INSERT INTO public.production_processes (production_order_id, operation_id, sequence, status) VALUES
    (_po_id, 'cutting',    1, 'pending'),
    (_po_id, 'handwork',   2, 'locked'),
    (_po_id, 'embroidery', 3, 'locked'),
    (_po_id, 'stitching',  4, 'locked'),
    (_po_id, 'qc',         5, 'locked');

  -- Reserve each selected bundle (full purchased length) and mark it reserved via trigger.
  IF _bundle_ids IS NOT NULL THEN
    FOR _bundle IN
      SELECT id, material_id, purchased_length, allocated_length
      FROM public.inventory_bundles
      WHERE id = ANY(_bundle_ids)
      FOR UPDATE
    LOOP
      INSERT INTO public.production_reservations (production_order_id, material_id, bundle_id, quantity, created_by)
      VALUES (_po_id, _bundle.material_id, _bundle.id, _bundle.purchased_length - _bundle.allocated_length, auth.uid());

      UPDATE public.inventory_bundles
        SET allocated_length = purchased_length
        WHERE id = _bundle.id;
    END LOOP;
  END IF;

  UPDATE public.designs SET status = 'in_production' WHERE id = _design_id;

  RETURN _po_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_production_v2(uuid, integer, date, text, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_production_v2(uuid, integer, date, text, uuid[]) TO authenticated;
