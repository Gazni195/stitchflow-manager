import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/hooks/use-auth";
import { useDesignByCode } from "@/lib/api/designs";
import { useAddStep, useWorkflows } from "@/lib/api/workflows";
import { useOperationCatalog, type CatalogOperation } from "@/lib/api/operations";
import type { Design } from "@/lib/designs";

export const Route = createFileRoute("/sample-development/$code/next-process")({
  head: ({ params }) => ({
    meta: [{ title: `Select Next Process · ${params.code} — Fawri Lifestyle` }],
  }),
  component: NextProcessPage,
});

// The mockup's exact 8 cards — a curated subset of the full catalog, deliberately
// excluding gate operations (fabric-selection, sample-approval) that already have
// their own dedicated screens elsewhere in this flow.
const NEXT_PROCESS_IDS = [
  "sample-cutting",
  "sample-handwork",
  "machine-embroidery",
  "printing",
  "wash-dye",
  "sample-stitching",
  "sample-qc",
  "other-process",
];

function NextProcessPage() {
  useRequireAuth();
  const { code } = Route.useParams();
  const { data: design, isLoading } = useDesignByCode(code);

  if (isLoading) {
    return (
      <AppShell title="Select Next Process">
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
  return <NextProcess design={design} />;
}

function NextProcess({ design }: { design: Design }) {
  const navigate = useNavigate();
  const { data: workflows = [], isLoading: wfLoading } = useWorkflows(design.id);
  const { data: catalog = [], isLoading: catLoading } = useOperationCatalog();
  const addStep = useAddStep(design.id);
  const sample = workflows.find((w) => w.kind === "sample");

  const options = NEXT_PROCESS_IDS
    .map((id) => catalog.find((o) => o.id === id))
    .filter((o): o is CatalogOperation => !!o);

  async function pick(operationId: string) {
    if (!sample) return;
    const stepId = await addStep.mutateAsync({
      workflowId: sample.id,
      operationId,
      sequence: sample.steps.length + 1,
    });
    navigate({
      to: "/sample-development/$code/step/$stepId",
      params: { code: design.code, stepId },
    });
  }

  return (
    <AppShell
      title="Select Next Process"
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
      <div className="grid gap-5">
        <div>
          <h3 className="text-base font-bold">What's the next operation?</h3>
          <p className="text-sm text-muted-foreground">Choose the next process to continue.</p>
        </div>

        {wfLoading || catLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {options.map((op) => {
              const Icon = op.icon;
              return (
                <button
                  key={op.id}
                  disabled={addStep.isPending}
                  onClick={() => pick(op.id)}
                  className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md disabled:opacity-50"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{op.short}</p>
                    <p className="text-xs text-muted-foreground">{op.department}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
