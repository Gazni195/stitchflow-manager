import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import type { NodeType, PermissionKey } from "./roles";

// Temporary casts until `roles` (new table) and the extended `permissions` /
// `role_permissions` / `user_roles` columns are picked up by Supabase's
// generated types -- same pattern already used in lib/api/design-images.ts
// for a table that landed ahead of a codegen run.
const rolesTable = () => (supabase as any).from("roles");
const permissionsTable = () => (supabase as any).from("permissions");
const rolePermissionsTable = () => (supabase as any).from("role_permissions");
const userRolesTable = () => (supabase as any).from("user_roles");
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as any).rpc(fn, args);

export interface MyRole {
  id: string;
  key: string;
}

/** Load the current user's roles (respects RLS: users can read their own). */
export function useMyRoles() {
  const { session } = useSession();
  const uid = session?.user?.id;
  return useQuery({
    queryKey: ["rbac", "my-roles", uid],
    enabled: !!uid,
    staleTime: 60_000,
    queryFn: async (): Promise<MyRole[]> => {
      const { data, error } = await userRolesTable()
        .select("role_id, roles(id, key)")
        .eq("user_id", uid!);
      if (error) throw error;
      return ((data ?? []) as { roles: { id: string; key: string } | null }[])
        .map((r) => r.roles)
        .filter((r): r is MyRole => !!r);
    },
  });
}

/** Load the current user's effective permission keys (union of role permissions). */
export function useMyPermissions() {
  const { session } = useSession();
  const uid = session?.user?.id;
  return useQuery({
    queryKey: ["rbac", "my-permissions", uid],
    enabled: !!uid,
    staleTime: 60_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await rpc("current_user_permissions");
      if (error) throw error;
      return new Set((data ?? []).map((r: { key: string }) => r.key));
    },
  });
}

export function useCan(permission: PermissionKey | PermissionKey[]) {
  const { data, isLoading } = useMyPermissions();
  const keys = Array.isArray(permission) ? permission : [permission];
  const allowed = !!data && keys.some((k) => data.has(k));
  return { allowed, isLoading };
}

export function useHasRole(roleKey: string) {
  const { data } = useMyRoles();
  return !!data?.some((r) => r.key === roleKey);
}

/** Self-service seed for the configured Super Admin email. Safe to call on every login. */
export function useEnsureSuperAdminSeed() {
  const { session } = useSession();
  const qc = useQueryClient();
  useEffect(() => {
    if (!session?.user?.id) return;
    rpc("ensure_super_admin_seed").then(() => {
      qc.invalidateQueries({ queryKey: ["rbac"] });
    });
  }, [session?.user?.id, qc]);
}

/* -------- Roles (dynamic, table-backed) -------- */

export interface RoleRow {
  id: string;
  key: string;
  label: string;
  description: string | null;
  grantsAll: boolean;
  isSystem: boolean;
  isActive: boolean;
  userCount: number;
  permissionCount: number;
}

/** Every role, plus how many users and how many permissions each currently has. */
export function useRoles() {
  return useQuery({
    queryKey: ["rbac", "roles"],
    staleTime: 30_000,
    queryFn: async (): Promise<RoleRow[]> => {
      const [rolesRes, userRolesRes, rolePermsRes] = await Promise.all([
        rolesTable().select("id, key, label, description, grants_all, is_system, is_active").order("label"),
        userRolesTable().select("role_id"),
        rolePermissionsTable().select("role_id"),
      ]);
      if (rolesRes.error) throw rolesRes.error;
      if (userRolesRes.error) throw userRolesRes.error;
      if (rolePermsRes.error) throw rolePermsRes.error;

      const userCounts = new Map<string, number>();
      for (const row of (userRolesRes.data ?? []) as { role_id: string }[]) {
        userCounts.set(row.role_id, (userCounts.get(row.role_id) ?? 0) + 1);
      }
      const permCounts = new Map<string, number>();
      for (const row of (rolePermsRes.data ?? []) as { role_id: string }[]) {
        permCounts.set(row.role_id, (permCounts.get(row.role_id) ?? 0) + 1);
      }

      return ((rolesRes.data ?? []) as any[]).map((r) => ({
        id: r.id as string,
        key: r.key as string,
        label: r.label as string,
        description: (r.description as string | null) ?? null,
        grantsAll: !!r.grants_all,
        isSystem: !!r.is_system,
        isActive: !!r.is_active,
        userCount: userCounts.get(r.id as string) ?? 0,
        permissionCount: permCounts.get(r.id as string) ?? 0,
      }));
    },
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { key: string; label: string; description: string }) => {
      const { data, error } = await rolesTable()
        .insert({ key: v.key, label: v.label, description: v.description || null })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rbac"] }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; label: string; description: string; isActive: boolean }) => {
      const { error } = await rolesTable()
        .update({ label: v.label, description: v.description || null, is_active: v.isActive })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rbac"] }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await rolesTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rbac"] }),
  });
}

