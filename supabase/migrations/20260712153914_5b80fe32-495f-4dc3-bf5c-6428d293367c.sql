
CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'm',
  rate numeric(12,2) NOT NULL DEFAULT 0,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materials owner all" ON public.materials FOR ALL TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE TRIGGER materials_updated_at BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.design_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  group_name text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 0,
  rate numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX design_materials_design_idx ON public.design_materials(design_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.design_materials TO authenticated;
GRANT ALL ON public.design_materials TO service_role;
ALTER TABLE public.design_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "design_materials owner all" ON public.design_materials FOR ALL TO authenticated
  USING (public.has_design_access(design_id)) WITH CHECK (public.has_design_access(design_id));
CREATE TRIGGER design_materials_updated_at BEFORE UPDATE ON public.design_materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
