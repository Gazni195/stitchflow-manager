import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/hooks/use-auth";
import { useDesignByCode } from "@/lib/api/designs";
import { useApproveSample, useRejectSample, useWorkflows } from "@/lib/api/workflows";
import { useBomItems } from "@/lib/api/sample-bom";
import { useOperationCatalog } from "@/lib/api/operations";
import { getSampleCost, estMarginPct } from "@/lib/sample-cost";
import type { Design } from "@/lib/designs";

export const Route = createFileRoute("/sample-development/$code/approval")({
  head: ({ params }) => ({
    meta: [{ title: `Sample Approval · ${params.code} — Fawri Lifestyle` }],
  }),
  component: SampleApprovalPage,
});

function SampleApprovalPage() {
  useRequireAuth();
  const { code } = Route.useParams();
  const { data: design, isLoading } = useDesignByCode(code);

  if (isLoading) {
    return (
      <AppShell title="Sample Approval">
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
  return <SampleApproval design={design} />;
}

function SampleApproval({ design }: { design: Design }) {
  const navigate = useNavigate();
  const { data: workflows = [], isLoading } = useWorkflows(design.id);
  const { data: bomItems = [] } = useBomItems(design.id);
  const { data: catalog = [] } = useOperationCatalog();
  const approve = useApproveSample(design.id);
  const reject = useRejectSample(design.id);
  const sample = workflows.find((w) => w.kind === "sample");
  const [notes, setNotes] = useState("");

  const cost = getSampleCost(bomItems, sample, catalog);
  const margin = estMarginPct(design.targetCostPerPiece, cost.total);

  async function onApprove() {
    await approve.mutateAsync(notes || undefined);
    navigate({ to: "/sample-development/$code/approved", params: { code: design.code } });
  }

  async function onReject() {
    await reject.mutateAsync(notes || undefined);
    navigate({ to: "/sample-development/$code", params: { code: design.code } });
  }

  return (
    <AppShell
      title="Sample Approval"
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
              <ShieldCheck className="h-10 w-10" />
            </div>
            <h2 className="text-xl font-extrabold">Ready for Approval</h2>
            <p className="text-sm text-muted-foreground">All processes completed for this sample.</p>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Summary</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Fact label="Order Qty (Planned)" value={`${design.orderQuantity.toLocaleString()} Pcs`} />
              <Fact label="Total Sample Cost (Per Pc)" value={`₹${cost.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
              <Fact
                label="Target Cost (Per Pc)"
                value={design.targetCostPerPiece > 0 ? `₹${design.targetCostPerPiece.toLocaleString()}` : "—"}
              />
              <Fact label="Est. Margin %" value={design.targetCostPerPiece > 0 ? `${margin}%` : "—"} />
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Approval Notes (Optional)
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any notes…"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </section>

          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={reject.isPending || approve.isPending}
              onClick={onReject}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-background px-4 py-3 text-sm font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              {reject.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Reject
            </button>
            <button
              disabled={approve.isPending || reject.isPending}
              onClick={onApprove}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-105 disabled:opacity-50"
            >
              {approve.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Approve Sample
            </button>
          </div>
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
