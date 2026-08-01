ALTER TABLE public.operations_catalog
  ADD COLUMN IF NOT EXISTS icon_url text,
  ADD COLUMN IF NOT EXISTS logo_url text;

CREATE POLICY "operation-icons public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'operation-icons');

CREATE POLICY "operation-icons authenticated insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'operation-icons');

CREATE POLICY "operation-icons authenticated update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'operation-icons');

CREATE POLICY "operation-icons authenticated delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'operation-icons');