
-- Operations catalog (seed data referenced by workflow steps)
CREATE TABLE public.operations_catalog (
  id text PRIMARY KEY,
  name text NOT NULL,
  short text NOT NULL,
  category text NOT NULL CHECK (category IN ('Sample','Bulk','Finishing')),
  repeatable boolean NOT NULL DEFAULT false,
  sort int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.operations_catalog TO anon, authenticated;
GRANT ALL ON public.operations_catalog TO service_role;
ALTER TABLE public.operations_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operations_catalog readable by all"
  ON public.operations_catalog FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.operations_catalog (id, name, short, category, repeatable, sort) VALUES
  ('fabric-selection',    'Fabric Selection',    'Fabric',    'Sample',    false, 10),
  ('sample-cutting',      'Sample Cutting',      'S.Cutting', 'Sample',    true,  20),
  ('sample-handwork',     'Sample Hand Work',    'S.Handwork','Sample',    true,  30),
  ('sample-stitching',    'Sample Stitching',    'S.Stitch',  'Sample',    true,  40),
  ('machine-embroidery',  'Machine Embroidery',  'Embroidery','Sample',    true,  50),
  ('sample-qc',           'Sample QC',           'S.QC',      'Sample',    true,  60),
  ('sample-approval',     'Sample Approval',     'Approval',  'Sample',    false, 70),
  ('cutting',             'Bulk Cutting',        'Cutting',   'Bulk',      true, 110),
  ('handwork',            'Bulk Hand Work',      'Hand Work', 'Bulk',      true, 120),
  ('stitching',           'Bulk Stitching',      'Stitching', 'Bulk',      true, 130),
  ('bulk-embroidery',     'Bulk Embroidery',     'Embroidery','Bulk',      true, 140),
  ('qc',                  'Quality Check',       'QC',        'Finishing', true, 210),
  ('packing',             'Packing',             'Packing',   'Finishing', false,220),
  ('barcode',             'Barcode',             'Barcode',   'Finishing', false,230),
  ('ready-stock',         'Ready Stock',         'Stock',     'Finishing', false,240);

-- Designs
CREATE TABLE public.designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  customer text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  fabric text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '',
  order_quantity int NOT NULL DEFAULT 0 CHECK (order_quantity >= 0),
  image_path text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sampling','sample_approved','in_production','completed')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX designs_created_by_idx ON public.designs(created_by);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.designs TO authenticated;
GRANT ALL ON public.designs TO service_role;
ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "designs owner select" ON public.designs FOR SELECT TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "designs owner insert" ON public.designs FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "designs owner update" ON public.designs FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "designs owner delete" ON public.designs FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Design workflows
CREATE TABLE public.design_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('sample','bulk')),
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (design_id, kind)
);
CREATE INDEX design_workflows_design_idx ON public.design_workflows(design_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.design_workflows TO authenticated;
GRANT ALL ON public.design_workflows TO service_role;

-- Helper: access to a design
CREATE OR REPLACE FUNCTION public.has_design_access(_design_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.designs d WHERE d.id = _design_id AND d.created_by = auth.uid());
$$;

ALTER TABLE public.design_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "design_workflows owner all"
  ON public.design_workflows FOR ALL TO authenticated
  USING (public.has_design_access(design_id))
  WITH CHECK (public.has_design_access(design_id));

-- Workflow steps
CREATE TABLE public.workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.design_workflows(id) ON DELETE CASCADE,
  operation_id text NOT NULL REFERENCES public.operations_catalog(id),
  sequence int NOT NULL,
  label text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in-progress','completed','skipped')),
  assigned_to text,
  input_quantity int,
  output_quantity int,
  wastage_quantity int,
  start_date date,
  end_date date,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workflow_steps_wf_seq_idx ON public.workflow_steps(workflow_id, sequence);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_steps TO authenticated;
GRANT ALL ON public.workflow_steps TO service_role;

CREATE OR REPLACE FUNCTION public.has_workflow_access(_workflow_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.design_workflows w
      JOIN public.designs d ON d.id = w.design_id
     WHERE w.id = _workflow_id AND d.created_by = auth.uid()
  );
$$;

ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workflow_steps owner all"
  ON public.workflow_steps FOR ALL TO authenticated
  USING (public.has_workflow_access(workflow_id))
  WITH CHECK (public.has_workflow_access(workflow_id));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER designs_set_updated_at BEFORE UPDATE ON public.designs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER design_workflows_set_updated_at BEFORE UPDATE ON public.design_workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER workflow_steps_set_updated_at BEFORE UPDATE ON public.workflow_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Approve sample: snapshot sample workflow into a fresh bulk workflow, atomic
CREATE OR REPLACE FUNCTION public.approve_sample(_design_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sample_wf uuid;
  _bulk_wf uuid;
BEGIN
  IF NOT public.has_design_access(_design_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO _sample_wf FROM public.design_workflows
    WHERE design_id = _design_id AND kind = 'sample';
  IF _sample_wf IS NULL THEN
    RAISE EXCEPTION 'sample workflow missing';
  END IF;

  -- Lock the sample workflow so history is preserved
  UPDATE public.design_workflows SET locked = true WHERE id = _sample_wf;

  -- Remove any existing bulk workflow so we can regenerate from the sample
  DELETE FROM public.design_workflows WHERE design_id = _design_id AND kind = 'bulk';

  INSERT INTO public.design_workflows (design_id, kind, locked)
    VALUES (_design_id, 'bulk', false)
    RETURNING id INTO _bulk_wf;

  INSERT INTO public.workflow_steps (workflow_id, operation_id, sequence, label, status)
    SELECT _bulk_wf, s.operation_id, s.sequence, s.label, 'pending'
      FROM public.workflow_steps s
      WHERE s.workflow_id = _sample_wf
      ORDER BY s.sequence;

  UPDATE public.designs SET status = 'sample_approved' WHERE id = _design_id;

  RETURN _bulk_wf;
END; $$;
GRANT EXECUTE ON FUNCTION public.approve_sample(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.start_bulk_production(_design_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_design_access(_design_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.design_workflows SET locked = true WHERE design_id = _design_id AND kind = 'bulk';
  UPDATE public.designs SET status = 'in_production' WHERE id = _design_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.start_bulk_production(uuid) TO authenticated;
