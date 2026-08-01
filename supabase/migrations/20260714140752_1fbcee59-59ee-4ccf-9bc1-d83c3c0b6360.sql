
CREATE TABLE IF NOT EXISTS public.production_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  issued_qty INTEGER NOT NULL DEFAULT 0,
  returned_qty INTEGER,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  elapsed_seconds INTEGER,
  effective_seconds INTEGER,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS production_activities_po_idx ON public.production_activities(production_order_id);
CREATE INDEX IF NOT EXISTS production_activities_status_idx ON public.production_activities(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_activities TO authenticated;
GRANT ALL ON public.production_activities TO service_role;

ALTER TABLE public.production_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view activities"
  ON public.production_activities FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.production_orders p
    JOIN public.designs d ON d.id = p.design_id
    WHERE p.id = production_order_id AND d.created_by = auth.uid()
  ));

CREATE POLICY "Owners can insert activities"
  ON public.production_activities FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.production_orders p
    JOIN public.designs d ON d.id = p.design_id
    WHERE p.id = production_order_id AND d.created_by = auth.uid()
  ));

CREATE POLICY "Owners can update activities"
  ON public.production_activities FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.production_orders p
    JOIN public.designs d ON d.id = p.design_id
    WHERE p.id = production_order_id AND d.created_by = auth.uid()
  ));

CREATE POLICY "Owners can delete activities"
  ON public.production_activities FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.production_orders p
    JOIN public.designs d ON d.id = p.design_id
    WHERE p.id = production_order_id AND d.created_by = auth.uid()
  ));

CREATE TRIGGER production_activities_set_updated_at
  BEFORE UPDATE ON public.production_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
