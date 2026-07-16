
CREATE TABLE public.design_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id UUID NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Other',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX design_images_design_id_idx ON public.design_images(design_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.design_images TO authenticated;
GRANT ALL ON public.design_images TO service_role;

ALTER TABLE public.design_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view design images"
  ON public.design_images FOR SELECT TO authenticated
  USING (public.has_design_access(design_id));

CREATE POLICY "Owners can insert design images"
  ON public.design_images FOR INSERT TO authenticated
  WITH CHECK (public.has_design_access(design_id) AND created_by = auth.uid());

CREATE POLICY "Owners can update design images"
  ON public.design_images FOR UPDATE TO authenticated
  USING (public.has_design_access(design_id))
  WITH CHECK (public.has_design_access(design_id));

CREATE POLICY "Owners can delete design images"
  ON public.design_images FOR DELETE TO authenticated
  USING (public.has_design_access(design_id));

CREATE TRIGGER design_images_set_updated_at
  BEFORE UPDATE ON public.design_images
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
