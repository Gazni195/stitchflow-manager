import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/hooks/use-auth";
import { useDesignByCode } from "@/lib/api/designs";
import { useWorkflows, stepLabel } from "@/lib/api/workflows";
import { useOperationCatalog } from "@/lib/api/operations";
import type { Design } from "@/lib/designs";

export const Route = createFileRoute("/sample-development/$code/timeline")({
  head: ({ params }) => ({
    meta: [{ title: `Workflow Timeline · ${params.code} — Fawri Lifestyle` }],
  }),
  component: TimelinePage,
});

function TimelinePage() {
  useRequireAuth();
  const { code } = Route.useParams();
  const { data: design, isLoading } = useDesignByCode(code);

  if (isLoading) {
    return (
      <AppShell title="Workflow Timeline">
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }
  if (!design) {
    return (
      <AppShell title="Design not found" subtitle={code}>
        <p className="text-sm text-muted-foreground">No design with code {code}.</p>
      </AppShell>
    );
  }
  return <Timeline design={design} />;
}

function Timeline({ design }: { design: Design }) {
  const { data: workflows = [], isLoading } = useWorkflows(design.id);
  const { data: catalog = [] } = useOperationCatalog();
  const sample = workflows.find((w) => w.kind === "sample");
  const steps = sample?.steps ?? [];
  const currentIdx = steps.findIndex((s) => s.status !== "completed" && s.status !== "skipped");

  return (
    <AppShell
      title="Workflow Timeline"
      subtitle={`${design.code} · ${design.name}`}
      action={
        <Link
          to="/sample-development/$code"
          params={{ code: design.code }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Sample
        </Link>
      }
    >
      {isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : steps.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No process steps yet.</p>
        </div>
      ) : (
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-base font-bold">Workflow</h3>
          <ol className="mt-4 space-y-5">
            {steps.map((s, i) => {
              const op = catalog.find((o) => o.id === s.operationId);
              const label = stepLabel(s, steps, op?.name ?? s.operationId);
              const done = s.status === "completed" || s.status === "skipped";
              const current = i === currentIdx;
              return (
                <li key={s.id} className="flex items-start gap-3">
                  <div
                    className={
                      "grid h-9 w-9 shrink-0 place-items-center rounded-full " +
                      (done
                        ? "bg-success text-white"
                        : current
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : "bg-muted text-muted-foreground")
                    }
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      <span className="mr-1 text-muted-foreground">{i + 1}.</span>
                      {label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.status === "completed" && s.completedAt
                        ? formatDateTime(s.completedAt)
                        : s.status === "skipped"
                          ? "Skipped"
                          : current
                            ? "In progress"
                            : "Pending"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </AppShell>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
