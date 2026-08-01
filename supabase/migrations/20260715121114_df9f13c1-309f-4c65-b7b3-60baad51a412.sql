
CREATE TABLE public.production_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  lot_code text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_reservations TO authenticated;
GRANT ALL ON public.production_reservations TO service_role;

ALTER TABLE public.production_reservations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_production_order_access(_po_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.production_orders p
    JOIN public.designs d ON d.id = p.design_id
    WHERE p.id = _po_id AND d.created_by = auth.uid()
  );
$$;

CREATE POLICY "reservations select own"
  ON public.production_reservations FOR SELECT TO authenticated
  USING (public.has_production_order_access(production_order_id));

CREATE POLICY "reservations insert own"
  ON public.production_reservations FOR INSERT TO authenticated
  WITH CHECK (public.has_production_order_access(production_order_id));

CREATE POLICY "reservations update own"
  ON public.production_reservations FOR UPDATE TO authenticated
  USING (public.has_production_order_access(production_order_id))
  WITH CHECK (public.has_production_order_access(production_order_id));

CREATE POLICY "reservations delete own"
  ON public.production_reservations FOR DELETE TO authenticated
  USING (public.has_production_order_access(production_order_id));

CREATE TRIGGER trg_production_reservations_updated_at
  BEFORE UPDATE ON public.production_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_production_reservations_po ON public.production_reservations(production_order_id);
CREATE INDEX idx_production_reservations_material ON public.production_reservations(material_id);
