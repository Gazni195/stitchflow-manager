# Shared Workspace Migration Plan

## Goal
Every authenticated user sees the same business data (designs, samples, production, materials, workflows, approvals, images, activities, reservations). Ownership columns (`created_by`, `updated_by`, timestamps) stay for audit only. UI-level RBAC (`useCan`, `<Can>`) is unchanged.

## Scope of Change
All changes are database-only (one migration). No frontend code, no RBAC schema, no route changes.

## Audit — Owner-Based Surfaces Found

**Helper functions (currently filter by `auth.uid() = created_by`):**
- `public.has_design_access(_design_id)`
- `public.has_workflow_access(_workflow_id)`
- `public.has_production_order_access(_po_id)`

**RLS policies restricting visibility by creator:**
| Table | Policies to replace |
|---|---|
| `designs` | `designs owner select/insert/update/delete` |
| `design_images` | `Owners can view/insert/update/delete design images` |
| `design_materials` | `design_materials owner all` |
| `design_workflows` | `design_workflows owner all` |
| `workflow_steps` | `workflow_steps owner all` |
| `sample_approvals` | `Owners view/insert sample approvals` |
| `production_orders` | `own production orders` |
| `production_processes` | `own production processes` |
| `production_activities` | `own production activities`, `Owners can view/insert/update/delete activities` |
| `production_reservations` | `reservations select/insert/update/delete own` |

**Left as-is (already correct):**
- `materials` — role-based reads/writes.
- `operations_catalog`, `permissions`, `role_permissions`, `user_roles` — RBAC tables.
- RPCs (`start_production`, `issue_bundle`, `complete_process`, `approve_sample`, `start_bulk_production`) — their internal `has_*_access` guards become "is authenticated" automatically once the helpers are rewritten. No signature changes.

## Migration (single file)

1. **Rewrite helper functions** to gate on authentication only:
   - `has_design_access(_design_id)` → returns `auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM designs WHERE id = _design_id)`
   - `has_workflow_access(_workflow_id)` → same shape against `design_workflows`
   - `has_production_order_access(_po_id)` → same shape against `production_orders`

   (Keep signatures/return types so existing RPCs and policies referencing them keep working.)

2. **Drop and recreate policies** on each table listed above with a single permissive rule per command:
   - `USING (auth.uid() IS NOT NULL)` for SELECT/UPDATE/DELETE
   - `WITH CHECK (auth.uid() IS NOT NULL)` for INSERT/UPDATE

   This gives every signed-in user full read + write visibility across the shared workspace, matching the stated requirement. Action-level restrictions remain enforced client-side via the existing RBAC (`useCan` / `<Can>`).

3. **Audit columns unchanged.** `created_by`, `updated_by`, `created_at`, `updated_at` stay on all tables and continue to be populated by existing insert/update code paths.

## Out of Scope
- No changes to `src/**` code.
- No changes to RBAC tables, permissions, or role assignments.
- No changes to storage bucket policies (they already use role checks).
- No data backfill needed.

## Risk / Notes
- After migration, any authenticated user can INSERT/UPDATE/DELETE business rows at the DB layer. The stated requirement accepts this because action gating is handled by RBAC in the UI. If you want DB-level write gating too (e.g. only `designs.edit` permission can update `designs`), say so and I'll add `public.has_permission(auth.uid(), '<key>')` checks into the `WITH CHECK` clauses instead of the flat authenticated check — this is a natural extension but changes the scope.
- Existing RPCs remain callable by any authenticated user (their guards degrade to "is authenticated") — matches the shared-workspace goal.

## Approval
Reply "approve" and I'll issue the single migration. No code will be committed or pushed.
