
-- Switch to SECURITY INVOKER: callers already have access via RLS, so definer isn't needed.
CREATE OR REPLACE FUNCTION public.has_design_access(_design_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.designs d WHERE d.id = _design_id AND d.created_by = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.has_workflow_access(_workflow_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.design_workflows w
    JOIN public.designs d ON d.id = w.design_id
    WHERE w.id = _workflow_id AND d.created_by = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.approve_sample(_design_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE _sample_wf uuid; _bulk_wf uuid;
BEGIN
  IF NOT public.has_design_access(_design_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT id INTO _sample_wf FROM public.design_workflows WHERE design_id = _design_id AND kind = 'sample';
  IF _sample_wf IS NULL THEN RAISE EXCEPTION 'sample workflow missing'; END IF;
  UPDATE public.design_workflows SET locked = true WHERE id = _sample_wf;
  DELETE FROM public.design_workflows WHERE design_id = _design_id AND kind = 'bulk';
  INSERT INTO public.design_workflows (design_id, kind, locked) VALUES (_design_id, 'bulk', false) RETURNING id INTO _bulk_wf;
  INSERT INTO public.workflow_steps (workflow_id, operation_id, sequence, label, status)
    SELECT _bulk_wf, s.operation_id, s.sequence, s.label, 'pending'
      FROM public.workflow_steps s WHERE s.workflow_id = _sample_wf ORDER BY s.sequence;
  UPDATE public.designs SET status = 'sample_approved' WHERE id = _design_id;
  RETURN _bulk_wf;
END; $$;

CREATE OR REPLACE FUNCTION public.start_bulk_production(_design_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public.has_design_access(_design_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.design_workflows SET locked = true WHERE design_id = _design_id AND kind = 'bulk';
  UPDATE public.designs SET status = 'in_production' WHERE id = _design_id;
END; $$;

-- Storage policies: users manage only images inside their own <uid>/... folder
CREATE POLICY "design-images owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'design-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "design-images owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'design-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "design-images owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'design-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "design-images owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'design-images' AND (storage.foldername(name))[1] = auth.uid()::text);
