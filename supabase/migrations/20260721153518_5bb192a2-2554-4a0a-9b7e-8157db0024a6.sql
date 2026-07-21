
-- Shared workspace: replace owner-based visibility with authenticated-user access.

-- 1) Helper functions: gate on authentication only, keep signature.
CREATE OR REPLACE FUNCTION public.has_design_access(_design_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.designs WHERE id = _design_id);
$$;

CREATE OR REPLACE FUNCTION public.has_workflow_access(_workflow_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.design_workflows WHERE id = _workflow_id);
$$;

CREATE OR REPLACE FUNCTION public.has_production_order_access(_po_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.production_orders WHERE id = _po_id);
$$;

-- 2) designs
DROP POLICY IF EXISTS "designs owner select" ON public.designs;
DROP POLICY IF EXISTS "designs owner insert" ON public.designs;
DROP POLICY IF EXISTS "designs owner update" ON public.designs;
DROP POLICY IF EXISTS "designs owner delete" ON public.designs;
CREATE POLICY "designs shared select" ON public.designs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "designs shared insert" ON public.designs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "designs shared update" ON public.designs FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "designs shared delete" ON public.designs FOR DELETE USING (auth.uid() IS NOT NULL);

-- 3) design_images
DROP POLICY IF EXISTS "Owners can view design images" ON public.design_images;
DROP POLICY IF EXISTS "Owners can insert design images" ON public.design_images;
DROP POLICY IF EXISTS "Owners can update design images" ON public.design_images;
DROP POLICY IF EXISTS "Owners can delete design images" ON public.design_images;
CREATE POLICY "design_images shared select" ON public.design_images FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "design_images shared insert" ON public.design_images FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "design_images shared update" ON public.design_images FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "design_images shared delete" ON public.design_images FOR DELETE USING (auth.uid() IS NOT NULL);

-- 4) design_materials
DROP POLICY IF EXISTS "design_materials owner all" ON public.design_materials;
CREATE POLICY "design_materials shared all" ON public.design_materials FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 5) design_workflows
DROP POLICY IF EXISTS "design_workflows owner all" ON public.design_workflows;
CREATE POLICY "design_workflows shared all" ON public.design_workflows FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 6) workflow_steps
DROP POLICY IF EXISTS "workflow_steps owner all" ON public.workflow_steps;
CREATE POLICY "workflow_steps shared all" ON public.workflow_steps FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 7) sample_approvals
DROP POLICY IF EXISTS "Owners view sample approvals" ON public.sample_approvals;
DROP POLICY IF EXISTS "Owners insert sample approvals" ON public.sample_approvals;
CREATE POLICY "sample_approvals shared select" ON public.sample_approvals FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "sample_approvals shared insert" ON public.sample_approvals FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 8) production_orders
DROP POLICY IF EXISTS "own production orders" ON public.production_orders;
CREATE POLICY "production_orders shared all" ON public.production_orders FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 9) production_processes
DROP POLICY IF EXISTS "own production processes" ON public.production_processes;
CREATE POLICY "production_processes shared all" ON public.production_processes FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 10) production_activities
DROP POLICY IF EXISTS "own production activities" ON public.production_activities;
DROP POLICY IF EXISTS "Owners can view activities" ON public.production_activities;
DROP POLICY IF EXISTS "Owners can insert activities" ON public.production_activities;
DROP POLICY IF EXISTS "Owners can update activities" ON public.production_activities;
DROP POLICY IF EXISTS "Owners can delete activities" ON public.production_activities;
CREATE POLICY "production_activities shared all" ON public.production_activities FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 11) production_reservations
DROP POLICY IF EXISTS "reservations select own" ON public.production_reservations;
DROP POLICY IF EXISTS "reservations insert own" ON public.production_reservations;
DROP POLICY IF EXISTS "reservations update own" ON public.production_reservations;
DROP POLICY IF EXISTS "reservations delete own" ON public.production_reservations;
CREATE POLICY "production_reservations shared select" ON public.production_reservations FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "production_reservations shared insert" ON public.production_reservations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "production_reservations shared update" ON public.production_reservations FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "production_reservations shared delete" ON public.production_reservations FOR DELETE USING (auth.uid() IS NOT NULL);
