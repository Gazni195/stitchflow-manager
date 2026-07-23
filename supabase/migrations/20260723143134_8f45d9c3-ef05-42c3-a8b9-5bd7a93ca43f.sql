
CREATE TABLE IF NOT EXISTS public.sample_approval_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  role text NOT NULL,
  action text NOT NULL CHECK (action IN ('approved','withdrawn')),
  actor_user_id uuid,
  actor_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sample_approval_audit TO authenticated;
GRANT ALL ON public.sample_approval_audit TO service_role;

ALTER TABLE public.sample_approval_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit readable by approvals viewers"
  ON public.sample_approval_audit FOR SELECT
  TO authenticated
  USING (public.has_permission(auth.uid(), 'approvals.view'));

CREATE POLICY "audit insertable by approvals editors"
  ON public.sample_approval_audit FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), 'approvals.edit')
    OR public.has_permission(auth.uid(), 'designs.edit')
  );

CREATE INDEX IF NOT EXISTS sample_approval_audit_design_idx
  ON public.sample_approval_audit (design_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.withdraw_sample_approval(_design_id uuid, _role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _status text;
  _actor_name text;
BEGIN
  IF NOT (public.has_permission(auth.uid(), 'approvals.edit')
       OR public.has_permission(auth.uid(), 'designs.edit')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT status INTO _status FROM public.designs WHERE id = _design_id;
  IF _status IS NULL THEN
    RAISE EXCEPTION 'design not found';
  END IF;
  IF _status IN ('in_production','completed') THEN
    RAISE EXCEPTION 'Cannot withdraw approval after production has started';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sample_approvals WHERE design_id = _design_id AND role = _role
  ) THEN
    RAISE EXCEPTION 'This approver has not signed off yet';
  END IF;

  SELECT COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
    INTO _actor_name FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.sample_approval_audit (design_id, role, action, actor_user_id, actor_name)
  VALUES (_design_id, _role, 'withdrawn', auth.uid(), _actor_name);

  DELETE FROM public.sample_approvals WHERE design_id = _design_id AND role = _role;

  IF _status = 'sample_approved' THEN
    UPDATE public.design_workflows SET locked = false
      WHERE design_id = _design_id AND kind = 'sample';
    DELETE FROM public.design_workflows WHERE design_id = _design_id AND kind = 'bulk';
    UPDATE public.designs SET status = 'sampling' WHERE id = _design_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.withdraw_sample_approval(uuid, text) TO authenticated;
