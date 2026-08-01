
-- Tighten RLS to role-based access via has_permission, replacing the
-- "any authenticated user" shared-workspace policies flagged by the scanner.

-- designs
DROP POLICY IF EXISTS "designs shared select" ON public.designs;
DROP POLICY IF EXISTS "designs shared insert" ON public.designs;
DROP POLICY IF EXISTS "designs shared update" ON public.designs;
DROP POLICY IF EXISTS "designs shared delete" ON public.designs;
CREATE POLICY "designs role select" ON public.designs FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'designs.view'));
CREATE POLICY "designs role insert" ON public.designs FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(),'designs.create'));
CREATE POLICY "designs role update" ON public.designs FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(),'designs.edit')) WITH CHECK (public.has_permission(auth.uid(),'designs.edit'));
CREATE POLICY "designs role delete" ON public.designs FOR DELETE TO authenticated USING (public.has_permission(auth.uid(),'designs.delete'));

-- design_images
DROP POLICY IF EXISTS "design_images shared select" ON public.design_images;
DROP POLICY IF EXISTS "design_images shared insert" ON public.design_images;
DROP POLICY IF EXISTS "design_images shared update" ON public.design_images;
DROP POLICY IF EXISTS "design_images shared delete" ON public.design_images;
CREATE POLICY "design_images role select" ON public.design_images FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'designs.view'));
CREATE POLICY "design_images role insert" ON public.design_images FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(),'designs.edit'));
CREATE POLICY "design_images role update" ON public.design_images FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(),'designs.edit')) WITH CHECK (public.has_permission(auth.uid(),'designs.edit'));
CREATE POLICY "design_images role delete" ON public.design_images FOR DELETE TO authenticated USING (public.has_permission(auth.uid(),'designs.edit'));

-- design_materials
DROP POLICY IF EXISTS "design_materials shared all" ON public.design_materials;
CREATE POLICY "design_materials role select" ON public.design_materials FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'designs.view'));
CREATE POLICY "design_materials role write" ON public.design_materials FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'designs.edit')) WITH CHECK (public.has_permission(auth.uid(),'designs.edit'));

-- design_workflows
DROP POLICY IF EXISTS "design_workflows shared all" ON public.design_workflows;
CREATE POLICY "design_workflows role select" ON public.design_workflows FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'designs.view'));
CREATE POLICY "design_workflows role write" ON public.design_workflows FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'designs.edit')) WITH CHECK (public.has_permission(auth.uid(),'designs.edit'));

-- workflow_steps
DROP POLICY IF EXISTS "workflow_steps shared all" ON public.workflow_steps;
CREATE POLICY "workflow_steps role select" ON public.workflow_steps FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'designs.view'));
CREATE POLICY "workflow_steps role write" ON public.workflow_steps FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'designs.edit') OR public.has_permission(auth.uid(),'production.edit')) WITH CHECK (public.has_permission(auth.uid(),'designs.edit') OR public.has_permission(auth.uid(),'production.edit'));

-- production_orders
DROP POLICY IF EXISTS "production_orders shared all" ON public.production_orders;
CREATE POLICY "production_orders role select" ON public.production_orders FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'production.view'));
CREATE POLICY "production_orders role insert" ON public.production_orders FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(),'production.create'));
CREATE POLICY "production_orders role update" ON public.production_orders FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(),'production.edit')) WITH CHECK (public.has_permission(auth.uid(),'production.edit'));
CREATE POLICY "production_orders role delete" ON public.production_orders FOR DELETE TO authenticated USING (public.has_permission(auth.uid(),'production.delete'));

-- production_processes
DROP POLICY IF EXISTS "production_processes shared all" ON public.production_processes;
CREATE POLICY "production_processes role select" ON public.production_processes FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'production.view'));
CREATE POLICY "production_processes role write" ON public.production_processes FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'production.edit')) WITH CHECK (public.has_permission(auth.uid(),'production.edit'));

-- production_activities
DROP POLICY IF EXISTS "production_activities shared all" ON public.production_activities;
CREATE POLICY "production_activities role select" ON public.production_activities FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'production.view'));
CREATE POLICY "production_activities role write" ON public.production_activities FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'production.edit')) WITH CHECK (public.has_permission(auth.uid(),'production.edit'));

-- production_reservations
DROP POLICY IF EXISTS "production_reservations shared select" ON public.production_reservations;
DROP POLICY IF EXISTS "production_reservations shared insert" ON public.production_reservations;
DROP POLICY IF EXISTS "production_reservations shared update" ON public.production_reservations;
DROP POLICY IF EXISTS "production_reservations shared delete" ON public.production_reservations;
CREATE POLICY "production_reservations role select" ON public.production_reservations FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'production.view'));
CREATE POLICY "production_reservations role insert" ON public.production_reservations FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(),'production.edit'));
CREATE POLICY "production_reservations role update" ON public.production_reservations FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(),'production.edit')) WITH CHECK (public.has_permission(auth.uid(),'production.edit'));
CREATE POLICY "production_reservations role delete" ON public.production_reservations FOR DELETE TO authenticated USING (public.has_permission(auth.uid(),'production.edit'));

-- sample_approvals
DROP POLICY IF EXISTS "sample_approvals shared select" ON public.sample_approvals;
DROP POLICY IF EXISTS "sample_approvals shared insert" ON public.sample_approvals;
CREATE POLICY "sample_approvals role select" ON public.sample_approvals FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'approvals.view'));
CREATE POLICY "sample_approvals role insert" ON public.sample_approvals FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(),'approvals.create') AND approver_user_id = auth.uid());

-- Storage: scope design-images bucket SELECT to users with designs.view
DROP POLICY IF EXISTS "design-images authenticated read" ON storage.objects;
CREATE POLICY "design-images role read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'design-images' AND public.has_permission(auth.uid(),'designs.view'));

-- SECURITY DEFINER functions: revoke broad EXECUTE from PUBLIC/anon; keep authenticated only where the app needs it.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_permissions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ensure_super_admin_seed() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_users_with_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_super_admin_seed() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_users_with_roles() TO authenticated;
