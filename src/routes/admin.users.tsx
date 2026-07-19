import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAssignUserRole, useCan, useUsersWithRoles } from "@/lib/rbac/use-rbac";
import { ALL_ROLES, ROLE_LABELS, type AppRole } from "@/lib/rbac/roles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
});

function UsersPage() {
  const canManage = useCan("users.edit");
  const users = useUsersWithRoles();
  const assign = useAssignUserRole();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (users.data ?? []).filter((u) => !term || u.email.toLowerCase().includes(term));
  }, [users.data, q]);

  if (users.isLoading) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users by email"
            className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} users</span>
      </div>

      <div className="space-y-3">
        {filtered.map((u) => (
          <div key={u.user_id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold">{u.email}</div>
                <div className="text-[11px] text-muted-foreground">{u.user_id}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {u.roles.length === 0 && (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    No role
                  </span>
                )}
                {u.roles.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-accent-foreground"
                  >
                    {ROLE_LABELS[r]}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {ALL_ROLES.map((r) => {
                const on = u.roles.includes(r);
                return (
                  <label
                    key={r}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium transition",
                      on ? "bg-primary-soft/40" : "bg-background",
                      !canManage.allowed && "opacity-60",
                    )}
                  >
                    <span>{ROLE_LABELS[r]}</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={on}
                      disabled={!canManage.allowed || assign.isPending}
                      onChange={(e) => {
                        assign.mutate(
                          { userId: u.user_id, role: r as AppRole, enabled: e.target.checked },
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
    </div>
  );
}
