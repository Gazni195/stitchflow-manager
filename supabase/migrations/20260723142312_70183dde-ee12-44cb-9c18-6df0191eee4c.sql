
CREATE TABLE public.workstation_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key text NOT NULL UNIQUE,
  label text NOT NULL,
  prefix text NOT NULL,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0 AND count <= 200),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workstation_config TO authenticated;
GRANT ALL ON public.workstation_config TO service_role;

ALTER TABLE public.workstation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workstation_config read" ON public.workstation_config
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'settings.view') OR public.has_permission(auth.uid(), 'settings.edit'));

CREATE POLICY "workstation_config insert" ON public.workstation_config
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'settings.edit'));

CREATE POLICY "workstation_config update" ON public.workstation_config
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'settings.edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'settings.edit'));

CREATE POLICY "workstation_config delete" ON public.workstation_config
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'settings.edit'));

CREATE TRIGGER workstation_config_set_updated_at
  BEFORE UPDATE ON public.workstation_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.workstation_config (type_key, label, prefix, count, sort_order) VALUES
  ('cutting',    'Cutting',    'C', 1,  1),
  ('tailoring',  'Tailoring',  'T', 10, 2),
  ('handwork',   'Hand Work',  'H', 10, 3),
  ('embroidery', 'Embroidery', 'E', 5,  4);
