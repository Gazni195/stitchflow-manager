import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { syncPermissions } from "./permission-sync.functions";
import type { SyncResult } from "./permission-sync";

/**
 * Runs the registry -> database synchronisation and refreshes every RBAC
 * query, so newly declared nodes appear in the Roles & Permissions tree
 * immediately after the call resolves.
 */
export function useSyncPermissions() {
  const qc = useQueryClient();
  const run = useServerFn(syncPermissions);
  return useMutation<SyncResult>({
    mutationFn: async () => (await run()) as SyncResult,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rbac"] }),
  });
}
