import { createFileRoute, Link, Outlet, useRouterState, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useCan } from "@/lib/rbac/use-rbac";
import { Loader2, ShieldAlert, Users, KeyRound } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Fawri Lifestyle" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const roles = useCan("roles.view");
  const users = useCan("users.view");

  if (roles.isLoading || users.isLoading) {
    return (
      <AppShell title="Admin">
        <div className="grid place-items-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }
  if (!roles.allowed && !users.allowed) {
    return (
      <AppShell title="Admin">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-bold">Access denied</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You don't have permission to view admin settings.
          </p>
        </div>
      </AppShell>
    );
  }

  const tabs = [
    { to: "/admin/users", label: "Users", icon: Users, show: users.allowed },
    { to: "/admin/roles", label: "Roles & Permissions", icon: KeyRound, show: roles.allowed },
  ].filter((t) => t.show);

  return (
    <AppShell title="Admin" subtitle="Manage users, roles and permissions">
      <div className="mb-5 flex flex-wrap gap-2 border-b border-border">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition -mb-px",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </AppShell>
  );
}
