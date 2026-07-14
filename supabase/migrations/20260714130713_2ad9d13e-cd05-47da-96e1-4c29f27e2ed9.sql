REVOKE UPDATE, DELETE ON public.sample_approvals FROM authenticated;

DROP POLICY IF EXISTS "Owners update sample approvals" ON public.sample_approvals;
DROP POLICY IF EXISTS "Owners delete sample approvals" ON public.sample_approvals;