-- approve_sample gains an optional notes param and stamps a production order number.
-- Changing the parameter list requires DROP + CREATE (not a same-signature REPLACE).
DROP FUNCTION IF EXISTS public.approve_sample(uuid);

CREATE FUNCTION public.approve_sample(_design_id uuid, _notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _sample_wf uuid;
  _bulk_wf uuid;
  _po text;
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
  UPDATE public.design_workflows SET locked = true, approval_notes = _notes WHERE id = _sample_wf;

  -- Remove any existing bulk workflow so we can regenerate from the sample
  DELETE FROM public.design_workflows WHERE design_id = _design_id AND kind = 'bulk';

  _po := 'PO-' || lpad(nextval('public.production_order_seq')::text, 5, '0');

  INSERT INTO public.design_workflows (design_id, kind, locked, po_number)
    VALUES (_design_id, 'bulk', false, _po)
    RETURNING id INTO _bulk_wf;

  INSERT INTO public.workflow_steps (workflow_id, operation_id, sequence, label, status)
    SELECT _bulk_wf, s.operation_id, s.sequence, s.label, 'pending'
      FROM public.workflow_steps s
      WHERE s.workflow_id = _sample_wf
      ORDER BY s.sequence;

  UPDATE public.designs SET status = 'sample_approved' WHERE id = _design_id;

  RETURN _bulk_wf;
END; $$;

REVOKE ALL ON FUNCTION public.approve_sample(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_sample(uuid, text) TO authenticated;

-- Reject a sample: records notes, marks the design rejected. Leaves workflows untouched
-- so the user can keep editing the sample steps and re-submit for approval later.
CREATE OR REPLACE FUNCTION public.reject_sample(_design_id uuid, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public.has_design_access(_design_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.design_workflows SET approval_notes = _notes
    WHERE design_id = _design_id AND kind = 'sample';

  UPDATE public.designs SET status = 'sample_rejected' WHERE id = _design_id;
END; $$;

REVOKE ALL ON FUNCTION public.reject_sample(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_sample(uuid, text) TO authenticated;
