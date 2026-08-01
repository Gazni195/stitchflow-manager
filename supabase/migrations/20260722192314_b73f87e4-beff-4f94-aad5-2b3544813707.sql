CREATE OR REPLACE FUNCTION public.revert_sample_approval(_design_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_permission(auth.uid(), 'approvals.edit')
       OR public.has_permission(auth.uid(), 'designs.edit')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.designs WHERE id = _design_id AND status = 'sample_approved'
  ) THEN
    RAISE EXCEPTION 'This sample is not in an approved state that can be withdrawn';
  END IF;
  DELETE FROM public.sample_approvals WHERE design_id = _design_id;
  UPDATE public.design_workflows SET locked = false
    WHERE design_id = _design_id AND kind = 'sample';
  DELETE FROM public.design_workflows WHERE design_id = _design_id AND kind = 'bulk';
  UPDATE public.designs SET status = 'sampling' WHERE id = _design_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revert_sample_approval(uuid) TO authenticated;