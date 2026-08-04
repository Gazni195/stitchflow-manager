import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import type { AppRole, PermissionKey } from "./roles";

export interface PermissionRow {
  id: string;
  key: string;
  module: string;
  action: string;
  label: string;
  description: string | null;
}

/** Load the current user's roles (respects RLS: users can read their own). */
export function useMyRoles() {
  const { session } = useSession();
  const uid = session?.user?.id;
  return useQuery({
    queryKey: ["rbac", "my-roles", uid],
    enabled: !!uid,
    staleTime: 60_000,
    queryFn: async (): Promise<AppRole[]> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid!);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
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
      const { data, error } = await supabase.rpc("current_user_permissions");
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

export function useHasRole(role: AppRole) {
  const { data } = useMyRoles();
  return !!data?.includes(role);
}

/** Self-service seed for the configured Super Admin email. Safe to call on every login. */
export function useEnsureSuperAdminSeed() {
  const { session } = useSession();
  const qc = useQueryClient();
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase.rpc("ensure_super_admin_seed").then(() => {
      qc.invalidateQueries({ queryKey: ["rbac"] });
    });
  }, [session?.user?.id, qc]);
}

/* -------- admin data -------- */

export function usePermissionsCatalog() {
  return useQuery({
    queryKey: ["rbac", "permissions"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PermissionRow[]> => {
      const { data, error } = await supabase
        .from("permissions")
        .select("id, key, module, action, label, description")
        .order("module")
        .order("action");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRolePermissions() {
  return useQuery({
    queryKey: ["rbac", "role-permissions"],
    staleTime: 60_000,
    queryFn: async (): Promise<Record<AppRole, Set<string>>> => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("role, permission_id");
      if (error) throw error;
      const map: Record<string, Set<string>> = {};
      for (const row of data ?? []) {
        const r = row.role as AppRole;
        if (!map[r]) map[r] = new Set();
        map[r].add(row.permission_id as string);
      }
      return map as Record<AppRole, Set<string>>;
    },
  });
}

export function useToggleRolePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      role,
      permissionId,
      enabled,
    }: {
      role: AppRole;
      permissionId: string;
      enabled: boolean;
    }) => {
      if (enabled) {
        const { error } = await supabase
          .from("role_permissions")
          .insert({ role, permission_id: permissionId });
        if (error && !`${error.message}`.includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role", role)
          .eq("permission_id", permissionId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rbac"] }),
  });
}

export interface UserWithRoles {
  user_id: string;
  email: string;
  roles: AppRole[];
}

export function useUsersWithRoles() {
  return useQuery({
    queryKey: ["rbac", "users"],
    queryFn: async (): Promise<UserWithRoles[]> => {
      const { data, error } = await supabase.rpc("list_users_with_roles");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        user_id: r.user_id as string,
        email: r.email as string,
        roles: (r.roles ?? []) as AppRole[],
      }));
    },
  });
}

export function useAssignUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      role,
      enabled,
    }: {
      userId: string;
      role: AppRole;
      enabled: boolean;
    }) => {
      if (enabled) {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role });
        if (error && !`${error.message}`.includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rbac"] }),
  });
}