export function useCloneRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { sourceRoleId: string; key: string; label: string; description: string }) => {
      const { data, error } = await rpc("clone_role", {
        _source_role_id: v.sourceRoleId,
        _new_key: v.key,
        _new_label: v.label,
        _new_description: v.description || null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rbac"] }),
  });
}

/* -------- Permission catalog (the tree) -------- */

export interface PermissionNode {
  id: string;
  key: string;
  parentId: string | null;
  nodeType: NodeType;
  module: string;
  page: string | null;
  section: string | null;
  tab: string | null;
  card: string | null;
  popup: string | null;
  feature: string | null;
  button: string | null;
  label: string;
  description: string | null;
  displayOrder: number;
  category: string | null;
  isActive: boolean;
  requiresBackend: boolean;
  linkedBackendRef: string | null;
}

/** The full permission catalog, flat -- callers build the tree from parentId. */
export function usePermissionTree() {
  return useQuery({
    queryKey: ["rbac", "permission-tree"],
    staleTime: 60_000,
    queryFn: async (): Promise<PermissionNode[]> => {
      const { data, error } = await permissionsTable()
        .select(
          "id, key, parent_id, node_type, module, page, section, tab, card, popup, feature, button, label, description, display_order, category, is_active, requires_backend, linked_backend_ref"
        )
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return ((data ?? []) as any[]).map((p) => ({
        id: p.id,
        key: p.key,
        parentId: p.parent_id,
        nodeType: p.node_type,
        module: p.module,
        page: p.page,
        section: p.section,
        tab: p.tab,
        card: p.card,
        popup: p.popup,
        feature: p.feature,
        button: p.button,
        label: p.label,
        description: p.description,
        displayOrder: p.display_order,
        category: p.category,
        isActive: p.is_active,
        requiresBackend: p.requires_backend,
        linkedBackendRef: p.linked_backend_ref,
      }));
    },
  });
}

/** Every role's current set of granted permission ids, keyed by role id. */
export function useRolePermissions() {
  return useQuery({
    queryKey: ["rbac", "role-permissions"],
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, Set<string>>> => {
      const { data, error } = await rolePermissionsTable().select("role_id, permission_id");
      if (error) throw error;
      const map: Record<string, Set<string>> = {};
      for (const row of (data ?? []) as { role_id: string; permission_id: string }[]) {
        if (!map[row.role_id]) map[row.role_id] = new Set();
        map[row.role_id].add(row.permission_id);
      }
      return map;
    },
  });
}

export function useToggleRolePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { roleId: string; permissionId: string; enabled: boolean }) => {
      if (v.enabled) {
        const { error } = await rolePermissionsTable().insert({ role_id: v.roleId, permission_id: v.permissionId });
        if (error && !`${error.message}`.includes("duplicate")) throw error;
      } else {
        const { error } = await rolePermissionsTable().delete().eq("role_id", v.roleId).eq("permission_id", v.permissionId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rbac"] }),
  });
}

/**
 * Grants or revokes a whole batch of permission nodes for a role in one
 * round trip -- what powers "toggle this whole module/page/section", plus
 * Select All / Deselect All, from the Admin permission tree. Duplicate
 * inserts (already-granted nodes) are ignored rather than failing the batch.
 */
export function useBulkSetRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { roleId: string; permissionIds: string[]; enabled: boolean }) => {
      if (v.permissionIds.length === 0) return;
      if (v.enabled) {
        const rows = v.permissionIds.map((permission_id) => ({ role_id: v.roleId, permission_id }));
        const { error } = await rolePermissionsTable().insert(rows);
        if (error && !`${error.message}`.includes("duplicate")) throw error;
      } else {
        const { error } = await rolePermissionsTable().delete().eq("role_id", v.roleId).in("permission_id", v.permissionIds);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rbac"] }),
  });
}

/* -------- Users -------- */

export interface UserWithRoles {
  user_id: string;
  email: string;
  roles: { id: string; key: string; label: string }[];
}

export function useUsersWithRoles() {
  return useQuery({
    queryKey: ["rbac", "users"],
    queryFn: async (): Promise<UserWithRoles[]> => {
      const { data, error } = await rpc("list_users_with_roles");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        user_id: r.user_id as string,
        email: r.email as string,
        roles: (r.roles ?? []) as { id: string; key: string; label: string }[],
      }));
    },
  });
}

export function useAssignUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { userId: string; roleId: string; enabled: boolean }) => {
      if (v.enabled) {
        const { error } = await userRolesTable().insert({ user_id: v.userId, role_id: v.roleId });
        if (error && !`${error.message}`.includes("duplicate")) throw error;
      } else {
        const { error } = await userRolesTable().delete().eq("user_id", v.userId).eq("role_id", v.roleId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rbac"] }),
  });
}
