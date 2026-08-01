DROP POLICY IF EXISTS "operations_catalog insertable by authenticated" ON public.operations_catalog;
CREATE POLICY "operations_catalog insertable by authenticated" ON public.operations_catalog FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
GRANT SELECT, INSERT ON public.operations_catalog TO authenticated;