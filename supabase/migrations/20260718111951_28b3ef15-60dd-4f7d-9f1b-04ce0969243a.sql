DO $$
DECLARE
  con text;
BEGIN
  SELECT conname INTO con
    FROM pg_constraint
    WHERE conrelid = 'public.designs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%IN%';
  IF con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.designs DROP CONSTRAINT %I', con);
  END IF;
END $$;

ALTER TABLE public.designs
  ADD CONSTRAINT designs_status_check
  CHECK (status IN ('draft','sampling','sample_approved','in_production','completed','design_rejected'));