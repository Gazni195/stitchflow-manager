-- Move fabric from the design onto each part in the parts JSONB, then drop the column.
UPDATE public.designs
SET parts = COALESCE(
  (
    SELECT jsonb_agg(
      CASE
        WHEN jsonb_typeof(elem) = 'object'
          THEN elem || jsonb_build_object('fabric', COALESCE(elem->>'fabric', designs.fabric, ''))
        ELSE elem
      END
    )
    FROM jsonb_array_elements(parts) AS elem
  ),
  '[]'::jsonb
)
WHERE jsonb_typeof(parts) = 'array' AND jsonb_array_length(parts) > 0;

ALTER TABLE public.designs DROP COLUMN IF EXISTS fabric;