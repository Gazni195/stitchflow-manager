import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildSyncPlan,
  flattenRegistry,
  type ExistingPermissionRow,
  type SyncPlan,
  type SyncResult,
} from "./permission-sync";

/**
 * Server side of the metadata-driven permission system.
 *
 *  - `previewPermissionSync` : read-only diff (what a sync *would* do)
 *  - `syncPermissions`       : applies the diff (insert missing, update drifted)
 *
 * Both require an authenticated caller holding `roles.edit`. Rows are matched
 * by `key`, so a sync is idempotent and can never duplicate a permission.
 * Rows that the registry no longer declares are reported, never deleted.
 */

const SELECT_COLUMNS =
  "id, key, parent_id, node_type, module, page, section, tab, card, popup, feature, button, label, description, display_order, category, requires_backend, linked_backend_ref, is_active";

async function assertCanManageRoles(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_permission", {
    _user_id: userId,
    _permission_key: "roles.edit",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: roles.edit permission required");
}

async function loadExisting(client: any): Promise<ExistingPermissionRow[]> {
  const { data, error } = await client.from("permissions").select(SELECT_COLUMNS);
  if (error) throw new Error(error.message);
  return (data ?? []) as ExistingPermissionRow[];
}

export const previewPermissionSync = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SyncPlan> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertCanManageRoles(supabase, userId);
    const existing = await loadExisting(supabase);
    return buildSyncPlan(flattenRegistry(), existing);
  });

export const syncPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SyncResult> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertCanManageRoles(supabase, userId);

    // Writing the catalog is a privileged, schema-level operation, so it runs
    // with the admin client *after* the caller has been authorised above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const desired = flattenRegistry();
    const existing = await loadExisting(admin);
    const plan = buildSyncPlan(desired, existing);

    const idByKey = new Map(existing.map((row) => [row.key, row.id]));
    const inserted: string[] = [];

    // Insert shallowest nodes first so a child always finds its parent id.
    const missingByDepth = [...plan.missing].sort((a, b) => a.depth - b.depth);
    for (const node of missingByDepth) {
      const parentId = node.parentKey ? (idByKey.get(node.parentKey) ?? null) : null;
      const { data, error } = await admin
        .from("permissions")
        .insert({
          key: node.key,
          parent_id: parentId,
          node_type: node.nodeType,
          module: node.module,
          page: node.page,
          section: node.section,
          tab: node.tab,
          card: node.card,
          popup: node.popup,
          feature: node.feature,
          button: node.button,
          label: node.label,
          description: node.description,
          display_order: node.displayOrder,
          category: node.category,
          is_active: true,
          requires_backend: node.requiresBackend,
          linked_backend_ref: node.linkedBackendRef,
        })
        .select("id, key")
        .single();
      if (error) throw new Error(`Insert failed for "${node.key}": ${error.message}`);
      idByKey.set(data.key as string, data.id as string);
      inserted.push(node.key);
    }

    // Bring drifted rows back in line with the declaration (labels, ordering,
    // coordinates, parent link). Grants in role_permissions are untouched.
    const desiredByKey = new Map(desired.map((d) => [d.key, d]));
    const updated: string[] = [];
    for (const { key } of plan.drifted) {
      const node = desiredByKey.get(key)!;
      const { error } = await admin
        .from("permissions")
        .update({
          parent_id: node.parentKey ? (idByKey.get(node.parentKey) ?? null) : null,
          node_type: node.nodeType,
          module: node.module,
          page: node.page,
          section: node.section,
          tab: node.tab,
          card: node.card,
          popup: node.popup,
          feature: node.feature,
          button: node.button,
          label: node.label,
          description: node.description,
          display_order: node.displayOrder,
          category: node.category,
          is_active: true,
          requires_backend: node.requiresBackend,
          linked_backend_ref: node.linkedBackendRef,
        })
        .eq("key", key);
      if (error) throw new Error(`Update failed for "${key}": ${error.message}`);
      updated.push(key);
    }

    return { inserted, updated, unchanged: plan.unchanged, orphans: plan.orphans };
  });
