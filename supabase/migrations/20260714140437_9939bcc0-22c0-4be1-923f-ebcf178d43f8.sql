
CREATE TABLE public.production_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  operation_id text NOT NULL,
  assigned_to text NOT NULL,
  issued_qty integer NOT NULL CHECK (issued_qty > 0),
  returned_qty integer,
  notes text,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  elapsed_seconds integer,
  effective_seconds integer,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_activities TO authenticated;
GRANT ALL ON public.production_activities TO service_role;

ALTER TABLE public.production_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own production activities" ON public.production_activities
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.production_orders p
    JOIN public.designs d ON d.id = p.design_id
    WHERE p.id = production_activities.production_order_id
      AND d.created_by = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.production_orders p
    JOIN public.designs d ON d.id = p.design_id
    WHERE p.id = production_activities.production_order_id
      AND d.created_by = auth.uid()
  ));

CREATE TRIGGER trg_pa_updated BEFORE UPDATE ON public.production_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_pa_po ON public.production_activities(production_order_id, started_at DESC);
CREATE INDEX idx_pa_po_status ON public.production_activities(production_order_id, status);
