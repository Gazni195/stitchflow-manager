import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Eye,
  Factory,
  FileText,
  History as HistoryIcon,
  Layers,
  LayoutGrid,
  Loader2,
  Package,
  Palette,
  Pause,
  Pencil,
  Phone,
  Play,
  Receipt,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  Users,
  Workflow as WorkflowIcon,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DesignActionsMenu } from "@/components/DesignActionsMenu";
import { DesignImage } from "@/components/DesignImage";
import { useRequireAuth } from "@/hooks/use-auth";
import { STATUS_LABEL, STATUS_TONE, type Design } from "@/lib/designs";
import { useDesignByCode } from "@/lib/api/designs";
import {
  useAddStep,
  useApproveSample,
  useRejectSample,
  useStartBulkProduction,
  useUpdateOtherCharges,
  useUpdateStep,
  useWorkflows,
  stepLabel,
  type DesignWorkflow,
  type StepStatus,
  type WorkflowStep,
} from "@/lib/api/workflows";
import { useOperationCatalog, type CatalogOperation } from "@/lib/api/operations";
import { useBomItems, useDeleteBomItem, useUpsertBomItem, type BomItem } from "@/lib/api/sample-bom";
import { useWorkers, hourlyRate, type Worker } from "@/lib/api/workers";
import { getSampleCost, estMarginPct } from "@/lib/sample-cost";
import type { DesignModuleTab } from "@/lib/design-lifecycle";
import { supabase } from "@/integrations/supabase/client";

const TAB_IDS: DesignModuleTab[] = [
  "overview",
  "parts",
  "materials",
  "sample",
  "production",
  "costing",
  "documents",
  "history",
];

const TABS: { id: DesignModuleTab; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "parts", label: "Parts", icon: Layers },
  { id: "materials", label: "Materials (BOM)", icon: Package },
  { id: "sample", label: "Sample Development", icon: ShieldCheck },
  { id: "production", label: "Production Workflow", icon: Factory },
  { id: "costing", label: "Costing", icon: Receipt },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "history", label: "History", icon: HistoryIcon },
];

// The curated set of processes offered in the Sample Development tab —
// a subset of the full catalog, deliberately excluding gate operations
// (fabric-selection, sample-approval) that already have their own UI.
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

export const Route = createFileRoute("/designs/$code")({
  validateSearch: (search: Record<string, unknown>): { tab?: DesignModuleTab } => {
    const t = search.tab;
    return { tab: TAB_IDS.includes(t as DesignModuleTab) ? (t as DesignModuleTab) : undefined };
  },
  head: ({ params }) => ({
    meta: [{ title: `${params.code} — Fawri Lifestyle` }],
  }),
  component: DesignDetailsPage,
});

function DesignDetailsPage() {
  useRequireAuth();
  const { code } = Route.useParams();
  const { data: design, isLoading } = useDesignByCode(code);

  if (isLoading) {
    return (
      <AppShell title="Design">
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
          <Link to="/designs"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
            <ArrowRight className="h-4 w-4 rotate-180" /> Back to designs
          </Link>
        </div>
      </AppShell>
    );
  }
  return <DesignDetails key={design.id} design={design} />;
}

