import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Menu,
  Bell,
  Search,
  LayoutDashboard,
  Shirt,
  FlaskConical,
  Factory,
  Warehouse,
  Package,
  X,
  PlayCircle,
  ShieldCheck,
  Settings as SettingsIcon,
  Plus,
  MoreHorizontal,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WORKFLOW } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import { useRequireAuth, useSession } from "@/hooks/use-auth";
import { useCan } from "@/lib/rbac/use-rbac";
import { supabase } from "@/integrations/supabase/client";

// Desktop sidebar only (SidebarContent below) — unchanged by the mobile/
// tablet bottom-nav redesign. Do not repurpose this array for the bottom
// nav; it intentionally lists everything the desktop "Overview" section
// shows, which is a different set from the bottom bar now.
const PRIMARY_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/designs", label: "Designs", icon: Shirt },
  { to: "/sample-development", label: "Samples", icon: FlaskConical },
  { to: "/production", label: "Production", icon: PlayCircle },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/lines", label: "Lines", icon: Factory },
  { to: "/stock", label: "Stock", icon: Warehouse },
] as const;

const ADMIN_NAV = { to: "/admin", label: "Admin", icon: ShieldCheck } as const;
const SETTINGS_NAV = { to: "/settings", label: "Settings", icon: SettingsIcon } as const;

// Bottom nav (mobile + tablet, i.e. everything below the `lg:` breakpoint
// where the desktop sidebar takes over) — a curated subset of PRIMARY_NAV,
// kept as its own array so it can be trimmed without touching what the
// desktop sidebar shows. The 3rd of 5 slots is a spacer under the
// floating "+" button, not a real nav item.
const BOTTOM_NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sample-development", label: "Samples", icon: FlaskConical },
  { to: "/production", label: "Production", icon: PlayCircle },
] as const;

// Everything that used to be a bottom-nav icon but no longer fits, plus
// Settings — surfaced from the new "More" sheet instead. Admin is added
// conditionally alongside this list (permission-gated, same as the
// desktop sidebar). Reports has no route yet, so it's left out entirely
// rather than linking somewhere that doesn't exist — add it here once
// a Reports page exists.
const MORE_MENU_ITEMS = [
  { to: "/designs", label: "Designs", icon: Shirt },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/lines", label: "Lines", icon: Factory },
  { to: "/stock", label: "Stock", icon: Warehouse },
] as const;

