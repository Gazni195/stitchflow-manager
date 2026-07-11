import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Loader2,
  User,
  Workflow,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DesignImage } from "@/components/DesignImage";
import { useRequireAuth } from "@/hooks/use-auth";
import { useDesignByCode } from "@/lib/api/designs";
import { useWorkflows } from "@/lib/api/workflows";
import { useBomItems } from "@/lib/api/sample-bom";
import { useOperationCatalog } from "@/lib/api/operations";
import { getSampleCost, estMarginPct } from "@/lib/sample-cost";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, STATUS_TONE, type Design } from "@/lib/designs";

export const Route = createFileRoute("/sample-development/$code")({
  head: ({ params }) => ({
    meta: [{ title: `Sample · ${params.code} — Fawri Lifestyle` }],
  }),
  component: DesignSamplePage,
});

function DesignSamplePage() {
  useRequireAuth();
  const { code } = Route.useParams();
  const { data: design, isLoading } = useDesignByCode(code);

  if (isLoading) {
    return (
      <AppShell title="Sample Development">
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!design) {
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

  return <DesignSample key={design.id} design={design} />;
}

function DesignSample({ design }: { design: Design }) {
  const { data: workflows = [], isLoading: wfLoading } = useWorkflows(design.id);
  const { data: bomItems = [] } = useBomItems(design.id);
  const { data: catalog = [] } = useOperationCatalog();
  const sample = workflows.find((w) => w.kind === "sample");
  const qc = useQueryClient();
  const creatingRef = useRef(false);

  // Auto-create a sample workflow when the design has none yet.
  useEffect(() => {
    if (wfLoading || !workflows) return;
    if (sample) return;
    if (creatingRef.current) return;
    creatingRef.current = true;
    (async () => {
      const { error } = await supabase
        .from("design_workflows")
        .insert({ design_id: design.id, kind: "sample", locked: false });
      if (!error) {
        qc.invalidateQueries({ queryKey: ["workflows", design.id] });
      }
      creatingRef.current = false;
    })();
  }, [wfLoading, workflows, sample, design.id, qc]);

  const steps = sample?.steps ?? [];
  const total = steps.length;
  const currentIdx = steps.findIndex((s) => s.status !== "completed" && s.status !== "skipped");
  const stepNumber = currentIdx === -1 ? total : currentIdx + 1;
  const sampleComplete = total > 0 && currentIdx === -1;

  const cost = getSampleCost(bomItems, sample, catalog);
  const margin = estMarginPct(design.targetCostPerPiece, cost.total);

  return (
    <AppShell
      title={`Sample · ${design.name}`}
      subtitle={`${design.code} · ${design.customer}`}
      action={
        <Link
          to="/designs/$code"
          params={{ code: design.code }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Design
        </Link>
      }
    >
      <div className="grid gap-5">
        <Link
          to="/sample-development"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All samples
        </Link>

        {/* Hero */}
        <section className="grid gap-4 overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div>
            <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-primary-soft">
              <DesignImage path={design.imagePath} alt={design.name} />
            </div>
            <div className="mt-2 flex items-center justify-center gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={
                    "h-1.5 rounded-full transition-all " +
                    (i === 0 ? "w-4 bg-primary" : "w-1.5 bg-muted")
                  }
                />
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
                  {design.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  For <span className="font-semibold text-foreground">{design.customer}</span>
                </p>
              </div>
              <span
                className={
                  "shrink-0 rounded-full px-3 py-1 text-xs font-semibold " +
                  STATUS_TONE[design.status]
                }
              >
                {STATUS_LABEL[design.status]}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Fact label="Order Qty (Planned)" value={design.orderQuantity.toLocaleString()} />
              <Fact label="Category" value={design.category || "—"} />
              <Fact
                label="Target Cost (Per Pc)"
                value={design.targetCostPerPiece > 0 ? `₹${design.targetCostPerPiece.toLocaleString()}` : "—"}
              />
              <Fact
                label="Est. Margin %"
                value={design.targetCostPerPiece > 0 ? `${margin}%` : "—"}
              />
              <Fact icon={CalendarDays} label="Created On" value={formatDate(design.createdAt)} />
              <Fact icon={User} label="Designer" value={design.assignedDesigner || "Unassigned"} />
            </div>
          </div>
        </section>

        {/* Workflow progress */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">Workflow Progress</h3>
            <span className="text-sm font-semibold text-muted-foreground">
              {total > 0 ? `Step ${stepNumber} of ${total}` : "Not started"}
            </span>
          </div>

          {total === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
              No process steps yet. Tap "Save &amp; Next" to add the first one.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {steps.map((s, i) => {
                const done = s.status === "completed" || s.status === "skipped";
                const current = i === currentIdx;
                return (
                  <div
                    key={s.id}
                    className={
                      "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold " +
                      (done
                        ? "bg-success text-white"
                        : current
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : "bg-muted text-muted-foreground")
                    }
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/sample-development/$code/timeline"
              params={{ code: design.code }}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-accent"
            >
              <Workflow className="h-4 w-4" /> View Workflow
            </Link>
            {sampleComplete ? (
              <Link
                to="/sample-development/$code/cost"
                params={{ code: design.code }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-105"
              >
                Go to Cost Summary
              </Link>
            ) : (
              <Link
                to="/sample-development/$code/materials"
                params={{ code: design.code }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-105"
              >
                Save &amp; Next
              </Link>
            )}
          </div>
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
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
