
-- Sequence for auto PO codes
CREATE SEQUENCE IF NOT EXISTS public.production_order_seq START 1;

-- ============ production_orders ============
CREATE TABLE public.production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  design_id uuid NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  order_quantity integer NOT NULL CHECK (order_quantity > 0),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  supervisor text,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_orders TO authenticated;
GRANT ALL ON public.production_orders TO service_role;
GRANT USAGE ON SEQUENCE public.production_order_seq TO authenticated, service_role;

ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own production orders" ON public.production_orders
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designs d WHERE d.id = design_id AND d.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.designs d WHERE d.id = design_id AND d.created_by = auth.uid()));

CREATE TRIGGER trg_po_updated BEFORE UPDATE ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ production_processes ============
CREATE TABLE public.production_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  operation_id text NOT NULL,
  sequence integer NOT NULL,
  status text NOT NULL DEFAULT 'locked' CHECK (status IN ('locked','pending','issued','completed')),
  worker_type text CHECK (worker_type IN ('hand_worker','machine_operator','vendor')),
  assigned_to text,
  issued_qty integer,
  returned_qty integer,
  notes text,
  issued_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pp_po ON public.production_processes(production_order_id, sequence);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_processes TO authenticated;
GRANT ALL ON public.production_processes TO service_role;

ALTER TABLE public.production_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own production processes" ON public.production_processes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.production_orders p
    JOIN public.designs d ON d.id = p.design_id
    WHERE p.id = production_order_id AND d.created_by = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.production_orders p
    JOIN public.designs d ON d.id = p.design_id
    WHERE p.id = production_order_id AND d.created_by = auth.uid()
  ));

CREATE TRIGGER trg_pp_updated BEFORE UPDATE ON public.production_processes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ RPC: start production ============
CREATE OR REPLACE FUNCTION public.start_production(
  _design_id uuid,
  _order_quantity integer,
  _start_date date,
  _supervisor text
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _po_id uuid;
  _code text;
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

  UPDATE public.designs SET status = 'in_production' WHERE id = _design_id;

  RETURN _po_id;
END;
$$;

-- ============ RPC: issue bundle ============
CREATE OR REPLACE FUNCTION public.issue_bundle(
  _process_id uuid,
  _worker_type text,
  _assigned_to text,
  _issued_qty integer,
  _notes text
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE _po_id uuid;
BEGIN
  SELECT production_order_id INTO _po_id FROM public.production_processes WHERE id = _process_id;
  IF _po_id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.production_orders p JOIN public.designs d ON d.id = p.design_id
    WHERE p.id = _po_id AND d.created_by = auth.uid()
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.production_processes
     SET status = 'issued',
         worker_type = _worker_type,
         assigned_to = _assigned_to,
         issued_qty = _issued_qty,
         notes = NULLIF(_notes,''),
         issued_at = now()
   WHERE id = _process_id AND status = 'pending';
END;
$$;

-- ============ RPC: complete process ============
CREATE OR REPLACE FUNCTION public.complete_process(
  _process_id uuid,
  _returned_qty integer
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _po_id uuid;
  _seq integer;
  _remaining integer;
BEGIN
  SELECT production_order_id, sequence INTO _po_id, _seq
    FROM public.production_processes WHERE id = _process_id;
  IF _po_id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.production_orders p JOIN public.designs d ON d.id = p.design_id
    WHERE p.id = _po_id AND d.created_by = auth.uid()
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.production_processes
     SET status = 'completed',
         returned_qty = _returned_qty,
         completed_at = now()
   WHERE id = _process_id AND status = 'issued';

  -- Unlock the next process
  UPDATE public.production_processes
     SET status = 'pending'
   WHERE production_order_id = _po_id
     AND sequence = _seq + 1
     AND status = 'locked';

  -- If nothing left pending/issued/locked, mark PO completed
  SELECT COUNT(*) INTO _remaining FROM public.production_processes
    WHERE production_order_id = _po_id AND status <> 'completed';
  IF _remaining = 0 THEN
    UPDATE public.production_orders
       SET status = 'completed', completed_at = now()
     WHERE id = _po_id;
  END IF;
END;
$$;
