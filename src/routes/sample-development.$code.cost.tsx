import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DesignImage } from "@/components/DesignImage";
import { useRequireAuth } from "@/hooks/use-auth";
import { useDesignByCode } from "@/lib/api/designs";
import { useUpdateOtherCharges, useWorkflows } from "@/lib/api/workflows";
import { useBomItems } from "@/lib/api/sample-bom";
import { useOperationCatalog } from "@/lib/api/operations";
import { getSampleCost } from "@/lib/sample-cost";
import type { Design } from "@/lib/designs";

export const Route = createFileRoute("/sample-development/$code/cost")({
  head: ({ params }) => ({
    meta: [{ title: `Cost Summary · ${params.code} — Fawri Lifestyle` }],
  }),
  component: CostSummaryPage,
});

function CostSummaryPage() {
  useRequireAuth();
  const { code } = Route.useParams();
  const { data: design, isLoading } = useDesignByCode(code);

  if (isLoading) {
    return (
      <AppShell title="Cost Summary">
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
  return <CostSummary design={design} />;
}

function CostSummary({ design }: { design: Design }) {
  const { data: workflows = [], isLoading } = useWorkflows(design.id);
  const { data: bomItems = [] } = useBomItems(design.id);
  const { data: catalog = [] } = useOperationCatalog();
  const updateOtherCharges = useUpdateOtherCharges(design.id);
  const sample = workflows.find((w) => w.kind === "sample");

  const cost = getSampleCost(bomItems, sample, catalog);
  const [otherCharges, setOtherCharges] = useState(0);

  useEffect(() => {
    setOtherCharges(sample?.otherCharges ?? 0);
  }, [sample?.otherCharges]);

  function commitOtherCharges() {
    if (!sample) return;
    updateOtherCharges.mutate({ workflowId: sample.id, otherCharges });
  }

  const total = cost.materialCost + cost.departmentLines.reduce((s, l) => s + l.amount, 0) + otherCharges;

  return (
    <AppShell
      title="Cost Summary"
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
          <section className="flex items-center gap-3 rounded-3xl border border-border bg-card p-4 shadow-sm">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-primary-soft">
              <DesignImage path={design.imagePath} alt={design.name} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold">
                {design.code} · {design.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Order Qty (Planned): {design.orderQuantity.toLocaleString()} Pcs
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-base font-bold">Cost Breakdown (Per Pc)</h3>
            <ul className="mt-3 divide-y divide-border">
              <CostRow label="Material Cost" amount={cost.materialCost} dotClass="bg-primary" />
              {cost.departmentLines.map((line) => (
                <CostRow key={line.label} label={line.label} amount={line.amount} dotClass="bg-accent-foreground" />
              ))}
              <li className="flex items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" /> Other Charges
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">₹</span>
                  <input
                    type="number"
                    min={0}
                    value={otherCharges || ""}
                    onChange={(e) => setOtherCharges(Math.max(0, Number(e.target.value) || 0))}
                    onBlur={commitOtherCharges}
                    className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-right text-sm font-semibold outline-none focus:border-primary"
                  />
                </div>
              </li>
            </ul>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-primary-soft px-4 py-3">
              <span className="text-sm font-bold">Total Sample Cost (Approx.)</span>
              <span className="text-lg font-extrabold text-primary">₹{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          </section>

          <Link
            to="/sample-development/$code/approval"
            params={{ code: design.code }}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-105"
          >
            Continue to Approval <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </AppShell>
  );
}

function CostRow({ label, amount, dotClass }: { label: string; amount: number; dotClass: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <span className="flex items-center gap-2 text-sm font-semibold">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} /> {label}
      </span>
      <span className="text-sm font-bold">₹{amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
    </li>
  );
}
