-- ============================================================================
-- Dynamic Role & Permission Management System
--
-- Replaces the fixed `app_role` enum with a real `roles` table (so Create /
-- Edit / Clone / Delete Role are data operations, never a schema migration),
-- and extends the flat `permissions` catalog into a self-describing tree
-- (Module -> Page -> Section -> Tab -> Card -> Popup -> Feature -> Button ->
-- Backend Action) so the Admin -> Roles & Permissions screen can render an
-- arbitrarily deep tree straight from the database instead of a hardcoded
-- View/Create/Edit/Delete grid.
--
-- Every existing permission key, every existing role assignment, and every
-- existing RLS policy that calls has_role()/has_permission() keeps working
-- unchanged -- this migration is additive and forward-migrates existing
-- grants rather than dropping anything destructively. The old `role` enum
-- columns on user_roles/role_permissions are left in place (unused going
-- forward) rather than dropped, purely as a safety margin.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Roles as data
-- ----------------------------------------------------------------------------
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  grants_all boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER roles_set_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed the 9 existing enum values as rows, preserving today's effective
-- access exactly: super_admin becomes the one role with the generic
-- "grants_all" bypass (replacing the old `role = 'super_admin'` string
-- check that used to live inside has_permission()); all 9 are marked
-- is_system so they can't be deleted from the UI by accident, since real
-- users are already assigned to them.
INSERT INTO public.roles (key, label, description, grants_all, is_system) VALUES
  ('super_admin', 'Super Admin', 'Full access to everything, including role & permission management.', true, true),
  ('admin', 'Admin', 'Manages day-to-day operations across every module.', false, true),
  ('designer', 'Designer', 'Owns designs and sample development.', false, true),
  ('marketing', 'Marketing', 'Read-only access to designs and reports.', false, true),
  ('production_manager', 'Production Manager', 'Runs production floor, lines and approvals.', false, true),
  ('accountant', 'Accountant', 'Views costs, inventory and production reports.', false, true),
  ('inventory_manager', 'Inventory Manager', 'Manages inventory and materials.', false, true),
  ('operator', 'Operator / Worker', 'Executes assigned production operations.', false, true),
  ('it_developer', 'IT & Developer', 'System configuration, users and settings.', false, true);

-- Deleting a role that's still assigned to a user, or one of the seeded
-- system roles, is never allowed from the UI -- this is a generic guard on
-- any row's flags/usage, not a check against a specific role's name.
CREATE OR REPLACE FUNCTION public.prevent_unsafe_role_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.is_system THEN
    RAISE EXCEPTION 'This role is a system role and cannot be deleted.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role_id = OLD.id) THEN
    RAISE EXCEPTION 'This role still has users assigned to it. Reassign or remove those users first.';
  END IF;
  RETURN OLD;
END; $$;

-- ----------------------------------------------------------------------------
-- 2. user_roles: point at roles.id instead of the app_role enum
--
-- `role` is not part of user_roles' primary key (it already has a real `id`
-- PK plus a separate UNIQUE(user_id, role)), so it can be safely relaxed to
-- nullable and left in place rather than dropped -- new rows going forward
-- only ever populate role_id.
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_roles ADD COLUMN role_id uuid REFERENCES public.roles(id) ON DELETE RESTRICT;

UPDATE public.user_roles ur
SET role_id = r.id
FROM public.roles r
WHERE r.key = ur.role::text;

ALTER TABLE public.user_roles ALTER COLUMN role_id SET NOT NULL;
ALTER TABLE public.user_roles ALTER COLUMN role DROP NOT NULL;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_role_id_unique UNIQUE (user_id, role_id);

CREATE TRIGGER user_roles_prevent_unsafe_role_delete
  BEFORE DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_unsafe_role_delete();

