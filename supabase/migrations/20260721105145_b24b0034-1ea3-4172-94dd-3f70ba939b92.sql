
-- Materials: restrict writes to owner or admin/super_admin; scope reads to users with an assigned role
DROP POLICY IF EXISTS "materials read all authenticated" ON public.materials;
DROP POLICY IF EXISTS "materials insert authenticated" ON public.materials;
DROP POLICY IF EXISTS "materials update authenticated" ON public.materials;
DROP POLICY IF EXISTS "materials delete authenticated" ON public.materials;

CREATE POLICY "materials read for assigned users" ON public.materials
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "materials insert owner" ON public.materials
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'inventory_manager'));

CREATE POLICY "materials update owner or admin" ON public.materials
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'inventory_manager'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'inventory_manager'));

CREATE POLICY "materials delete owner or admin" ON public.materials
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'inventory_manager'));

-- Permissions & role_permissions: restrict direct reads to admins (RPC current_user_permissions is SECURITY DEFINER and still works)
DROP POLICY IF EXISTS "authed read permissions" ON public.permissions;
DROP POLICY IF EXISTS "authed read role_permissions" ON public.role_permissions;

CREATE POLICY "admins read permissions" ON public.permissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "admins read role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- Storage: restrict operation-icons writes to admins
DROP POLICY IF EXISTS "operation-icons authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "operation-icons authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "operation-icons authenticated delete" ON storage.objects;

CREATE POLICY "operation-icons admin insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'operation-icons' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "operation-icons admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'operation-icons' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "operation-icons admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'operation-icons' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')));

-- SECURITY DEFINER functions: revoke public/anon EXECUTE; keep authenticated only where needed
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_permissions() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_super_admin_seed() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_users_with_roles() FROM PUBLIC, anon;
