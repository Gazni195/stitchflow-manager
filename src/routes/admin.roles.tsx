import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, ShieldAlert, Check } from "lucide-react";
import { toast } from "sonner";
import {
  useCan,
  usePermissionsCatalog,
  useRolePermissions,
  useToggleRolePermission,
} from "@/lib/rbac/use-rbac";
import { ALL_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type AppRole } from "@/lib/rbac/roles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/roles")({
  component: RolesPage,
});

function RolesPage() {
  const canManage = useCan("roles.edit");
  const perms = usePermissionsCatalog();
  const rolePerms = useRolePermissions();
  const toggle = useToggleRolePermission();
  const [role, setRole] = useState<AppRole>("admin");

  const grouped = useMemo(() => {
    const map = new Map<string, typeof perms.data>();
    for (const p of perms.data ?? []) {
      const arr = map.get(p.module) ?? [];
      arr.push(p);
      map.set(p.module, arr as typeof perms.data);
    }
    return Array.from(map.entries());
  }, [perms.data]);

  if (perms.isLoading || rolePerms.isLoading) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const active = rolePerms.data?.[role] ?? new Set<string>();
  const isSuper = role === "super_admin";

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-1">
        {ALL_ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={cn(
              "w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition",
              role === r
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground hover:bg-accent",
            )}
          >
            {ROLE_LABELS[r]}
          </button>
        ))}
      </aside>

      <section>
        <div className="mb-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold">{ROLE_LABELS[role]}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
          {isSuper && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary-soft/40 p-3 text-xs text-accent-foreground">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Super Admin implicitly holds every permission — the matrix below is informational.
            </div>
          )}
          {!canManage.allowed && (
            <p className="mt-3 text-xs text-muted-foreground">
              Read-only. You need <code>roles.edit</code> to change assignments.
            </p>
          )}
        </div>

        <div className="space-y-4">
          {grouped.map(([module, list]) => (
            <div key={module} className="rounded-2xl border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <h3 className="text-sm font-bold uppercase tracking-wide">{module}</h3>
              </div>
              <div className="grid gap-2 p-4 sm:grid-cols-2">
                {(list ?? []).map((p) => {
                  const on = isSuper || active.has(p.id);
                  const disabled = isSuper || !canManage.allowed || toggle.isPending;
                  return (
                    <label
                      key={p.id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-sm transition",
                        on ? "bg-primary-soft/40" : "bg-background",
                        disabled ? "opacity-70" : "hover:border-primary/40",
                      )}
                    >
                      <div>
                        <div className="font-semibold">{p.label}</div>
                        <div className="text-[11px] text-muted-foreground">{p.key}</div>
                      </div>
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-primary"
                        checked={on}
                        disabled={disabled}
                        onChange={(e) => {
                          toggle.mutate(
                            { role, permissionId: p.id, enabled: e.target.checked },
                            {
                              onError: (err) =>
                                toast.error(err instanceof Error ? err.message : "Failed"),
                            },
                          );
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