-- ----------------------------------------------------------------------------
-- 3. role_permissions: point at roles.id instead of the app_role enum
--
-- Unlike user_roles, `role` here IS part of the original composite primary
-- key (role, permission_id) -- a PK column can never be nullable, so it has
-- to be replaced rather than relaxed. A real `id` column becomes the new
-- primary key; the old composite PK is dropped (the column itself stays,
-- now just an ordinary nullable column) and the new UNIQUE(role_id,
-- permission_id) constraint takes over its integrity role going forward.
-- ----------------------------------------------------------------------------
ALTER TABLE public.role_permissions ADD COLUMN id uuid DEFAULT gen_random_uuid();
UPDATE public.role_permissions SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.role_permissions ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.role_permissions DROP CONSTRAINT role_permissions_pkey;
ALTER TABLE public.role_permissions ADD PRIMARY KEY (id);

ALTER TABLE public.role_permissions ADD COLUMN role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE;

UPDATE public.role_permissions rp
SET role_id = r.id
FROM public.roles r
WHERE r.key = rp.role::text;

ALTER TABLE public.role_permissions ALTER COLUMN role_id SET NOT NULL;
ALTER TABLE public.role_permissions ALTER COLUMN role DROP NOT NULL;
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_id_permission_id_unique UNIQUE (role_id, permission_id);

-- ----------------------------------------------------------------------------
-- 4. permissions: extend the flat catalog into a self-describing tree
-- ----------------------------------------------------------------------------
ALTER TABLE public.permissions
  ADD COLUMN parent_id uuid REFERENCES public.permissions(id) ON DELETE CASCADE,
  ADD COLUMN node_type text NOT NULL DEFAULT 'FEATURE'
    CHECK (node_type IN ('MODULE','PAGE','SECTION','TAB','CARD','POPUP','FEATURE','BUTTON','BACKEND_ACTION')),
  ADD COLUMN page text,
  ADD COLUMN section text,
  ADD COLUMN tab text,
  ADD COLUMN card text,
  ADD COLUMN popup text,
  ADD COLUMN feature text,
  ADD COLUMN button text,
  ADD COLUMN display_order integer NOT NULL DEFAULT 0,
  ADD COLUMN category text,
  ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN requires_backend boolean NOT NULL DEFAULT true,
  ADD COLUMN linked_backend_ref text;

-- Backfill the existing 44 rows: they're all leaf, mutation-shaped nodes
-- today (module.action), so they become FEATURE nodes with `category` set
-- to the action they already represent.
UPDATE public.permissions
SET node_type = 'FEATURE',
    category = action,
    feature = label,
    display_order = sub.rn
FROM (
  SELECT id, row_number() OVER (ORDER BY module, action) AS rn
  FROM public.permissions
) sub
WHERE public.permissions.id = sub.id;

-- One MODULE row per distinct module already referenced by the existing
-- catalog -- this is what lets every existing permission become a proper
-- tree leaf without losing or renaming a single one of them. `row_number()`
-- is computed over the already-deduplicated module list in the subquery
-- (computing it directly alongside `SELECT DISTINCT` would silently defeat
-- the dedup, since the window function would make every underlying row's
-- full tuple unique again).
INSERT INTO public.permissions (key, module, action, label, description, node_type, display_order, category, is_active, requires_backend)
SELECT m.module, m.module, 'view', initcap(m.module), 'View the ' || m.module || ' module.', 'MODULE',
       (row_number() OVER (ORDER BY m.module))::int, 'view', true, false
FROM (SELECT DISTINCT module FROM public.permissions WHERE node_type = 'FEATURE') m;

UPDATE public.permissions child
SET parent_id = mod.id
FROM public.permissions mod
WHERE mod.node_type = 'MODULE'
  AND mod.key = child.module
  AND child.node_type = 'FEATURE';

