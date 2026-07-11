import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Bell, Search, LayoutDashboard, Shirt, FlaskConical, Factory, Warehouse, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { WORKFLOW } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/hooks/use-auth";

const PRIMARY_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/designs", label: "Designs", icon: Shirt },
  { to: "/sample-development", label: "Samples", icon: FlaskConical },
  { to: "/stitching", label: "Production", icon: Factory },
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useRequireAuth();

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
                {subtitle && (
                  <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
                )}
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
              <div className="ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-sm font-bold text-primary-foreground shadow-sm">
                FL
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5">
          {PRIMARY_NAV.map((item) => {
            const active =
              item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
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
        </ul>
      </nav>
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
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {!hideBrand && (
        <div className="px-5 pt-6">
          <Brand />
        </div>
      )}

      <div className="mt-6 px-3">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Overview
        </p>
        <ul className="space-y-1">
          {PRIMARY_NAV.map((item) => {
            const active =
              item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
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
        </ul>
      </div>

      <div className="mt-6 px-3">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Workflow
        </p>
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
          <p className="mt-1 text-[11px] text-muted-foreground">
            API integration coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
