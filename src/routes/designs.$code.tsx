import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarDays,
  Factory,
  Layers,
  Palette,
  Pencil,
  Ruler,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getDesign, STATUS_TONE, type Design } from "@/lib/designs";
import { WORKFLOW } from "@/lib/workflow";

export const Route = createFileRoute("/designs/$code")({
  loader: ({ params }) => {
    const design = getDesign(params.code);
    if (!design) throw notFound();
    return { design };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.design.code} · ${loaderData.design.name} — Fawri Lifestyle`
          : "Design — Fawri Lifestyle",
      },
    ],
  }),
  notFoundComponent: DesignNotFound,
  errorComponent: ({ error }) => (
    <AppShell title="Design">
      <p className="text-sm text-destructive">{String(error)}</p>
    </AppShell>
  ),
  component: DesignDetails,
});

function DesignDetails() {
  const { design } = Route.useLoaderData() as { design: Design };
  return (
    <AppShell
      title={design.name}
      subtitle={`${design.code} · ${design.customer}`}
      action={
        <button className="hidden items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 sm:inline-flex">
          <Pencil className="h-4 w-4" /> Edit
        </button>
      }
    >
      <div className="grid gap-5">
        <Link
          to="/designs"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All designs
        </Link>

        {/* Hero */}
        <section className="grid gap-5 overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:grid-cols-[minmax(0,1fr)_1.2fr]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-primary-soft">
            <img
              src={design.image}
              alt={design.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute left-3 top-3 rounded-lg bg-background/90 px-2 py-1 text-xs font-bold tracking-wider backdrop-blur">
              {design.code}
            </div>
            <span
              className={
                "absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur " +
                STATUS_TONE[design.status]
              }
            >
              {design.status}
            </span>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
                Production Status
              </p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {design.name}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                For <span className="font-semibold text-foreground">{design.customer}</span>
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-gradient-to-br from-primary-soft to-background p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Overall progress</span>
                <span className="text-lg font-extrabold text-primary">
                  {design.progress}%
                </span>
              </div>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow"
                  style={{ width: `${design.progress}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Fact icon={Users} label="Customer" value={design.customer} />
              <Fact icon={Factory} label="Order Qty" value={design.quantity.toLocaleString()} />
              <Fact icon={Layers} label="Fabric" value={design.fabric} />
              <Fact icon={Palette} label="Color" value={design.color} />
              <Fact icon={CalendarDays} label="Due Date" value={formatDate(design.dueDate)} />
              <Fact icon={Ruler} label="Created" value={formatDate(design.createdAt)} />
            </div>
          </div>
        </section>

        {/* Workflow progress */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-base font-bold">Production Workflow</h3>
          <p className="text-xs text-muted-foreground">
            Stage-by-stage status for {design.code}
          </p>

          <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {WORKFLOW.map((stage) => {
              const state = stageState(design, stage.step);
              const Icon = stage.icon;
              return (
                <li
                  key={stage.id}
                  className={
                    "flex items-center gap-3 rounded-2xl border p-3 " +
                    (state === "done"
                      ? "border-primary/30 bg-primary-soft"
                      : state === "current"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background")
                  }
                >
                  <div
                    className={
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-bold " +
                      (state === "done"
                        ? "bg-primary text-primary-foreground"
                        : state === "current"
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : "bg-muted text-muted-foreground")
                    }
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{stage.title}</p>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {state === "done" ? "Completed" : state === "current" ? "In progress" : "Pending"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </AppShell>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}

function stageState(design: Design, step: number): "done" | "current" | "pending" {
  const currentStep = Math.max(1, Math.round((design.progress / 100) * WORKFLOW.length));
  if (design.progress >= 100) return "done";
  if (step < currentStep) return "done";
  if (step === currentStep) return "current";
  return "pending";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function DesignNotFound() {
  const { code } = Route.useParams();
  return (
    <AppShell title="Design not found" subtitle={code}>
      <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No design with code <span className="font-semibold">{code}</span>.
        </p>
        <Link
          to="/designs"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to designs
        </Link>
      </div>
    </AppShell>
  );
}