-- ----------------------------------------------------------------------------
-- 5. Sample Development: a real, fully-populated deep example
--
-- Demonstrates every level of the hierarchy end to end (Module -> Page ->
-- Tab -> Card -> Feature -> Button -> Backend Action) against the module the
-- architecture review used as its own worked example. Every other module
-- keeps its existing flat Module -> Feature shape today; deepening any of
-- them later is the same pattern as this section, purely a data insert.
-- ----------------------------------------------------------------------------
WITH
mod AS (SELECT id FROM public.permissions WHERE key = 'samples' AND node_type = 'MODULE'),
page AS (
  INSERT INTO public.permissions (key, parent_id, node_type, module, page, label, description, display_order, category, is_active, requires_backend)
  SELECT 'samples.detail', mod.id, 'PAGE', 'samples', 'Sample Development Detail', 'Sample Development Detail', 'View the per-design Sample Development detail page.', 1, 'view', true, false
  FROM mod
  RETURNING id
),
tab_making AS (
  INSERT INTO public.permissions (key, parent_id, node_type, module, page, tab, label, description, display_order, category, is_active, requires_backend)
  SELECT 'samples.tab.making', page.id, 'TAB', 'samples', 'Sample Development Detail', 'Sample Making', 'Sample Making tab', 'View the Sample Making tab.', 1, 'view', true, false
  FROM page
  RETURNING id
),
tab_materials AS (
  INSERT INTO public.permissions (key, parent_id, node_type, module, page, tab, label, description, display_order, category, is_active, requires_backend)
  SELECT 'samples.tab.materials', page.id, 'TAB', 'samples', 'Sample Development Detail', 'Raw Materials', 'Raw Materials tab', 'View the Raw Materials tab.', 2, 'view', true, false
  FROM page
  RETURNING id
),
tab_costing AS (
  INSERT INTO public.permissions (key, parent_id, node_type, module, page, tab, label, description, display_order, category, is_active, requires_backend)
  SELECT 'samples.tab.costing', page.id, 'TAB', 'samples', 'Sample Development Detail', 'Costing', 'Costing tab', 'View the Costing tab.', 3, 'view', true, false
  FROM page
  RETURNING id
),
tab_approval AS (
  INSERT INTO public.permissions (key, parent_id, node_type, module, page, tab, label, description, display_order, category, is_active, requires_backend)
  SELECT 'samples.tab.approval', page.id, 'TAB', 'samples', 'Sample Development Detail', 'Approval', 'Approval tab', 'View the Approval tab.', 4, 'view', true, false
  FROM page
  RETURNING id
),
card_running AS (
  INSERT INTO public.permissions (key, parent_id, node_type, module, page, tab, card, label, description, display_order, category, is_active, requires_backend)
  SELECT 'samples.card.running_operations', tab_making.id, 'CARD', 'samples', 'Sample Development Detail', 'Sample Making', 'Running Operations', 'Running Operations card', 'View the Running Operations card.', 1, 'view', true, false
  FROM tab_making
  RETURNING id
),
card_timeline AS (
  INSERT INTO public.permissions (key, parent_id, node_type, module, page, tab, card, label, description, display_order, category, is_active, requires_backend)
  SELECT 'samples.card.timeline', tab_making.id, 'CARD', 'samples', 'Sample Development Detail', 'Sample Making', 'Workflow Timeline', 'Workflow Timeline card', 'View the Workflow Timeline card.', 2, 'view', true, false
  FROM tab_making
  RETURNING id
),
popup_material_usage AS (
  INSERT INTO public.permissions (key, parent_id, node_type, module, page, tab, popup, label, description, display_order, category, is_active, requires_backend)
  SELECT 'samples.popup.material_usage', tab_making.id, 'POPUP', 'samples', 'Sample Development Detail', 'Sample Making', 'Material Usage Dialog', 'Material Usage Dialog', 'Open the Material Usage dialog.', 3, 'view', true, false
  FROM tab_making
  RETURNING id
),
feature_start AS (
  INSERT INTO public.permissions (key, parent_id, node_type, module, page, tab, card, feature, label, description, display_order, category, is_active, requires_backend, linked_backend_ref)
  SELECT 'samples.operation.start', card_running.id, 'FEATURE', 'samples', 'Sample Development Detail', 'Sample Making', 'Running Operations', 'Start Operation', 'Start Operation', 'Start a new Sample Making operation.', 1, 'start', true, true, 'workflow_steps insert'
  FROM card_running
  RETURNING id
),
button_start AS (
  INSERT INTO public.permissions (key, parent_id, node_type, module, page, tab, card, feature, button, label, description, display_order, category, is_active, requires_backend, linked_backend_ref)
  SELECT 'samples.operation.start.button', feature_start.id, 'BUTTON', 'samples', 'Sample Development Detail', 'Sample Making', 'Running Operations', 'Start Operation', '+ Start Operation', '+ Start Operation button', 'The button that opens the Start Operation flow.', 1, 'start', true, true, 'workflow_steps insert'
  FROM feature_start
  RETURNING id
)
INSERT INTO public.permissions (key, parent_id, node_type, module, page, tab, card, feature, button, label, description, display_order, category, is_active, requires_backend, linked_backend_ref)
SELECT 'samples.operation.start.action', button_start.id, 'BACKEND_ACTION', 'samples', 'Sample Development Detail', 'Sample Making', 'Running Operations', 'Start Operation', '+ Start Operation', 'Insert workflow_steps row', 'The RLS-enforced write this button ultimately performs.', 1, 'start', true, true, 'workflow_steps insert (RLS)'
FROM button_start;

