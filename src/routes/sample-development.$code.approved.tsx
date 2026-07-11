import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/hooks/use-auth";
import { useDesignByCode } from "@/lib/api/designs";
import { useWorkflows } from "@/lib/api/workflows";
import { useBomItems } from "@/lib/api/sample-bom";
import type { Design } from "@/lib/designs";

export const Route = createFileRoute("/sample-development/$code/approved")({
  head: ({ params }) => ({
    meta: [{ title: `Sample Approved · ${params.code} — Fawri Lifestyle` }],
  }),
  component: SampleApprovedPage,
});

function SampleApprovedPage() {
  useRequireAuth();
  const { code } = Route.useParams();
  const { data: design, isLoading } = useDesignByCode(code);

  if (isLoading) {
    return (
      <AppShell title="Sample Approved">
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
  return <SampleApproved design={design} />;
}

function SampleApproved({ design }: { design: Design }) {
  const { data: workflows = [], isLoading } = useWorkflows(design.id);
  const { data: bomItems = [] } = useBomItems(design.id);
  const sample = workflows.find((w) => w.kind === "sample");
  const bulk = workflows.find((w) => w.kind === "bulk");

  const sampleLocked = !!sample?.locked;
  const bomFinalized = bomItems.length > 0;
  const productionReady = !!bulk;

  return (
    <AppShell
      title="Sample Approved"
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
      ) : (
        <div className="grid gap-5">
          <section className="grid place-items-center gap-2 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h2 className="text-xl font-extrabold">Sample Approved!</h2>
            <p className="text-sm text-muted-foreground">{design.name}</p>
          </section>

          <section className="rounded-3xl border border-border bg-card p-2 shadow-sm">
            <ChecklistRow label="Sample Locked" done={sampleLocked} />
            <ChecklistRow label="BOM Finalized" done={bomFinalized} />
            <ChecklistRow label="Production Ready" done={productionReady} last />
          </section>

          <Link
            to="/sample-development/$code/production"
            params={{ code: design.code }}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-105"
          >
            Go to Production <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </AppShell>
  );
}

function ChecklistRow({ label, done, last }: { label: string; done: boolean; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-3 ${last ? "" : "border-b border-border"}`}>
      <span className="text-sm font-semibold">{label}</span>
      {done ? (
        <CheckCircle2 className="h-5 w-5 text-success" />
      ) : (
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}
