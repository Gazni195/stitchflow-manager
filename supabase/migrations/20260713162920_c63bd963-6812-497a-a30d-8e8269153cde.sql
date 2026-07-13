
CREATE TABLE public.sample_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  design_id UUID NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  approver_name TEXT NOT NULL,
  approver_user_id UUID,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (design_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sample_approvals TO authenticated;
GRANT ALL ON public.sample_approvals TO service_role;

ALTER TABLE public.sample_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view sample approvals"
  ON public.sample_approvals FOR SELECT
  TO authenticated
  USING (public.has_design_access(design_id));

CREATE POLICY "Owners insert sample approvals"
  ON public.sample_approvals FOR INSERT
  TO authenticated
  WITH CHECK (public.has_design_access(design_id));

CREATE POLICY "Owners update sample approvals"
  ON public.sample_approvals FOR UPDATE
  TO authenticated
  USING (public.has_design_access(design_id))
  WITH CHECK (public.has_design_access(design_id));

CREATE POLICY "Owners delete sample approvals"
  ON public.sample_approvals FOR DELETE
  TO authenticated
  USING (public.has_design_access(design_id));

CREATE TRIGGER sample_approvals_set_updated_at
  BEFORE UPDATE ON public.sample_approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
