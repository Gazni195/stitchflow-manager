-- 1) Fabric image on material master
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS image_path text;

-- 2) New bundle fields
ALTER TABLE public.inventory_bundles ADD COLUMN IF NOT EXISTS layer_length numeric NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_bundles ADD COLUMN IF NOT EXISTS allocated_length numeric NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_bundles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'available';

-- carry forward existing consumption ledger
UPDATE public.inventory_bundles SET allocated_length = COALESCE(consumed_length, 0);

-- 3) Drop obsolete columns
ALTER TABLE public.inventory_bundles DROP COLUMN IF EXISTS remaining_length;
ALTER TABLE public.inventory_bundles DROP COLUMN IF EXISTS usable_length;
ALTER TABLE public.inventory_bundles DROP COLUMN IF EXISTS consumed_length;
ALTER TABLE public.inventory_bundles DROP COLUMN IF EXISTS roll_number;

ALTER TABLE public.inventory_bundles
  ADD CONSTRAINT inventory_bundles_status_chk CHECK (status IN ('available','reserved','consumed'));

-- 4) System-managed status: derived from allocation, never user-set
CREATE OR REPLACE FUNCTION public.set_bundle_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.allocated_length := LEAST(GREATEST(COALESCE(NEW.allocated_length,0), 0), COALESCE(NEW.purchased_length,0));
  IF NEW.allocated_length <= 0 THEN
    NEW.status := 'available';
  ELSIF NEW.allocated_length >= COALESCE(NEW.purchased_length,0) THEN
    NEW.status := 'consumed';
  ELSE
    NEW.status := 'reserved';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bundle_status ON public.inventory_bundles;
CREATE TRIGGER trg_bundle_status
  BEFORE INSERT OR UPDATE ON public.inventory_bundles
  FOR EACH ROW EXECUTE FUNCTION public.set_bundle_status();

-- 5) Stock recompute from purchased - allocated
CREATE OR REPLACE FUNCTION public.recompute_material_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE _mid uuid;
BEGIN
  _mid := COALESCE(NEW.material_id, OLD.material_id);
  UPDATE public.materials
     SET available_stock = COALESCE((
       SELECT SUM(purchased_length - allocated_length)
       FROM public.inventory_bundles WHERE material_id = _mid
     ), 0)
   WHERE id = _mid;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_recompute_material_stock ON public.inventory_bundles;
CREATE TRIGGER trg_recompute_material_stock
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_bundles
  FOR EACH ROW EXECUTE FUNCTION public.recompute_material_stock();

-- 6) Bundle numbering trigger (ensure present)
DROP TRIGGER IF EXISTS trg_assign_bundle_number ON public.inventory_bundles;
CREATE TRIGGER trg_assign_bundle_number
  BEFORE INSERT ON public.inventory_bundles
  FOR EACH ROW EXECUTE FUNCTION public.assign_bundle_number();

-- 7) Backfill existing material stock
UPDATE public.materials m
   SET available_stock = COALESCE((
     SELECT SUM(b.purchased_length - b.allocated_length)
     FROM public.inventory_bundles b WHERE b.material_id = m.id
   ), 0);