import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, TrendingUp, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { WORKFLOW } from "@/lib/workflow";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

const STATS = [
  { label: "Active Orders", value: "24", icon: TrendingUp, tone: "primary" as const },
  { label: "In Production", value: "12", icon: Clock, tone: "warning" as const },
  { label: "Ready Stock", value: "1,248", icon: CheckCircle2, tone: "success" as const },
  { label: "QC Pending", value: "6", icon: AlertTriangle, tone: "destructive" as const },
];

function Dashboard() {
  return (
    <AppShell title="Dashboard" subtitle="Fawri Lifestyle · Production overview">
      <div className="grid gap-6">
        {/* Hero */}
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary-glow p-6 text-primary-foreground shadow-lg sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
            Welcome back
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Let's move today's production forward.
          </h2>
          <p className="mt-2 max-w-xl text-sm opacity-90">
            Track every garment from sample to ready stock in one simple flow.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/samples"
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/25"
            >
              Start a Sample <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/stitching"
              className="inline-flex items-center gap-2 rounded-xl bg-background px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:opacity-90"
            >
              Production Line
            </Link>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={
                      "grid h-9 w-9 place-items-center rounded-xl " +
                      (s.tone === "primary"
                        ? "bg-primary-soft text-primary"
                        : s.tone === "warning"
                          ? "bg-warning/15 text-warning"
                          : s.tone === "success"
                            ? "bg-success/15 text-success"
                            : "bg-destructive/15 text-destructive")
                    }
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-3 text-2xl font-extrabold tracking-tight">{s.value}</p>
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              </div>
            );
          })}
        </section>

        {/* Workflow */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h3 className="text-lg font-bold tracking-tight">Production Workflow</h3>
              <p className="text-sm text-muted-foreground">
                Tap any stage to open its work board.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WORKFLOW.map((stage) => {
              const Icon = stage.icon;
              return (
                <Link
                  key={stage.id}
                  to={stage.to}
                  className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {String(stage.step).padStart(2, "0")}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {stage.phase}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-base font-bold">{stage.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {stage.description}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