export function AppShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useRequireAuth();
  const { session } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  // Same permission check SidebarContent uses for its own Admin link —
  // called again here (cheap; useMyPermissions is cached) because the new
  // bottom-nav "More" sheet is rendered from AppShell itself, not from
  // SidebarContent, and needs the same answer.
  const adminCan = useCan(["users.view", "roles.view"]);

  const meta = (session?.user?.user_metadata ?? {}) as {
    full_name?: string;
    avatar_path?: string;
    avatar_url?: string;
  };
  const email = session?.user?.email ?? "";
  const displayName = meta.full_name || email || "";
  const initials = (displayName || "U")
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (meta.avatar_path) {
        const { data } = await supabase.storage.from("avatars").createSignedUrl(meta.avatar_path, 3600);
        if (!cancelled) setAvatarUrl(data?.signedUrl ?? null);
      } else if (meta.avatar_url) {
        setAvatarUrl(meta.avatar_url);
      } else {
        setAvatarUrl(null);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [meta.avatar_path, meta.avatar_url]);

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <SidebarContent pathname={pathname} onNavigate={() => setOpen(false)} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col bg-sidebar shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-5">
              <Brand />
              <button
                aria-label="Close menu"
                className="rounded-full p-2 text-muted-foreground hover:bg-accent"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent pathname={pathname} onNavigate={() => setOpen(false)} hideBrand />
          </aside>
        </div>
      )}

      <div className="lg:pl-72">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-label="Open menu"
                className="rounded-xl p-2 text-foreground hover:bg-accent lg:hidden"
                onClick={() => setOpen(true)}
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold sm:text-xl">{title}</h1>
                {subtitle && <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {action}
              <button
                aria-label="Search"
                className="hidden rounded-xl p-2 text-muted-foreground hover:bg-accent sm:inline-flex"
              >
                <Search className="h-5 w-5" />
              </button>
              <button
                aria-label="Notifications"
                className="relative rounded-xl p-2 text-muted-foreground hover:bg-accent"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
              </button>
              <Link
                to="/settings/profile"
                aria-label="Account"
                title={displayName || "Account"}
                className="ml-1 grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary-glow text-sm font-bold text-primary-foreground shadow-sm"
              >
                {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initials || "U"}
              </Link>
              <button
                aria-label="Sign out"
                onClick={handleSignOut}
                className="hidden rounded-xl px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground sm:inline-flex"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10">{children}</main>
      </div>

      {/* Bottom nav — mobile + tablet only (lg:hidden, same breakpoint the
          desktop sidebar above uses to take over). Dashboard / Samples /
          Production / More, with a floating "+" placeholder centered
          between Samples and Production. Designs/Inventory/Lines/Stock
          moved into the More sheet below; the desktop sidebar (aside +
          SidebarContent) is untouched and still shows all of them. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:hidden">
        <ul className="relative grid grid-cols-5">
          {BOTTOM_NAV_ITEMS.slice(0, 2).map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                  {item.label}
                </Link>
              </li>
            );
          })}

          {/* Spacer under the floating button — not a real nav item. */}
          <li aria-hidden />

          {BOTTOM_NAV_ITEMS.slice(2).map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                  {item.label}
                </Link>
              </li>
            );
          })}

          <li>
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
                moreOpen ? "text-primary" : "text-muted-foreground",
              )}
            >
              <MoreHorizontal className={cn("h-5 w-5", moreOpen && "stroke-[2.5]")} />
              More
            </button>
          </li>
        </ul>

        {/* UI placeholder only — intentionally no onClick/navigation yet.
            Shifted down from the bar's top edge so it sits inside the bar
            instead of poking above it; size/color/icon unchanged. */}
        <button
          type="button"
          disabled
          aria-label="Quick add (coming soon)"
          className="absolute left-1/2 top-[20px] grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-lg shadow-primary/30 disabled:opacity-100"
        >
          <Plus className="h-6 w-6" />
        </button>
      </nav>

      {/* "More" sheet — mobile + tablet only, opened from the bottom nav
          above. Deliberately a different pattern (bottom sheet) from the
          hamburger drawer so the two are easy to tell apart; contents are
          exactly Designs/Inventory/Lines/Stock/Settings/Admin, not the
          full sidebar (no Dashboard/Samples/Production duplicated, no
          Workflow stage list). */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-bold">More</h2>
              <button
                aria-label="Close"
                onClick={() => setMoreOpen(false)}
                className="rounded-xl p-2 text-muted-foreground hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="grid gap-1 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {MORE_MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-foreground hover:bg-accent"
                    >
                      <Icon className="h-5 w-5 text-muted-foreground" /> {item.label}
                    </Link>
                  </li>
                );
              })}
              {/* Reports has no route yet — add it here once one exists. */}
              <li>
                <Link
                  to={SETTINGS_NAV.to}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-foreground hover:bg-accent"
                >
                  <SETTINGS_NAV.icon className="h-5 w-5 text-muted-foreground" /> {SETTINGS_NAV.label}
                </Link>
              </li>
              {adminCan.allowed && (
                <li>
                  <Link
                    to={ADMIN_NAV.to}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-foreground hover:bg-accent"
                  >
                    <ADMIN_NAV.icon className="h-5 w-5 text-muted-foreground" /> {ADMIN_NAV.label}
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-sm font-black text-primary-foreground shadow-md">
        F
      </div>
      <div className="leading-tight">
        <div className="text-sm font-extrabold tracking-tight">Fawri Lifestyle</div>
        <div className="text-[11px] text-muted-foreground">Production</div>
      </div>
    </Link>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
  hideBrand,
}: {
  pathname: string;
  onNavigate: () => void;
  hideBrand?: boolean;
}) {
  const adminCan = useCan(["users.view", "roles.view"]);
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {!hideBrand && (
        <div className="px-5 pt-6">
          <Brand />
        </div>
      )}

      <div className="mt-6 px-3">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Overview</p>
        <ul className="space-y-1">
          {PRIMARY_NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
          {adminCan.allowed && (
            <li>
              <Link
                to={ADMIN_NAV.to}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                  pathname.startsWith(ADMIN_NAV.to)
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <ADMIN_NAV.icon className="h-5 w-5" />
                {ADMIN_NAV.label}
              </Link>
            </li>
          )}
          <li>
            <Link
              to={SETTINGS_NAV.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                pathname.startsWith(SETTINGS_NAV.to)
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              <SETTINGS_NAV.icon className="h-5 w-5" />
              {SETTINGS_NAV.label}
            </Link>
          </li>
        </ul>
      </div>

      <div className="mt-6 px-3">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Workflow</p>
        <ul className="space-y-0.5">
          {WORKFLOW.map((stage) => {
            const active = pathname.startsWith(stage.to);
            const Icon = stage.icon;
            return (
              <li key={stage.id}>
                <Link
                  to={stage.to}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                    active
                      ? "bg-primary-soft text-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                    )}
                  >
                    {stage.step}
                  </span>
                  <span className="flex min-w-0 items-center gap-2 truncate">
                    <Icon className="h-4 w-4 shrink-0 opacity-70" />
                    <span className="truncate font-medium">{stage.title}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-auto px-5 py-5">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary-soft to-background p-4">
          <p className="text-xs font-semibold text-accent-foreground">ERPNext Sync</p>
          <p className="mt-1 text-[11px] text-muted-foreground">API integration coming soon.</p>
        </div>
      </div>
    </div>
  );
}
