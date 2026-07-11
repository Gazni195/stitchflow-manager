import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Loader2, Play } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DesignImage } from "@/components/DesignImage";
import { useRequireAuth } from "@/hooks/use-auth";
import { useDesignByCode } from "@/lib/api/designs";
import { useWorkflows, stepLabel } from "@/lib/api/workflows";
import { useOperationCatalog } from "@/lib/api/operations";
import type { Design } from "@/lib/designs";

export const Route = createFileRoute("/sample-development/$code/production")({
  head: ({ params }) => ({
    meta: [{ title: `Production Order · ${params.code} — Fawri Lifestyle` }],
  }),
  component: ProductionOrderPage,
});

function ProductionOrderPage() {
  useRequireAuth();
  const { code } = Route.useParams();
  const { data: design, isLoading } = useDesignByCode(code);

  if (isLoading) {
    return (
      <AppShell title="Production Order">
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
  return <ProductionOrder design={design} />;
}

function ProductionOrder({ design }: { design: Design }) {
  const { data: workflows = [], isLoading } = useWorkflows(design.id);
  const { data: catalog = [] } = useOperationCatalog();
  const bulk = workflows.find((w) => w.kind === "bulk");

  return (
    <AppShell
      title="Production Order"
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
      ) : !bulk ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No production order yet — approve the sample first.
          </p>
          <Link
            to="/sample-development/$code/approval"
            params={{ code: design.code }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Go to Approval <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-5">
          <section className="flex items-center gap-3 rounded-3xl border border-border bg-card p-4 shadow-sm">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-primary-soft">
              <DesignImage path={design.imagePath} alt={design.name} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold">{design.name}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-primary">
                  {bulk.poNumber ?? "—"}
                </span>
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">
                  {bulk.locked ? "Active" : "Draft"}
                </span>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <Fact label="Order Qty" value={`${design.orderQuantity.toLocaleString()} Pcs`} />
            <Fact label="Start Date" value={formatDate(bulk.createdAt)} />
          </section>

          <section className="rounded-3xl border border-border bg-card p-2 shadow-sm">
            <p className="px-3 pt-3 text-sm font-bold">Next Steps</p>
            {bulk.steps.length === 0 ? (
              <p className="px-3 pb-3 pt-1 text-sm text-muted-foreground">
                No bulk steps configured yet.
              </p>
            ) : (
              bulk.steps
                .slice()
                .sort((a, b) => a.sequence - b.sequence)
                .map((s, i, arr) => {
                  const op = catalog.find((o) => o.id === s.operationId);
                  const label = stepLabel(s, bulk.steps, op?.name ?? s.operationId);
                  const done = s.status === "completed" || s.status === "skipped";
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between gap-3 px-3 py-3 ${i === arr.length - 1 ? "" : "border-b border-border"}`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                        {label}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {done ? "Ready" : "Pending"}
                      </span>
                    </div>
                  );
                })
            )}
          </section>

          <Link
            to="/designs/$code"
            params={{ code: design.code }}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-105"
          >
            <Play className="h-4 w-4" /> View Production
          </Link>
        </div>
      )}
    </AppShell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