INSERT INTO public.permissions (key, parent_id, node_type, module, page, tab, card, feature, label, description, display_order, category, is_active, requires_backend, linked_backend_ref)
SELECT v.key, c.id, 'FEATURE', 'samples', 'Sample Development Detail', 'Sample Making', 'Running Operations', v.label, v.label, v.label, v.display_order, v.category, true, true, v.ref
FROM public.permissions c,
LATERAL (VALUES
  ('samples.operation.pause', 'Pause Operation', 2, 'pause', 'workflow_steps update'),
  ('samples.operation.resume', 'Resume Operation', 3, 'resume', 'workflow_steps update'),
  ('samples.operation.complete', 'Complete Operation', 4, 'complete', 'workflow_steps update'),
  ('samples.operation.cancel', 'Cancel Operation', 5, 'cancel', 'workflow_steps delete')
) AS v(key, label, display_order, category, ref)
WHERE c.key = 'samples.card.running_operations';

INSERT INTO public.permissions (key, parent_id, node_type, module, page, tab, card, feature, label, description, display_order, category, is_active, requires_backend, linked_backend_ref)
SELECT v.key, c.id, 'FEATURE', 'samples', 'Sample Development Detail', 'Sample Making', 'Workflow Timeline', v.label, v.label, v.label, v.display_order, v.category, true, true, v.ref
FROM public.permissions c,
LATERAL (VALUES
  ('samples.timeline.edit', 'Edit Timeline Entry', 1, 'edit', 'workflow_steps update'),
  ('samples.timeline.reopen', 'Reopen Step', 2, 'edit', 'workflow_steps update'),
  ('samples.timeline.delete', 'Soft-Delete Timeline Entry', 3, 'delete', 'workflow_steps update (status=deleted)')
) AS v(key, label, display_order, category, ref)
WHERE c.key = 'samples.card.timeline';

INSERT INTO public.permissions (key, parent_id, node_type, module, page, tab, popup, feature, label, description, display_order, category, is_active, requires_backend, linked_backend_ref)
SELECT 'samples.material_usage.confirm', c.id, 'FEATURE', 'samples', 'Sample Development Detail', 'Sample Making', 'Material Usage Dialog', 'Edit Material Usage', 'Edit Material Usage', 'Confirm/edit material usage for this design.', 1, 'edit', true, true, 'design_materials replace'
FROM public.permissions c WHERE c.key = 'samples.popup.material_usage';

