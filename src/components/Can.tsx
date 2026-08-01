import type { ReactNode } from "react";
import { useCan } from "@/lib/rbac/use-rbac";
import type { PermissionKey } from "@/lib/rbac/roles";

/**
 * Permission gate. Renders children only when the current user has any of the
 * listed permissions. Use `fallback` for an explicit "no access" element.
 *
 *   <Can permission="designs.edit">...</Can>
 *   <Can permission={["users.edit", "roles.edit"]}>...</Can>
 */
export function Can({
  permission,
  fallback = null,
  children,
}: {
  permission: PermissionKey | PermissionKey[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { allowed, isLoading } = useCan(permission);
  if (isLoading) return null;
  return <>{allowed ? children : fallback}</>;
}
