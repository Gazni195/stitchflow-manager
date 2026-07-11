-- Workers (shop-wide roster, readable by all authenticated users like operations_catalog)
CREATE TABLE public.workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  phone text,
  department text NOT NULL DEFAULT '',
  daily_wage numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.workers TO authenticated;
GRANT ALL ON public.workers TO service_role;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workers readable by authenticated"
  ON public.workers FOR SELECT TO authenticated USING (true);

INSERT INTO public.workers (name, role, phone, department, daily_wage) VALUES
  ('Rahman',       'Cutting Master',        '+91 98765 43210', 'Cutting Dept.',    900),
  ('Ramesh',       'Hand Work Lead',        '+91 98765 43211', 'Hand Work Dept.',  850),
  ('Priya',        'Embroidery Specialist', '+91 98765 43212', 'Embroidery Dept.', 800),
  ('Sunita',       'Printing Operator',     '+91 98765 43213', 'Printing Dept.',   750),
  ('Kavita',       'Wash/Dye Technician',   '+91 98765 43214', 'Wash / Dye Dept.', 780),
  ('Salim',        'Stitching Master',      '+91 98765 43215', 'Stitching Dept.',  950),
  ('Anita Sharma', 'QC Inspector',          '+91 98765 43216', 'QC Department',    820),
  ('Vikram Rao',   'General Helper',        '+91 98765 43217', 'General',          700);

-- Departments on the operations catalog + 3 new operations the sample flow needs
ALTER TABLE public.operations_catalog ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT '';

UPDATE public.operations_catalog SET department = CASE id
  WHEN 'fabric-selection'   THEN 'Fabric Dept.'
  WHEN 'sample-cutting'     THEN 'Cutting Dept.'
  WHEN 'sample-handwork'    THEN 'Hand Work Dept.'
  WHEN 'sample-stitching'   THEN 'Stitching Dept.'
  WHEN 'machine-embroidery' THEN 'Embroidery Dept.'
  WHEN 'sample-qc'          THEN 'QC Department'
  WHEN 'sample-approval'    THEN 'Approval'
  WHEN 'cutting'            THEN 'Cutting Dept.'
  WHEN 'handwork'           THEN 'Hand Work Dept.'
  WHEN 'stitching'          THEN 'Stitching Dept.'
  WHEN 'bulk-embroidery'    THEN 'Embroidery Dept.'
  WHEN 'qc'                 THEN 'QC Department'
  WHEN 'packing'            THEN 'Packing Dept.'
  WHEN 'barcode'            THEN 'Barcode Dept.'
  WHEN 'ready-stock'        THEN 'Warehouse'
  ELSE department
END;

INSERT INTO public.operations_catalog (id, name, short, category, repeatable, sort, department) VALUES
  ('printing',       'Printing',      'Printing', 'Sample', true, 45,  'Printing Dept.'),
  ('wash-dye',       'Wash / Dye',    'Wash/Dye', 'Sample', true, 47,  'Wash / Dye Dept.'),
  ('other-process',  'Other Process', 'Other',    'Sample', true, 999, 'General')
ON CONFLICT (id) DO NOTHING;

-- Worker assignment, timer, cost and reference-file tracking per step
ALTER TABLE public.workflow_steps
  ADD COLUMN IF NOT EXISTS assigned_worker_id uuid REFERENCES public.workers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_per_piece numeric,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accumulated_seconds int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reference_file_path text,
  ADD COLUMN IF NOT EXISTS reference_file_name text,
  ADD COLUMN IF NOT EXISTS reference_file_size int;

-- Bill of materials (per-design, owner-scoped like design_workflows)
CREATE TABLE public.sample_bom_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('part','accessory')),
  part_id text,
  name text NOT NULL,
  color text NOT NULL DEFAULT '',
  consumption numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'Mtr',
  rate numeric NOT NULL DEFAULT 0,
  sequence int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sample_bom_items_design_idx ON public.sample_bom_items(design_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sample_bom_items TO authenticated;
GRANT ALL ON public.sample_bom_items TO service_role;
ALTER TABLE public.sample_bom_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sample_bom_items owner all"
  ON public.sample_bom_items FOR ALL TO authenticated
  USING (public.has_design_access(design_id))
  WITH CHECK (public.has_design_access(design_id));
CREATE TRIGGER sample_bom_items_set_updated_at BEFORE UPDATE ON public.sample_bom_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Production order number + approval notes + misc cost, on the workflow row itself
ALTER TABLE public.design_workflows
  ADD COLUMN IF NOT EXISTS po_number text,
  ADD COLUMN IF NOT EXISTS approval_notes text,
  ADD COLUMN IF NOT EXISTS other_charges numeric NOT NULL DEFAULT 0;

CREATE SEQUENCE IF NOT EXISTS public.production_order_seq START 1;
GRANT USAGE ON SEQUENCE public.production_order_seq TO authenticated;

-- Rejected-sample status
ALTER TABLE public.designs DROP CONSTRAINT IF EXISTS designs_status_check;
ALTER TABLE public.designs ADD CONSTRAINT designs_status_check
  CHECK (status IN ('draft','sampling','sample_approved','sample_rejected','in_production','completed'));
