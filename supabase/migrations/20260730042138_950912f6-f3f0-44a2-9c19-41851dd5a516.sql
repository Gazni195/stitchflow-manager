DROP POLICY IF EXISTS "operation-icons public read" ON storage.objects;

CREATE POLICY "operation-icons authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'operation-icons');