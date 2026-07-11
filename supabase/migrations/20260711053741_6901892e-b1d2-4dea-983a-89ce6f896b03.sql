
REVOKE ALL ON FUNCTION public.has_design_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_workflow_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_sample(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_bulk_production(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;

-- Only authenticated users execute the RPCs; helpers are used inside RLS.
GRANT EXECUTE ON FUNCTION public.has_design_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_workflow_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_sample(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_bulk_production(uuid) TO authenticated;
