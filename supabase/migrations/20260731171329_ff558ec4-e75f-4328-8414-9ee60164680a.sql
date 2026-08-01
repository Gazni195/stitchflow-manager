-- Workflow Configuration (Step 2 of Start Production) now lets the user
-- reorder, enable/disable, and assign a default workstation/supervisor to
-- each operation before starting production. That configured order must
-- become the actual production execution order, so start_production_v2
-- needs to seed production_processes from a caller-supplied, ordered list
-- instead of a fixed 5-operation list.

-- 1. Generated workstation id (e.g. "C3"), same convention as
--    production_activities.workstation_id — not a foreign key, since
--    workstations are generated strings from workstation_config, not rows.
ALTER TABLE public.production_processes
  ADD COLUMN IF NOT EXISTS workstation_id text;

-- 2. Replace start_production_v2: drop the old 5-argument signature and
--    recreate with a 6th "_steps" argument carrying the final, ordered,
--    enabled-only workflow the user configured in Step 2.
DROP FUNCTION IF EXISTS public.start_production_v2(uuid, integer, date, text, uuid[]);

CREATE OR REPLACE FUNCTION public.start_production_v2(
  _design_id uuid,
  _order_quantity integer,
  _start_date date,
  _supervisor text,
  _bundle_ids uuid[],
  _steps jsonb
) RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _po_id uuid;
  _code text;
  _bundle record;
  _step jsonb;
  _seq integer := 0;
BEGIN
  IF NOT public.has_design_access(_design_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _steps IS NULL OR jsonb_array_length(_steps) = 0 THEN
    RAISE EXCEPTION 'at least one workflow step is required';
  END IF;

  _code := 'PO' || LPAD(nextval('public.production_order_seq')::text, 3, '0');

  INSERT INTO public.production_orders (code, design_id, order_quantity, start_date, supervisor, created_by)
  VALUES (_code, _design_id, _order_quantity, COALESCE(_start_date, CURRENT_DATE), NULLIF(_supervisor,''), auth.uid())
  RETURNING id INTO _po_id;

  FOR _step IN SELECT * FROM jsonb_array_elements(_steps)
  LOOP
    _seq := _seq + 1;
    INSERT INTO public.production_processes
      (production_order_id, operation_id, sequence, status, workstation_id, assigned_to)
    VALUES (
      _po_id,
      _step->>'operation_id',
      _seq,
      CASE WHEN _seq = 1 THEN 'pending' ELSE 'locked' END,
      NULLIF(_step->>'workstation_id', ''),
      NULLIF(_step->>'assigned_to', '')
    );
  END LOOP;

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

REVOKE ALL ON FUNCTION public.start_production_v2(uuid, integer, date, text, uuid[], jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_production_v2(uuid, integer, date, text, uuid[], jsonb) TO authenticated;