INSERT INTO public.permissions (key, parent_id, node_type, module, page, tab, feature, label, description, display_order, category, is_active, requires_backend, linked_backend_ref)
SELECT v.key, t.id, 'FEATURE', 'samples', 'Sample Development Detail', 'Raw Materials', v.label, v.label, v.label, v.display_order, v.category, true, true, v.ref
FROM public.permissions t,
LATERAL (VALUES
  ('samples.material.add', 'Add Material Selection', 1, 'create', 'design_materials insert'),
  ('samples.material.edit', 'Edit Material Selection', 2, 'edit', 'design_materials update'),
  ('samples.material.delete', 'Delete Material Selection', 3, 'delete', 'design_materials delete')
) AS v(key, label, display_order, category, ref)
WHERE t.key = 'samples.tab.materials';

INSERT INTO public.permissions (key, parent_id, node_type, module, page, tab, feature, label, description, display_order, category, is_active, requires_backend, linked_backend_ref)
SELECT 'samples.costing.edit', t.id, 'FEATURE', 'samples', 'Sample Development Detail', 'Costing', 'Edit Overhead Cost', 'Edit Overhead Cost', 'Edit the Costing tab overhead line items.', 1, 'edit', true, false, NULL
FROM public.permissions t WHERE t.key = 'samples.tab.costing';

INSERT INTO public.permissions (key, parent_id, node_type, module, page, tab, feature, label, description, display_order, category, is_active, requires_backend, linked_backend_ref)
SELECT v.key, t.id, 'FEATURE', 'samples', 'Sample Development Detail', 'Approval', v.label, v.label, v.label, v.display_order, v.category, true, true, v.ref
FROM public.permissions t,
LATERAL (VALUES
  ('samples.approval.approve', 'Record Approval', 1, 'approve', 'sample_approvals insert'),
  ('samples.approval.withdraw', 'Withdraw Approval', 2, 'approve', 'withdraw_sample_approval RPC')
) AS v(key, label, display_order, category, ref)
WHERE t.key = 'samples.tab.approval';

-- ----------------------------------------------------------------------------
-- 6. Forward-migrate existing grants onto the new Sample Development tree
--
-- Nobody's effective access changes because of this migration. Roles that
-- held the old flat `samples.edit` (full access) are granted the entire new
-- tree; roles that held only `samples.view` are granted just the
-- visibility-level nodes (Module/Page/Tab/Card/Popup), matching what
-- "view only" already meant for them under the old flat scheme. The old
-- `samples.view/create/edit/delete` rows and their existing role grants are
-- left completely untouched.
-- ----------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM public.role_permissions rp
JOIN public.permissions old_p ON old_p.id = rp.permission_id AND old_p.key = 'samples.edit'
JOIN public.permissions p ON (p.key = 'samples' OR p.key LIKE 'samples.%')
  AND p.key NOT IN ('samples.view','samples.create','samples.edit','samples.delete')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM public.role_permissions rp
JOIN public.permissions old_p ON old_p.id = rp.permission_id AND old_p.key = 'samples.view'
JOIN public.permissions p ON (p.key = 'samples' OR p.key LIKE 'samples.%')
  AND p.node_type IN ('MODULE','PAGE','TAB','CARD','POPUP')
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp2
  JOIN public.permissions old_p2 ON old_p2.id = rp2.permission_id AND old_p2.key = 'samples.edit'
  WHERE rp2.role_id = rp.role_id
)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 7. has_role / has_permission: generic, name-free checks
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