function DesignDetails({ design }: { design: Design }) {
  const { tab } = Route.useSearch();
  const activeTab = tab ?? "overview";

  const { data: workflows = [], isLoading: wfLoading } = useWorkflows(design.id);
  const { data: catalog = [] } = useOperationCatalog();
  const { data: bomItems = [] } = useBomItems(design.id);
  const { data: workers = [] } = useWorkers();

  const sample = workflows.find((w) => w.kind === "sample");
  const bulk = workflows.find((w) => w.kind === "bulk");
  // Auto-create a sample workflow the first time a design is opened.
  const creatingRef = useRef(false);
  useEffect(() => {
    if (wfLoading) return;
    if (sample) return;
    if (creatingRef.current) return;
    creatingRef.current = true;
    (async () => {
      await supabase.from("design_workflows").insert({ design_id: design.id, kind: "sample", locked: false });
      creatingRef.current = false;
    })();
  }, [wfLoading, sample, design.id]);

  return (
    <AppShell
      title={design.name}
      subtitle={`${design.code} · ${design.customer}`}
      action={
        <div className="flex items-center gap-2">
          <Link
            to="/designs/$code/workflow"
            params={{ code: design.code }}
            search={{ kind: (bulk ?? sample)?.kind ?? "sample" }}
            className="hidden items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-accent sm:inline-flex"
          >
            <Settings2 className="h-4 w-4" /> Configure Workflow
          </Link>
          <DesignActionsMenu design={design} />
        </div>
      }
    >
      <div className="grid gap-5">
        <Link to="/designs" className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-4 w-4 rotate-180" /> All designs
        </Link>

        {/* Tabs */}
        <div className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <Link
                key={t.id}
                to="/designs/$code"
                params={{ code: design.code }}
                search={{ tab: t.id }}
                className={
                  "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition " +
                  (isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground")
                }
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </Link>
            );
          })}
        </div>

        {wfLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === "overview" && (
              <OverviewTab design={design} sample={sample} bulk={bulk} bomItems={bomItems} catalog={catalog} />
            )}
            {activeTab === "parts" && <PartsTab design={design} />}
            {activeTab === "materials" && <MaterialsTab design={design} bomItems={bomItems} />}
            {activeTab === "sample" && (
              <SampleTab design={design} sample={sample} catalog={catalog} workers={workers} />
            )}
            {activeTab === "production" && (
              <ProductionTab design={design} sample={sample} bulk={bulk} catalog={catalog} />
            )}
            {activeTab === "costing" && (
              <CostingTab design={design} sample={sample} bomItems={bomItems} catalog={catalog} />
            )}
            {activeTab === "documents" && (
              <DocumentsTab design={design} sample={sample} bulk={bulk} />
            )}
            {activeTab === "history" && (
              <HistoryTab design={design} sample={sample} bulk={bulk} catalog={catalog} />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

/* ============================== Overview ============================== */

function OverviewTab({
  design,
  sample,
  bulk,
  bomItems,
  catalog,
}: {
  design: Design;
  sample: DesignWorkflow | undefined;
  bulk: DesignWorkflow | undefined;
  bomItems: BomItem[];
  catalog: CatalogOperation[];
}) {
  const active = bulk ?? sample;
  const total = active?.steps.length ?? 0;
  const done = active?.steps.filter((s) => s.status === "completed").length ?? 0;
  const progress = total ? Math.round((done / total) * 100) : 0;

  const cost = getSampleCost(bomItems, sample, catalog);
  const margin = estMarginPct(design.targetCostPerPiece, cost.total);

  return (
    <div className="grid gap-5">
      <section className="grid gap-5 overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:grid-cols-[minmax(0,1fr)_1.2fr]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-primary-soft">
          <DesignImage path={design.imagePath} alt={design.name} />
          <div className="absolute left-3 top-3 rounded-lg bg-background/90 px-2 py-1 text-xs font-bold tracking-wider backdrop-blur">
            {design.code}
          </div>
          <span className={"absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur " + STATUS_TONE[design.status]}>
            {STATUS_LABEL[design.status]}
          </span>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Production Status</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{design.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              For <span className="font-semibold text-foreground">{design.customer}</span>
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-gradient-to-br from-primary-soft to-background p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{bulk ? "Bulk progress" : "Sample progress"}</span>
              <span className="text-lg font-extrabold text-primary">{progress}%</span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-background">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{done} of {total} steps complete</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Fact icon={Users} label="Customer" value={design.customer} />
            <Fact icon={Factory} label="Order Qty" value={design.orderQuantity.toLocaleString()} />
            <Fact icon={Layers} label="Fabrics" value={design.parts.map((p) => p.fabric).filter(Boolean).join(", ") || "—"} />
            <Fact icon={Palette} label="Color" value={design.color || "—"} />
            <Fact icon={CalendarDays} label="Created" value={formatDate(design.createdAt)} />
            <Fact icon={User} label="Designer" value={design.assignedDesigner || "Unassigned"} />
            <Fact icon={Receipt} label="Target Cost / Pc" value={design.targetCostPerPiece > 0 ? `₹${design.targetCostPerPiece.toLocaleString()}` : "—"} />
            <Fact icon={Receipt} label="Est. Margin %" value={design.targetCostPerPiece > 0 ? `${margin}%` : "—"} />
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/designs/$code"
          params={{ code: design.code }}
          search={{ tab: "sample" }}
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/40"
        >
          <span className="text-sm font-bold">Sample Development</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link
          to="/designs/$code"
          params={{ code: design.code }}
          search={{ tab: "production" }}
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/40"
        >
          <span className="text-sm font-bold">Production Workflow</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}

/* ================================ Parts ================================ */

function PartsTab({ design }: { design: Design }) {
  if (design.parts.length === 0) {
    return <EmptyState label="No garment parts yet. Edit this design to add parts." />;
  }
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">Garment Parts</h3>
        <p className="text-xs text-muted-foreground">Edit via the Edit button above</p>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {design.parts.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3">
            <span
              className="h-6 w-6 shrink-0 rounded-full border border-border"
              style={{ backgroundColor: swatchColor(p.color) }}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {p.fabric || "—"} {p.color ? `· ${p.color}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ============================== Materials ============================== */

type PartRow = {
  partId: string;
  name: string;
  fabric: string;
  color: string;
  bomId: string | null;
  consumption: number;
  unit: string;
  rate: number;
};

function MaterialsTab({ design, bomItems }: { design: Design; bomItems: BomItem[] }) {
  const upsert = useUpsertBomItem(design.id);
  const del = useDeleteBomItem(design.id);

  const [partRows, setPartRows] = useState<PartRow[]>([]);
  const [accessories, setAccessories] = useState<BomItem[]>([]);

  useEffect(() => {
    setPartRows(
      design.parts.map((p) => {
        const existing = bomItems.find((b) => b.kind === "part" && b.partId === p.id);
        return {
          partId: p.id,
          name: p.name,
          fabric: p.fabric,
          color: p.color,
          bomId: existing?.id ?? null,
          consumption: existing?.consumption ?? 0,
          unit: existing?.unit ?? "Mtr",
          rate: existing?.rate ?? 0,
        };
      }),
    );
    setAccessories(bomItems.filter((b) => b.kind === "accessory").map((b) => ({ ...b })));
  }, [bomItems, design.parts]);

  function updatePart(partId: string, patch: Partial<PartRow>) {
    setPartRows((rows) => rows.map((r) => (r.partId === partId ? { ...r, ...patch } : r)));
  }
  function commitPart(row: PartRow) {
    upsert.mutate({
      id: row.bomId ?? undefined,
      kind: "part",
      partId: row.partId,
      name: row.name,
      color: row.color,
      consumption: row.consumption,
      unit: row.unit,
      rate: row.rate,
      sequence: 0,
    });
  }
  function updateAccessory(id: string, patch: Partial<BomItem>) {
    setAccessories((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function commitAccessory(row: BomItem) {
    upsert.mutate({
      id: row.id,
      kind: "accessory",
      partId: null,
      name: row.name,
      color: row.color,
      consumption: row.consumption,
      unit: row.unit,
      rate: row.rate,
      sequence: row.sequence,
    });
  }
  function addAccessory() {
    upsert.mutate({
      kind: "accessory",
      partId: null,
      name: "New Accessory",
      color: "",
      consumption: 1,
      unit: "Pcs",
      rate: 0,
      sequence: accessories.length,
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-base font-bold">Materials (BOM)</h3>
        {partRows.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Add garment parts on the design to start material selection.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {partRows.map((row) => (
              <li key={row.partId} className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-background p-3 sm:grid-cols-4">
                <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                  <span className="h-4 w-4 shrink-0 rounded-full border border-border" style={{ backgroundColor: swatchColor(row.color) }} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{row.name} {row.fabric ? `(${row.fabric})` : ""}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.color || "—"}</p>
                  </div>
                </div>
                <NumField label={`Consumption (${row.unit})`} value={row.consumption}
                  onChange={(v) => updatePart(row.partId, { consumption: v })}
                  onBlur={() => commitPart(partRows.find((r) => r.partId === row.partId)!)} />
                <NumField label={`Rate / ${row.unit}`} value={row.rate} prefix="₹"
                  onChange={(v) => updatePart(row.partId, { rate: v })}
                  onBlur={() => commitPart(partRows.find((r) => r.partId === row.partId)!)} />
                <div className="flex items-end justify-end text-sm font-bold text-primary">
                  ₹{(row.consumption * row.rate).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Accessories</h3>
          <button onClick={addAccessory} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90">
            + Add
          </button>
        </div>
        {accessories.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No accessories added yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {accessories.map((row) => (
              <li key={row.id} className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-background p-3 sm:grid-cols-5">
                <input value={row.name} onChange={(e) => updateAccessory(row.id, { name: e.target.value })}
                  onBlur={() => commitAccessory(accessories.find((r) => r.id === row.id)!)}
                  placeholder="Name" className="col-span-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm font-semibold outline-none focus:border-primary sm:col-span-1" />
                <input value={row.color} onChange={(e) => updateAccessory(row.id, { color: e.target.value })}
                  onBlur={() => commitAccessory(accessories.find((r) => r.id === row.id)!)}
                  placeholder="Color" className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm outline-none focus:border-primary" />
                <NumField label={`Qty (${row.unit})`} value={row.consumption}
                  onChange={(v) => updateAccessory(row.id, { consumption: v })}
                  onBlur={() => commitAccessory(accessories.find((r) => r.id === row.id)!)} />
                <NumField label="Rate" value={row.rate} prefix="₹"
                  onChange={(v) => updateAccessory(row.id, { rate: v })}
                  onBlur={() => commitAccessory(accessories.find((r) => r.id === row.id)!)} />
                <button aria-label="Remove accessory" onClick={() => del.mutate(row.id)} className="flex items-center justify-end text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ========================== Sample Development ========================== */

function SampleTab({
  design,
  sample,
  catalog,
  workers,
}: {
  design: Design;
  sample: DesignWorkflow | undefined;
  catalog: CatalogOperation[];
  workers: Worker[];
}) {
  const addStep = useAddStep(design.id);
  const approve = useApproveSample(design.id);
  const reject = useRejectSample(design.id);
  const [notes, setNotes] = useState("");
  const [picking, setPicking] = useState(false);

  if (!sample) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const steps = sample.steps;
  const currentIdx = steps.findIndex((s) => s.status !== "completed" && s.status !== "skipped");
  const sampleComplete = steps.length > 0 && currentIdx === -1;
  const options = NEXT_PROCESS_IDS.map((id) => catalog.find((o) => o.id === id)).filter((o): o is CatalogOperation => !!o);

  async function addProcess(operationId: string) {
    await addStep.mutateAsync({ workflowId: sample!.id, operationId, sequence: steps.length + 1 });
    setPicking(false);
  }

  return (
    <div className="grid gap-5">
      {sample.locked ? (
        <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-sm font-semibold text-success">
          Sample workflow is locked (approved).
        </div>
      ) : design.status === "sample_rejected" ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <p className="font-semibold text-destructive">Sample was rejected.</p>
          {sample.approvalNotes && <p className="mt-1 text-muted-foreground">{sample.approvalNotes}</p>}
        </div>
      ) : null}

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Process Steps</h3>
          {!sample.locked && (
            <button onClick={() => setPicking((v) => !v)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90">
              + Add Process
            </button>
          )}
        </div>

        {picking && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {options.map((op) => {
              const Icon = op.icon;
              return (
                <button key={op.id} disabled={addStep.isPending} onClick={() => addProcess(op.id)}
                  className="flex flex-col items-start gap-1.5 rounded-xl border border-border bg-background p-3 text-left hover:border-primary/40 disabled:opacity-50">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold">{op.short}</span>
                  <span className="text-[10px] text-muted-foreground">{op.department}</span>
                </button>
              );
            })}
          </div>
        )}

        {steps.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
            No process steps yet. Tap "+ Add Process" to add the first one.
          </p>
        ) : (
          <ol className="mt-4 grid gap-2">
            {steps.map((step, i) => (
              <SampleStepRow
                key={step.id}
                designId={design.id}
                step={step}
                allSteps={steps}
                op={catalog.find((o) => o.id === step.operationId)}
                workers={workers}
                isCurrent={i === currentIdx}
                locked={sample.locked}
              />
            ))}
          </ol>
        )}
      </section>

      {sampleComplete && !sample.locked && design.status !== "sample_rejected" && (
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold">
            <ShieldCheck className="h-4 w-4 text-primary" /> Ready for Approval
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="Approval notes (optional)…"
            className="mt-3 w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button disabled={reject.isPending || approve.isPending} onClick={() => reject.mutate(notes || undefined)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-background px-4 py-2.5 text-sm font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50">
              {reject.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Reject
            </button>
            <button disabled={approve.isPending || reject.isPending} onClick={() => approve.mutate(notes || undefined)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-105 disabled:opacity-50">
              {approve.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Approve Sample
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function SampleStepRow({
  designId,
  step,
  allSteps,
  op,
  workers,
  isCurrent,
  locked,
}: {
  designId: string;
  step: WorkflowStep;
  allSteps: WorkflowStep[];
  op: CatalogOperation | undefined;
  workers: Worker[];
  isCurrent: boolean;
  locked: boolean;
}) {
  const opName = op?.name ?? step.operationId;
  const label = stepLabel(step, allSteps, opName);
  const done = step.status === "completed" || step.status === "skipped";

  if (!isCurrent || locked || done) {
    const assignedWorker = workers.find((w) => w.id === step.assignedWorkerId);
    return (
      <li className={"flex items-center gap-3 rounded-2xl border p-3 " + tone(step.status)}>
        <div className={"grid h-9 w-9 shrink-0 place-items-center rounded-xl " + chip(step.status)}>
          {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{label}</p>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {statusLabel(step.status)}
            {(assignedWorker?.name ?? step.assignedTo) ? ` · ${assignedWorker?.name ?? step.assignedTo}` : ""}
          </p>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-2xl border border-primary bg-primary/5 p-4">
      <p className="text-sm font-bold">{label}</p>
      {step.status === "pending" && <AssignAndStart designId={designId} step={step} workers={workers} />}
      {step.status === "in-progress" && <WorkInProgress designId={designId} step={step} worker={workers.find((w) => w.id === step.assignedWorkerId)} />}
    </li>
  );
}

function AssignAndStart({ designId, step, workers }: { designId: string; step: WorkflowStep; workers: Worker[] }) {
  const update = useUpdateStep(designId);
  const [workerId, setWorkerId] = useState(step.assignedWorkerId ?? "");
  const [notes, setNotes] = useState(step.remarks ?? "");
  const [uploading, setUploading] = useState(false);
  const worker = workers.find((w) => w.id === workerId);
  const hourly = worker ? hourlyRate(worker.dailyWage) : 0;

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const path = `${uid}/workflow-files/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("design-images").upload(path, file, { upsert: false });
      if (error) throw error;
      update.mutate({ stepId: step.id, patch: { referenceFilePath: path, referenceFileName: file.name, referenceFileSize: file.size } });
    } finally {
      setUploading(false);
    }
  }

  async function previewFile() {
    if (!step.referenceFilePath) return;
    const { data } = await supabase.storage.from("design-images").createSignedUrl(step.referenceFilePath, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  function startWork() {
    if (!worker) return;
    update.mutate({
      stepId: step.id,
      patch: {
        assignedWorkerId: worker.id,
        assignedTo: worker.name,
        remarks: notes,
        status: "in-progress",
        startedAt: new Date().toISOString(),
        isPaused: false,
      },
    });
  }

  return (
    <div className="mt-3 grid gap-3">
      <div className="flex items-center gap-2">
        <select value={workerId} onChange={(e) => setWorkerId(e.target.value)}
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary">
          <option value="">Select a worker…</option>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.role}</option>)}
        </select>
        {worker?.phone && (
          <a href={`tel:${worker.phone}`} aria-label={`Call ${worker.name}`}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-background text-primary hover:bg-accent">
            <Phone className="h-4 w-4" />
          </a>
        )}
      </div>

      {worker && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Fact label="Daily Wage" value={`₹${worker.dailyWage.toLocaleString()}`} />
          <Fact label="Hourly Rate (Auto)" value={`₹${hourly.toFixed(2)}/hr`} />
        </div>
      )}

      {step.referenceFilePath ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-2.5">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <p className="min-w-0 flex-1 truncate text-xs font-semibold">{step.referenceFileName}</p>
          <button aria-label="Preview file" onClick={previewFile} className="text-muted-foreground hover:text-primary">
            <Eye className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background p-2.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload reference file
          <input type="file" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
        </label>
      )}

      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes…"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />

      <button disabled={!worker || update.isPending} onClick={startWork}
        className="inline-flex w-fit items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-105 disabled:opacity-50">
        {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        <Play className="h-4 w-4" /> Start Work
      </button>
    </div>
  );
}

function WorkInProgress({ designId, step, worker }: { designId: string; step: WorkflowStep; worker: Worker | undefined }) {
  const update = useUpdateStep(designId);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (step.isPaused) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [step.isPaused]);

  const startedMs = step.startedAt ? new Date(step.startedAt).getTime() : nowMs;
  const liveSeconds = step.accumulatedSeconds + (step.isPaused ? 0 : Math.max(0, Math.floor((nowMs - startedMs) / 1000)));
  const hourly = worker ? hourlyRate(worker.dailyWage) : 0;
  const laborCost = (liveSeconds / 3600) * hourly;

  function pause() {
    update.mutate({ stepId: step.id, patch: { isPaused: true, accumulatedSeconds: liveSeconds } });
  }
  function resume() {
    update.mutate({ stepId: step.id, patch: { isPaused: false, startedAt: new Date().toISOString() } });
  }
  function complete() {
    update.mutate({
      stepId: step.id,
      patch: { status: "completed", completedAt: new Date().toISOString(), accumulatedSeconds: liveSeconds, isPaused: false, costPerPiece: laborCost },
    });
  }

  return (
    <div className="mt-3 grid gap-3">
      <div className="grid place-items-center gap-1 rounded-2xl bg-background p-4 text-center">
        <p className="text-3xl font-extrabold tabular-nums tracking-tight text-primary">{formatDuration(liveSeconds)}</p>
        <p className="text-[11px] text-muted-foreground">
          {step.isPaused ? "Paused" : `Started at ${step.startedAt ? formatTime(step.startedAt) : "—"}`}
        </p>
      </div>
      <div className="flex gap-2">
        {step.isPaused ? (
          <button onClick={resume} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90">
            <Play className="h-4 w-4" /> Resume
          </button>
        ) : (
          <button onClick={pause} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-bold hover:bg-accent">
            <Pause className="h-4 w-4" /> Pause
          </button>
        )}
        <button onClick={complete} className="inline-flex items-center gap-2 rounded-xl bg-success px-4 py-2 text-sm font-bold text-white hover:opacity-90">
          <CheckCircle2 className="h-4 w-4" /> Complete
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">Labor Cost (Approx.): ₹{laborCost.toFixed(2)}</p>
    </div>
  );
}

/* ========================== Production Workflow ========================== */

function ProductionTab({
  design,
  sample,
  bulk,
  catalog,
}: {
  design: Design;
  sample: DesignWorkflow | undefined;
  bulk: DesignWorkflow | undefined;
  catalog: CatalogOperation[];
}) {
  const startBulk = useStartBulkProduction(design.id);
  const sampleComplete = !!sample && sample.steps.length > 0 && sample.steps.every((s) => s.status === "completed" || s.status === "skipped");

  if (!bulk) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {sample?.locked
            ? "No bulk workflow yet."
            : "Approve the sample first to generate a bulk production workflow."}
        </p>
        {!sample?.locked && (
          <Link to="/designs/$code" params={{ code: design.code }} search={{ tab: "sample" }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
            Go to Sample Development <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold">
          <WorkflowIcon className="h-4 w-4 text-primary" /> Bulk production
          {bulk.poNumber && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">{bulk.poNumber}</span>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {bulk.locked ? "Bulk workflow is locked — production has started." : "Edit the bulk workflow, then start production to lock the plan."}
        </p>
        <button disabled={bulk.locked || startBulk.isPending} onClick={() => startBulk.mutate()}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50">
          {startBulk.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {bulk.locked ? "Production started" : "Start Bulk Production"}
        </button>
      </section>

      <WorkflowCard title="Bulk Production Workflow" wf={bulk} designCode={design.code} catalog={catalog} />
    </div>
  );
}

function WorkflowCard({ title, wf, designCode, catalog }: { title: string; wf: DesignWorkflow; designCode: string; catalog: CatalogOperation[] }) {
  const opBy = new Map(catalog.map((o) => [o.id, o]));
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">{title}</h3>
          <p className="text-xs text-muted-foreground">{wf.steps.length} steps · {wf.locked ? "Locked" : "Editable"}</p>
        </div>
        {!wf.locked && (
          <Link to="/designs/$code/workflow" params={{ code: designCode }} search={{ kind: wf.kind }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent">
            <Pencil className="h-3.5 w-3.5" /> Configure
          </Link>
        )}
      </div>
      {wf.steps.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
          No steps yet. Configure the workflow to add operations.
        </p>
      ) : (
        <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {wf.steps.map((step) => {
            const op = opBy.get(step.operationId);
            const Icon = op?.icon;
            const label = stepLabel(step, wf.steps, op?.name ?? step.operationId);
            return (
              <li key={step.id} className={"flex items-center gap-3 rounded-2xl border p-3 " + tone(step.status)}>
                <div className={"grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-bold " + chip(step.status)}>
                  {Icon ? <Icon className="h-4 w-4" /> : step.sequence}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    <span className="mr-1 text-muted-foreground">{step.sequence}.</span>{label}
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {statusLabel(step.status)}{step.assignedTo ? ` · ${step.assignedTo}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/* ================================ Costing ================================ */

function CostingTab({
  design,
  sample,
  bomItems,
  catalog,
}: {
  design: Design;
  sample: DesignWorkflow | undefined;
  bomItems: BomItem[];
  catalog: CatalogOperation[];
}) {
  const updateOtherCharges = useUpdateOtherCharges(design.id);
  const cost = getSampleCost(bomItems, sample, catalog);
  const margin = estMarginPct(design.targetCostPerPiece, cost.total);
  const [otherCharges, setOtherCharges] = useState(0);

  useEffect(() => setOtherCharges(sample?.otherCharges ?? 0), [sample?.otherCharges]);

  function commit() {
    if (!sample) return;
    updateOtherCharges.mutate({ workflowId: sample.id, otherCharges });
  }

  const total = cost.materialCost + cost.departmentLines.reduce((s, l) => s + l.amount, 0) + otherCharges;

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-base font-bold">Cost Breakdown (Per Pc)</h3>
        <ul className="mt-3 divide-y divide-border">
          <CostRow label="Material Cost" amount={cost.materialCost} />
          {cost.departmentLines.map((line) => <CostRow key={line.label} label={line.label} amount={line.amount} />)}
          <li className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm font-semibold">Other Charges</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">₹</span>
              <input type="number" min={0} value={otherCharges || ""} onChange={(e) => setOtherCharges(Math.max(0, Number(e.target.value) || 0))}
                onBlur={commit} className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-right text-sm font-semibold outline-none focus:border-primary" />
            </div>
          </li>
        </ul>
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-primary-soft px-4 py-3">
          <span className="text-sm font-bold">Total Sample Cost (Approx.)</span>
          <span className="text-lg font-extrabold text-primary">₹{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Fact label="Target Cost / Pc" value={design.targetCostPerPiece > 0 ? `₹${design.targetCostPerPiece.toLocaleString()}` : "—"} />
        <Fact label="Est. Margin %" value={design.targetCostPerPiece > 0 ? `${margin}%` : "—"} />
      </section>
    </div>
  );
}

function CostRow({ label, amount }: { label: string; amount: number }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-sm font-bold">₹{amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
    </li>
  );
}

/* =============================== Documents =============================== */

function DocumentsTab({ design, sample, bulk }: { design: Design; sample: DesignWorkflow | undefined; bulk: DesignWorkflow | undefined }) {
  const files = [...(sample?.steps ?? []), ...(bulk?.steps ?? [])].filter((s) => s.referenceFilePath);

  async function preview(path: string) {
    const { data } = await supabase.storage.from("design-images").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-base font-bold">Design Cover Image</h3>
        <div className="mt-3 aspect-[4/3] max-w-xs overflow-hidden rounded-2xl bg-primary-soft">
          <DesignImage path={design.imagePath} alt={design.name} />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-base font-bold">Reference Files</h3>
        {files.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No reference files uploaded yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {files.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3">
                <FileText className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.referenceFileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.referenceFileSize ? `${(s.referenceFileSize / 1024 / 1024).toFixed(1)} MB` : ""}
                  </p>
                </div>
                <button aria-label="Preview" onClick={() => preview(s.referenceFilePath!)} className="text-muted-foreground hover:text-primary">
                  <Eye className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ================================ History ================================ */

type HistoryEvent = { at: string; label: string; icon: LucideIcon };

function HistoryTab({
  design,
  sample,
  bulk,
  catalog,
}: {
  design: Design;
  sample: DesignWorkflow | undefined;
  bulk: DesignWorkflow | undefined;
  catalog: CatalogOperation[];
}) {
  const opBy = new Map(catalog.map((o) => [o.id, o]));
  const events: HistoryEvent[] = [];

  events.push({ at: design.createdAt, label: "Design created", icon: Circle });
  if (design.updatedAt && design.updatedAt !== design.createdAt) {
    events.push({ at: design.updatedAt, label: "Design updated", icon: Pencil });
  }
  if (sample) {
    for (const s of sample.steps) {
      if (s.completedAt) {
        const name = opBy.get(s.operationId)?.name ?? s.operationId;
        events.push({ at: s.completedAt, label: `${name} completed`, icon: CheckCircle2 });
      }
    }
    if (sample.locked) events.push({ at: design.updatedAt, label: "Sample approved", icon: ShieldCheck });
  }
  if (design.status === "sample_rejected" && sample?.approvalNotes) {
    events.push({ at: design.updatedAt, label: `Sample rejected — ${sample.approvalNotes}`, icon: Circle });
  }
  if (bulk) {
    events.push({ at: bulk.createdAt, label: `Production order ${bulk.poNumber ?? ""} created`, icon: Factory });
    for (const s of bulk.steps) {
      if (s.completedAt) {
        const name = opBy.get(s.operationId)?.name ?? s.operationId;
        events.push({ at: s.completedAt, label: `${name} completed`, icon: CheckCircle2 });
      }
    }
  }

  events.sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-base font-bold">History</h3>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No history yet.</p>
      ) : (
        <ol className="mt-4 space-y-4">
          {events.map((e, i) => {
            const Icon = e.icon;
            return (
              <li key={i} className="flex items-start gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{e.label}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(e.at)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/* ================================ Shared ================================ */

function tone(s: StepStatus) {
  if (s === "completed") return "border-primary/30 bg-primary-soft";
  if (s === "in-progress") return "border-primary bg-primary/10";
  if (s === "skipped") return "border-dashed border-border bg-background opacity-60";
  return "border-border bg-background";
}
function chip(s: StepStatus) {
  if (s === "completed") return "bg-primary text-primary-foreground";
  if (s === "in-progress") return "bg-primary text-primary-foreground ring-4 ring-primary/20";
  if (s === "skipped") return "bg-muted text-muted-foreground line-through";
  return "bg-muted text-muted-foreground";
}
function statusLabel(s: StepStatus) {
  return s === "in-progress" ? "In progress" : s.charAt(0).toUpperCase() + s.slice(1);
}

function Fact({ icon: Icon, label, value }: { icon?: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </div>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function NumField({ label, value, prefix, onChange, onBlur }: { label: string; value: number; prefix?: string; onChange: (v: number) => void; onBlur: () => void }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
        <input type="number" min={0} value={value || ""} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} onBlur={onBlur}
          className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-sm font-semibold outline-none focus:border-primary" />
      </div>
    </label>
  );
}

function swatchColor(name: string): string {
  const known: Record<string, string> = {
    black: "#111827", white: "#f9fafb", ivory: "#fffff0", red: "#dc2626",
    blue: "#2563eb", green: "#16a34a", pink: "#ec4899", gold: "#ca8a04", beige: "#e8dcc8",
  };
  return known[name.trim().toLowerCase()] ?? "#d4d4d8";
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
