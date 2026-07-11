import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardList,
  Factory,
  Loader2,
  ShieldAlert,
  User,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DesignImage } from "@/components/DesignImage";
import { WORKFLOW } from "@/lib/workflow";
import { STATUS_LABEL, STATUS_TONE, type Design } from "@/lib/designs";
import { useDesigns } from "@/lib/api/designs";
import { useWorkflows } from "@/lib/api/workflows";
import { useOperationCatalog } from "@/lib/api/operations";
import { getDesignLifecycle } from "@/lib/design-lifecycle";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

type Tone = "primary" | "info" | "warning" | "success";

type Stat = {
  label: string;
  value: string;
  delta: string;
  hint: string;
  icon: LucideIcon;
  to: string;
  tone: Tone;
};

const STATS: Stat[] = [
  {
    label: "Total Orders",
    value: "128",
    delta: "+12 this week",
    hint: "Across all clients",
    icon: ClipboardList,
    to: "/samples",
    tone: "primary",
  },
  {
    label: "In Production",
    value: "42",
    delta: "8 lines active",
    hint: "Cutting · Handwork · Stitching",
    icon: Factory,
    to: "/stitching",
    tone: "info",
  },
  {
    label: "QC Pending",
    value: "17",
    delta: "3 urgent",
    hint: "Awaiting inspection",
    icon: ShieldAlert,
    to: "/qc",
    tone: "warning",
  },
  {
    label: "Ready Stock",
    value: "1,248",
    delta: "+96 today",
    hint: "Packed & barcoded",
    icon: Warehouse,
    to: "/stock",
    tone: "success",
  },
];

function Dashboard() {
  const { data: designs = [], isLoading } = useDesigns();
  const activeDesigns = designs
    .filter((d) => d.status !== "completed")
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, 6);

  return (
    <AppShell title="Dashboard" subtitle="Fawri Lifestyle · Production overview">
      <div className="grid gap-6">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary-glow p-6 text-primary-foreground shadow-lg sm:p-8">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
              Good day
            </p>
            <h2 className="mt-2 max-w-xl text-2xl font-extrabold tracking-tight sm:text-3xl">
              Here's how production is moving today.
            </h2>
            <p className="mt-2 max-w-xl text-sm opacity-90">
              4 stages need your attention. Tap a card to jump straight in.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to="/qc"
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/25"
              >
                Review QC <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/stitching"
                className="inline-flex items-center gap-2 rounded-xl bg-background px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:opacity-90"
              >
                Production Line
              </Link>
            </div>
          </div>
        </section>

        {/* Active Designs — every sample is a stage inside its design, not a separate record */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h3 className="text-lg font-bold tracking-tight">Active Designs</h3>
              <p className="text-sm text-muted-foreground">
                Each card shows a design's live progress through its lifecycle.
              </p>
            </div>
            <Link
              to="/designs"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {isLoading ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : activeDesigns.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No active designs yet. Create a design to start its sample development.
              </p>
              <Link
                to="/designs"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Go to Designs <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {activeDesigns.map((d) => (
                <ActiveDesignCard key={d.id} design={d} />
              ))}
            </div>
          )}
        </section>

        {/* KPI cards */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {STATS.map((s) => (
            <StatCard key={s.label} stat={s} />
          ))}
        </section>

        {/* Workflow shortcuts */}
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

function ActiveDesignCard({ design }: { design: Design }) {
  const { data: workflows = [] } = useWorkflows(design.id);
  const { data: catalog = [] } = useOperationCatalog();
  const { stage, currentStepLabel, progressPct, tab } = getDesignLifecycle(
    workflows,
    catalog,
  );

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[16/9] overflow-hidden bg-primary-soft">
        <DesignImage path={design.imagePath} alt={design.name} />
        <div className="absolute left-3 top-3 rounded-lg bg-background/90 px-2 py-1 text-[11px] font-bold tracking-wider backdrop-blur">
          {design.code}
        </div>
        <span
          className={
            "absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur " +
            STATUS_TONE[design.status]
          }
        >
          {STATUS_LABEL[design.status]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="truncate text-base font-bold">{design.name}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0" />
            {design.assignedDesigner || "Unassigned"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-primary-soft px-2.5 py-1 font-semibold text-primary">
            {stage}
          </span>
          <span className="truncate text-muted-foreground">{currentStepLabel}</span>
        </div>

        <div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span>Progress</span>
            <span className="text-primary">{progressPct}%</span>
          </div>
          <div
            className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <Link
          to="/designs/$code"
          params={{ code: design.code }}
          search={{ tab }}
          className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
        >
          Continue <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function StatCard({ stat }: { stat: Stat }) {
  const Icon = stat.icon;
  // All four cards use lavender gradients — varied depth/tint per tone so
  // they stay a cohesive brand family without looking identical.
  const gradient =
    stat.tone === "primary"
      ? "from-[oklch(0.55_0.24_293)] via-[oklch(0.62_0.22_293)] to-[oklch(0.78_0.14_300)]"
      : stat.tone === "info"
        ? "from-[oklch(0.48_0.22_285)] via-[oklch(0.58_0.22_290)] to-[oklch(0.72_0.16_298)]"
        : stat.tone === "warning"
          ? "from-[oklch(0.60_0.22_310)] via-[oklch(0.68_0.20_305)] to-[oklch(0.82_0.14_320)]"
          : "from-[oklch(0.52_0.20_280)] via-[oklch(0.62_0.20_288)] to-[oklch(0.80_0.14_295)]";

  return (
    <Link
      to={stat.to}
      className={
        "group relative overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-xl " +
        gradient
      }
    >
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-2xl transition group-hover:bg-white/25" />
      <div className="absolute -bottom-10 -left-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

      <div className="relative flex items-start justify-between">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/20 backdrop-blur">
          <Icon className="h-5 w-5" />
        </div>
        <ArrowUpRight className="h-5 w-5 opacity-70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
      </div>

      <div className="relative mt-6">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-85">
          {stat.label}
        </p>
        <p className="mt-1 text-4xl font-extrabold leading-none tracking-tight">
          {stat.value}
        </p>
        <div className="mt-3 flex items-center justify-between text-[11px] font-medium">
          <span className="rounded-full bg-white/20 px-2 py-0.5 backdrop-blur">
            {stat.delta}
          </span>
          <span className="truncate pl-2 opacity-80">{stat.hint}</span>
        </div>
      </div>
    </Link>
  );
}
