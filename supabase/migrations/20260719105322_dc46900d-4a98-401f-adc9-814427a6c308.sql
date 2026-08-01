
-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'super_admin','admin','designer','marketing','production_manager',
    'accountant','inventory_manager','operator','it_developer'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. permissions catalog
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  module text NOT NULL,
  action text NOT NULL,
  label text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- 4. role_permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.app_role NOT NULL,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(role, permission_id)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 5. Security definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
  OR EXISTS(
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id AND p.key = _permission_key
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_permissions()
RETURNS TABLE(key text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT p.key
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role = ur.role
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = auth.uid()
  UNION
  SELECT p.key FROM public.permissions p
  WHERE EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin');
$$;
GRANT EXECUTE ON FUNCTION public.current_user_permissions() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_users_with_roles()
RETURNS TABLE(user_id uuid, email text, roles public.app_role[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.email::text, COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}'::public.app_role[])
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  WHERE public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')
  GROUP BY u.id, u.email;
$$;
GRANT EXECUTE ON FUNCTION public.list_users_with_roles() TO authenticated;

-- Self-service seed: promotes the configured super admin email on first sign-in.
CREATE OR REPLACE FUNCTION public.ensure_super_admin_seed()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  IF _email = 'fawrilifestyle@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'super_admin')
    ON CONFLICT DO NOTHING;
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.ensure_super_admin_seed() TO authenticated;

-- 6. RLS policies
DROP POLICY IF EXISTS "read own roles or admin" ON public.user_roles;
CREATE POLICY "read own roles or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "super admin manages user_roles" ON public.user_roles;
CREATE POLICY "super admin manages user_roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "authed read permissions" ON public.permissions;
CREATE POLICY "authed read permissions" ON public.permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "super admin manages permissions" ON public.permissions;
CREATE POLICY "super admin manages permissions" ON public.permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "authed read role_permissions" ON public.role_permissions;
CREATE POLICY "authed read role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "super admin manages role_permissions" ON public.role_permissions;
CREATE POLICY "super admin manages role_permissions" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 7. Seed permission catalog (module x action)
INSERT INTO public.permissions (key, module, action, label)
SELECT m || '.' || a, m, a, initcap(a) || ' ' || initcap(m)
FROM (VALUES ('designs'),('samples'),('production'),('materials'),('inventory'),('approvals'),('lines'),('reports'),('users'),('roles'),('settings')) AS mods(m)
CROSS JOIN (VALUES ('view'),('create'),('edit'),('delete')) AS acts(a)
ON CONFLICT (key) DO NOTHING;

-- 8. Seed default role -> permission assignments
-- Super Admin: everything
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'super_admin'::public.app_role, id FROM public.permissions
ON CONFLICT DO NOTHING;

-- Admin: everything except role/settings deletes
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::public.app_role, id FROM public.permissions
WHERE key NOT IN ('roles.delete','settings.delete')
ON CONFLICT DO NOTHING;

-- Designer
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'designer'::public.app_role, id FROM public.permissions
WHERE key IN ('designs.view','designs.create','designs.edit','designs.delete',
              'samples.view','samples.create','samples.edit',
              'materials.view','approvals.view')
ON CONFLICT DO NOTHING;

-- Marketing
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'marketing'::public.app_role, id FROM public.permissions
WHERE key IN ('designs.view','reports.view')
ON CONFLICT DO NOTHING;

-- Production Manager
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'production_manager'::public.app_role, id FROM public.permissions
WHERE key IN ('production.view','production.create','production.edit','production.delete',
              'lines.view','lines.create','lines.edit',
              'materials.view','inventory.view',
              'approvals.view','approvals.create','approvals.edit',
              'samples.view','designs.view')
ON CONFLICT DO NOTHING;

-- Accountant
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'accountant'::public.app_role, id FROM public.permissions
WHERE key IN ('reports.view','materials.view','inventory.view','designs.view','production.view')
ON CONFLICT DO NOTHING;

-- Inventory Manager
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'inventory_manager'::public.app_role, id FROM public.permissions
WHERE key IN ('inventory.view','inventory.create','inventory.edit','inventory.delete',
              'materials.view','materials.create','materials.edit','materials.delete',
              'designs.view')
ON CONFLICT DO NOTHING;

-- Operator / Worker
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'operator'::public.app_role, id FROM public.permissions
WHERE key IN ('production.view','production.edit','samples.view','lines.view')
ON CONFLICT DO NOTHING;

-- IT & Developer
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'it_developer'::public.app_role, id FROM public.permissions
WHERE key IN ('users.view','users.edit','roles.view','settings.view','settings.edit',
              'designs.view','production.view','samples.view','inventory.view',
              'materials.view','lines.view','reports.view','approvals.view')
ON CONFLICT DO NOTHING;
