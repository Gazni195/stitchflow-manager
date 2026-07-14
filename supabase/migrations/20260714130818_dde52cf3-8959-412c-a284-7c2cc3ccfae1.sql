DROP POLICY IF EXISTS "materials write all authenticated" ON public.materials;
DROP POLICY IF EXISTS "materials insert authenticated" ON public.materials;
DROP POLICY IF EXISTS "materials update authenticated" ON public.materials;
DROP POLICY IF EXISTS "materials delete authenticated" ON public.materials;

CREATE POLICY "materials insert authenticated"
  ON public.materials FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "materials update authenticated"
  ON public.materials FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "materials delete authenticated"
  ON public.materials FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);