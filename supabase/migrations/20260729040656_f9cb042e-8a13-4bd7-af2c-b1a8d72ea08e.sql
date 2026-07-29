
-- materials: replace broad read policy
DROP POLICY IF EXISTS "materials read for assigned users" ON public.materials;
CREATE POLICY "materials read for permitted users" ON public.materials
  FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), 'materials.view')
    OR public.has_role(auth.uid(), 'inventory_manager')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- inventory_bundles
DROP POLICY IF EXISTS "bundles read" ON public.inventory_bundles;
CREATE POLICY "bundles read" ON public.inventory_bundles
  FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), 'materials.view')
    OR public.has_role(auth.uid(), 'inventory_manager')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- material_code_settings
DROP POLICY IF EXISTS "code settings read" ON public.material_code_settings;
CREATE POLICY "code settings read" ON public.material_code_settings
  FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), 'settings.edit')
    OR public.has_role(auth.uid(), 'inventory_manager')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- operations_catalog: restrict to authenticated
DROP POLICY IF EXISTS "operations_catalog readable by all" ON public.operations_catalog;
CREATE POLICY "operations_catalog readable by authenticated" ON public.operations_catalog
  FOR SELECT TO authenticated
  USING (true);
REVOKE SELECT ON public.operations_catalog FROM anon;

-- Revoke anon execute on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.next_material_code() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revert_sample_approval(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.withdraw_sample_approval(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_material_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_sample_approval(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_sample_approval(uuid, text) TO authenticated;
