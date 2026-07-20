import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useMyPermissions } from "@/lib/rbac/use-rbac";
import {
  Loader2,
  User,
  KeyRound,
  Image as ImageIcon,
  Palette,
  Bell,
  Building2,
  Users,
  ShieldCheck,
  Network,
  Settings as SettingsIcon,
  Plug,
} from "lucide-react";
import type { PermissionKey } from "@/lib/rbac/roles";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Fawri Lifestyle" }] }),
  component: SettingsLayout,
});

type Section = {
  to: string;
  label: string;
  icon: typeof User;
  /** undefined = always visible for authenticated users */
  permission?: PermissionKey | PermissionKey[];
};

const SECTIONS: Section[] = [
  // Personal — everyone
  { to: "/settings/profile", label: "My Profile", icon: User },
  { to: "/settings/password", label: "Change Password", icon: KeyRound },
  { to: "/settings/photo", label: "Profile Photo", icon: ImageIcon },
  { to: "/settings/theme", label: "Theme", icon: Palette },
  { to: "/settings/notifications", label: "Notifications", icon: Bell },
  // Admin / privileged
  { to: "/settings/company", label: "Company", icon: Building2, permission: "settings.edit" },
  { to: "/settings/users", label: "Users", icon: Users, permission: "users.view" },
  { to: "/settings/roles", label: "Roles & Permissions", icon: ShieldCheck, permission: "roles.view" },
  { to: "/settings/structure", label: "Company Structure", icon: Network, permission: "settings.edit" },
  { to: "/settings/system", label: "System Settings", icon: SettingsIcon, permission: "settings.edit" },
  { to: "/settings/integrations", label: "Integration Status", icon: Plug, permission: "settings.view" },
];

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: perms, isLoading } = useMyPermissions();

  if (isLoading) {
    return (
      <AppShell title="Settings">
        <div className="grid place-items-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  const visible = SECTIONS.filter((s) => {
    if (!s.permission) return true;
    const keys = Array.isArray(s.permission) ? s.permission : [s.permission];
    return !!perms && keys.some((k) => perms.has(k));
  });

  return (
    <AppShell title="Settings" subtitle="Manage your account and workspace">
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <nav className="rounded-2xl border border-border bg-card p-2">
            <ul className="space-y-0.5">
              {visible.map((s) => {
                const active = pathname === s.to || pathname.startsWith(s.to + "/");
                const Icon = s.icon;
                return (
                  <li key={s.to}>
                    <Link
                      to={s.to}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-foreground hover:bg-accent",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {s.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </AppShell>
  );
}