CREATE FUNCTION public.has_role(_user_id uuid, _role_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.key = _role_key AND r.is_active
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- A role with grants_all bypasses the catalog entirely -- this is the one
  -- generic mechanism that replaces the old `role = 'super_admin'` literal
  -- check. Any role can carry this flag; nothing here references a name.
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.is_active AND r.grants_all
  )
  OR EXISTS(
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id AND r.is_active
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id AND p.key = _permission_key AND p.is_active
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_permissions()
RETURNS TABLE(key text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT p.key
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id AND r.is_active
  JOIN public.role_permissions rp ON rp.role_id = r.id
  JOIN public.permissions p ON p.id = rp.permission_id AND p.is_active
  WHERE ur.user_id = auth.uid()
  UNION
  SELECT p.key FROM public.permissions p
  WHERE p.is_active AND EXISTS(
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.is_active AND r.grants_all
  );
$$;
GRANT EXECUTE ON FUNCTION public.current_user_permissions() TO authenticated;

DROP FUNCTION IF EXISTS public.list_users_with_roles();

CREATE FUNCTION public.list_users_with_roles()
RETURNS TABLE(user_id uuid, email text, roles jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.email::text,
    COALESCE(
      jsonb_agg(jsonb_build_object('id', r.id, 'key', r.key, 'label', r.label) ORDER BY r.label)
        FILTER (WHERE r.id IS NOT NULL),
      '[]'::jsonb
    )
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN public.roles r ON r.id = ur.role_id AND r.is_active
  WHERE public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')
  GROUP BY u.id, u.email;
$$;
GRANT EXECUTE ON FUNCTION public.list_users_with_roles() TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_super_admin_seed()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text; _role_id uuid;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  IF _email = 'fawrilifestyle@gmail.com' THEN
    SELECT id INTO _role_id FROM public.roles WHERE key = 'super_admin';
    IF _role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id) VALUES (auth.uid(), _role_id)
        ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.ensure_super_admin_seed() TO authenticated;

-- Clone Role: copies every permission grant from an existing role onto a
-- brand-new one in a single call. Plain SECURITY INVOKER -- it relies on the
-- same roles.edit-gated RLS below that a manual "create role, then re-check
-- every box" flow would already need, so no elevated privilege is required.
CREATE OR REPLACE FUNCTION public.clone_role(_source_role_id uuid, _new_key text, _new_label text, _new_description text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE _new_role_id uuid;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'roles.edit') THEN
    RAISE EXCEPTION 'You do not have permission to create roles.';
  END IF;

  INSERT INTO public.roles (key, label, description, grants_all, is_system)
  VALUES (_new_key, _new_label, _new_description, false, false)
  RETURNING id INTO _new_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT _new_role_id, permission_id FROM public.role_permissions WHERE role_id = _source_role_id;

  RETURN _new_role_id;
END; $$;
REVOKE ALL ON FUNCTION public.clone_role(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clone_role(uuid, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. RLS: roles, permissions, role_permissions all gated by has_permission(),
--    not by a literal role name -- so any role holding roles.edit (not just
--    super_admin) can manage the catalog from the Admin UI, per the brief.
-- ----------------------------------------------------------------------------
CREATE POLICY "roles read" ON public.roles FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'roles.view'));
CREATE POLICY "roles write" ON public.roles FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'roles.edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'roles.edit'));

DROP POLICY IF EXISTS "admins read permissions" ON public.permissions;
DROP POLICY IF EXISTS "super admin manages permissions" ON public.permissions;
CREATE POLICY "permissions read" ON public.permissions FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'roles.view'));
CREATE POLICY "permissions write" ON public.permissions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'roles.edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'roles.edit'));

DROP POLICY IF EXISTS "admins read role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "super admin manages role_permissions" ON public.role_permissions;
CREATE POLICY "role_permissions read" ON public.role_permissions FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'roles.view'));
CREATE POLICY "role_permissions write" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'roles.edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'roles.edit'));

-- user_roles keeps its existing "read own roles or admin" policy (still
-- valid -- it never referenced the `role` column directly), but write access
-- should also follow users.edit now, not a hardcoded super_admin check.
DROP POLICY IF EXISTS "super admin manages user_roles" ON public.user_roles;
CREATE POLICY "user_roles write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'users.edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'users.edit'));
