import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  FileCheck2,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Scissors,
  Sparkles,
  Trash2,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { DesignImage } from "@/components/DesignImage";
import { WorkAreaDialog, formatWorkArea, type WorkAreaPayload } from "@/components/WorkAreaDialog";
import { Switch } from "@/components/ui/switch";
import { useRequireAuth, useSession } from "@/hooks/use-auth";
import { useDesignByCode } from "@/lib/api/designs";
import { useAddOperation, useOperationCatalog, type CatalogOperation } from "@/lib/api/operations";
import {
  useAddStep,
  useApproveSample,
  useDeleteStep,
  useUpdateStep,
  useWorkflows,
  type StepStatus,
  type WorkflowStep,
} from "@/lib/api/workflows";
import { useSampleApprovals, useRecordApproval, type SampleApproval } from "@/lib/api/approvals";


import {
  useAddDesignMaterial,
  useDesignMaterials,
  useMaterials,
  useRemoveDesignMaterial,
  useUpdateDesignMaterial,
  type DesignMaterial,
  type Material,
} from "@/lib/api/materials";
import { supabase } from "@/integrations/supabase/client";
import type { Design } from "@/lib/designs";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/designs";

export const Route = createFileRoute("/sample-development/$code")({
  head: ({ params }) => ({
    meta: [{ title: `Sample · ${params.code} — Fawri Lifestyle` }],
  }),
  component: DesignSamplePage,
});

type TabId = "status" | "materials" | "making" | "costing" | "approval";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "status", label: "Sample Status", icon: Sparkles },
  { id: "materials", label: "Material Selection", icon: Layers },
  { id: "making", label: "Sample Making", icon: Scissors },
  { id: "costing", label: "Costing", icon: Coins },
  { id: "approval", label: "Approval", icon: FileCheck2 },
];

const MANDATORY_APPROVAL_ROLES = ["Designer", "Merchandiser", "Production Head"] as const;
type ApprovalRoleName = (typeof MANDATORY_APPROVAL_ROLES)[number];

const SAMPLE_STAGES: { id: string; label: string }[] = [
  { id: "sample-created", label: "Sample Created" },
  { id: "material-selection", label: "Material Selection" },
  { id: "sample-making", label: "Sample Making" },
  { id: "costing", label: "Costing" },
  { id: "approval", label: "Approval" },
  { id: "ready-for-production", label: "Ready for Production" },
  { id: "production", label: "Production" },
];

function computeStageIndex(
  design: Design,
  sample: DesignWorkflow | undefined,
  approvals: SampleApproval[]
): number {
  if (design.status === "in_production" || design.status === "completed") return 6;
  if (design.status === "sample_approved") return 5;

  const approvedRoles = new Set(approvals.map((a) => a.role));
  const allApproved = MANDATORY_APPROVAL_ROLES.every((r) => approvedRoles.has(r));
  if (allApproved) return 5;

  const steps = sample?.steps.filter((s) => s.status !== "deleted") ?? [];
  const allStepsDone = steps.length > 0 && steps.every((s) => s.status === "completed" || s.status === "skipped");

  if (allStepsDone || approvals.length > 0) return 4;

  const materialStep = steps.find((s) => s.operationId === "material-selection");
  const materialDone = materialStep?.status === "completed" || materialStep?.status === "skipped";

  const makingSteps = steps.filter((s) => s.operationId === "sample-making");
  const anyMakingActive = makingSteps.some((s) => s.status === "in-progress" || s.status === "completed");
  const allMakingDone = makingSteps.length > 0 && makingSteps.every((s) => s.status === "completed" || s.status === "skipped");

  if (allMakingDone) return 3;
  if (anyMakingActive) return 2;
  if (materialDone) return 2;
  if (materialStep || steps.length > 0) return 1;

  return 0;
}

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

  // Remount the whole subtree per design so each panel's local state
  // (materials rows, costing, approvals, active tab) starts fresh instead
  // of carrying over stale data keyed by the previous design's part ids.
  return <DesignSample key={design.id} design={design} />;
}

function DesignSample({ design }: { design: Design }) {
  const [tab, setTab] = useState<TabId>("status");
  const { data: workflows, isLoading: wfLoading } = useWorkflows(design.id);
  const sample = workflows?.find((w) => w.kind === "sample");
  const bulk = workflows?.find((w) => w.kind === "bulk");
  const qc = useQueryClient();
  const creatingRef = useRef(false);

  // Auto-create an empty sample workflow container when the design has none
  // yet, so "+ Add Process" always has somewhere to attach steps. Sample
  // Making is an execution screen, not a workflow builder — no default
  // operations are seeded; the Production Manager adds only what the real
  // factory situation calls for.
  useEffect(() => {
    if (wfLoading || !workflows) return;
    if (bulk || sample) return;
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
  }, [wfLoading, workflows, sample, bulk, design.id, qc]);

  const auditableSteps = sample?.steps.filter((s) => s.status !== "deleted") ?? [];
  const stage: "In Development" | "Ready for Review" | "Approved" = bulk
    ? "Approved"
    : auditableSteps.length > 0 && auditableSteps.every((s) => s.status === "completed" || s.status === "skipped")
      ? "Ready for Review"
      : "In Development";

  return (
    <AppShell
      title={`Sample · ${design.name}`}
      subtitle={`${design.code} · ${design.customer}`}
      action={
        <Link
          to="/designs/$code"
          params={{ code: design.code }}
          aria-label="Back to design"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2.5 sm:text-sm sm:font-semibold sm:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Design</span>
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

        {/* Mockup-style summary: image hero + facts + workflow progress dots */}
        <SampleHeader design={design} stage={stage} />

        {/* Tabs */}
        <section>
          <div className="flex gap-2 overflow-x-auto border-b border-border">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={
                    "inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition " +
                    (isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground")
                  }
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="pt-5">
            {tab === "status" && <StatusPanel design={design} stage={stage} onContinue={() => setTab("materials")} />}
            {tab === "materials" && <MaterialsPanel design={design} onCompleted={() => setTab("making")} />}
            {tab === "making" && <SampleMakingPanel design={design} onContinue={() => setTab("costing")} />}
            {tab === "costing" && <CostingPanel design={design} onContinue={() => setTab("approval")} />}
            {tab === "approval" && <ApprovalPanel design={design} />}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/* ---------- Status ---------- */

function StatusPanel({ design, stage, onContinue }: { design: Design; stage: "In Development" | "Ready for Review" | "Approved"; onContinue: () => void }) {
  const steps: { id: string; label: string; icon: LucideIcon }[] = [
    { id: "Requested", label: "Requested", icon: Sparkles },
    { id: "In Development", label: "In Development", icon: Clock },
    { id: "Ready for Review", label: "Ready for Review", icon: FileCheck2 },
    { id: "Approved", label: "Approved", icon: CheckCircle2 },
  ];
  const currentIdx = steps.findIndex((s) => s.id === stage);
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">Sample lifecycle</h3>
        <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">{stage}</span>
      </div>
      <ol className="mt-5 space-y-4">
        {steps.map((step, i) => {
          const done = i < currentIdx || stage === "Approved";
          const current = i === currentIdx && stage !== "Approved";
          const Icon = step.icon;
          return (
            <li key={step.id} className="flex items-start gap-3">
              <div
                className={
                  "grid h-9 w-9 shrink-0 place-items-center rounded-xl " +
                  (done
                    ? "bg-primary text-primary-foreground"
                    : current
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground")
                }
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{step.label}</p>
                <p className="text-xs text-muted-foreground">
                  {done ? "Completed" : current ? "In progress" : "Pending"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {design.notes && (
        <div className="mt-5 rounded-2xl border border-border bg-background p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Notes</p>
          <p className="mt-1 text-sm">{design.notes}</p>
        </div>
      )}

      <button
        onClick={onContinue}
        className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
      >
        Continue to Material Selection <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ---------- Materials (Inventory-driven selection) ---------- */
//
// Material Selection ONLY selects materials from the shared Inventory Master
// (`/inventory`). Users pick an existing material, enter a quantity, and the
// unit + cost per unit are loaded from inventory automatically. Amount is
// computed as quantity × rate. The `rate` stored on `design_materials` is a
// snapshot of the material's current `cost_per_unit` at the moment of
// selection so historical samples stay stable even when inventory prices
// change; refreshing a row re-snaps the current inventory price. Selections
// persist in `design_materials` and drive the Costing tab.

const MATERIAL_GROUPS = ["Top", "Pant", "Shawl", "Lining", "Lace", "Accessories", "Other"] as const;
type MaterialGroupName = (typeof MATERIAL_GROUPS)[number];

export function computeMaterialTotal(items: DesignMaterial[]): number {
  return items.reduce((s, i) => s + i.amount, 0);
}

function MaterialsPanel({ design, onCompleted }: { design: Design; onCompleted: () => void }) {
  const { data: workflows } = useWorkflows(design.id);
  const updateStep = useUpdateStep(design.id);
  const { data: inventory = [], isLoading: invLoading } = useMaterials();
  const { data: selected = [], isLoading: selLoading } = useDesignMaterials(design.id);
  const addLine = useAddDesignMaterial(design.id);
  const removeLine = useRemoveDesignMaterial(design.id);
  const updateLine = useUpdateDesignMaterial(design.id);

  const [pickerFor, setPickerFor] = useState<MaterialGroupName | null>(null);

  const byGroup = MATERIAL_GROUPS.map((g) => ({
    group: g,
    rows: selected.filter((r) => r.groupName === g),
  }));
  const materialTotal = computeMaterialTotal(selected);
  const activeInventory = inventory.filter((m) => m.status === "active");

  async function handlePick(group: MaterialGroupName, material: Material, quantity: number) {
    await addLine.mutateAsync({
      materialId: material.id,
      groupName: group,
      quantity,
      rate: material.costPerUnit,
    });
    setPickerFor(null);
  }

  async function completeMaterialSelection() {
    const sample = workflows?.find((w) => w.kind === "sample");
    const step = sample?.steps.find((s) => s.operationId === "fabric-selection");
    if (step && step.status !== "completed") {
      await updateStep.mutateAsync({ stepId: step.id, patch: { status: "completed" } });
    }
    onCompleted();
  }

  const isLoading = invLoading || selLoading;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between rounded-2xl border border-border bg-gradient-to-br from-primary-soft to-background p-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Material total
          </p>
          <p className="mt-0.5 text-2xl font-extrabold text-primary">
            ₹{materialTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {selected.length} item{selected.length === 1 ? "" : "s"} · prices from Inventory
          </p>
        </div>
        <Link
          to="/inventory"
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-primary hover:bg-primary-soft/40"
        >
          <Layers className="h-3.5 w-3.5" /> Open Inventory
        </Link>
      </div>

      {isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        byGroup.map(({ group, rows }) => (
          <MaterialGroupSection
            key={group}
            group={group}
            rows={rows}
            onAdd={() => setPickerFor(group)}
            onRemove={(id) => removeLine.mutate(id)}
            onQuantityChange={(id, qty) => updateLine.mutate({ id, quantity: qty })}
          />
        ))
      )}

      {selected.length > 0 ? (
        <button
          onClick={completeMaterialSelection}
          disabled={updateStep.isPending}
          className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {updateStep.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Complete Material Selection & Continue
        </button>
      ) : (
        <p className="text-center text-[11px] text-muted-foreground">
          Add at least one material from Inventory to continue.
        </p>
      )}

      {pickerFor && (
        <MaterialPickerDialog
          group={pickerFor}
          inventory={activeInventory}
          onClose={() => setPickerFor(null)}
          onSelect={handlePick}
          busy={addLine.isPending}
        />
      )}
    </div>
  );
}

function MaterialGroupSection({
  group,
  rows,
  onAdd,
  onRemove,
  onQuantityChange,
}: {
  group: MaterialGroupName;
  rows: DesignMaterial[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onQuantityChange: (id: string, qty: number) => void;
}) {
  const subtotal = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-bold">{group}</p>
          <p className="text-[11px] text-muted-foreground">
            {rows.length} item{rows.length === 1 ? "" : "s"} · ₹
            {subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary-soft px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/15"
        >
          <Plus className="h-3.5 w-3.5" /> Add from Inventory
        </button>
      </div>

      {rows.length > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {rows.map((r) => (
            <MaterialLineRow
              key={r.id}
              row={r}
              onRemove={() => onRemove(r.id)}
              onQuantityChange={(qty) => onQuantityChange(r.id, qty)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function MaterialLineRow({
  row,
  onRemove,
  onQuantityChange,
}: {
  row: DesignMaterial;
  onRemove: () => void;
  onQuantityChange: (qty: number) => void;
}) {
  const [qty, setQty] = useState(row.quantity);
  useEffect(() => {
    setQty(row.quantity);
  }, [row.quantity]);
  const mat = row.material;
  const amount = qty * row.rate;

  function commitQty(next: number) {
    const clean = Math.max(0, Number(next) || 0);
    setQty(clean);
    if (clean !== row.quantity) onQuantityChange(clean);
  }

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{mat?.name ?? "Deleted material"}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {mat?.code ?? "—"} · ₹{row.rate.toFixed(2)}/{mat?.unit ?? "unit"}
          {mat && mat.availableStock < qty && (
            <span className="ml-1 rounded-full bg-warning/20 px-1.5 py-0.5 text-[10px] font-bold text-warning-foreground">
              stock {mat.availableStock}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            step={0.25}
            inputMode="decimal"
            value={qty || ""}
            onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))}
            onBlur={(e) => commitQty(Number(e.target.value))}
            className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-sm font-bold outline-none focus:border-primary"
          />
          <span className="text-[11px] text-muted-foreground">{mat?.unit ?? ""}</span>
        </div>
        <span className="w-20 text-right text-sm font-bold text-primary tabular-nums">
          ₹{amount.toFixed(2)}
        </span>
        <button
          onClick={onRemove}
          aria-label="Remove"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

function MaterialPickerDialog({
  group,
  inventory,
  onClose,
  onSelect,
  busy,
}: {
  group: MaterialGroupName;
  inventory: Material[];
  onClose: () => void;
  onSelect: (group: MaterialGroupName, material: Material, quantity: number) => void;
  busy: boolean;
}) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Material | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? inventory.filter((m) => m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
    : inventory;
  const amount = chosen ? chosen.costPerUnit * quantity : 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-foreground/40 p-0 sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5">
          <div>
            <h2 className="text-lg font-bold">Select material</h2>
            <p className="text-xs text-muted-foreground">Adding to · {group}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!chosen ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 pb-5 pt-3">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by code or name"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border">
              {filtered.length === 0 ? (
                <div className="grid place-items-center gap-2 p-8 text-center">
                  <p className="text-sm font-semibold">No materials found</p>
                  <p className="text-xs text-muted-foreground">
                    Add materials in the Inventory module first.
                  </p>
                  <Link
                    to="/inventory"
                    className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                  >
                    Open Inventory
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {filtered.map((m) => (
                    <li key={m.id}>
                      <button
                        onClick={() => setChosen(m)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{m.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {m.code} · stock {m.availableStock} {m.unit}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                          ₹{m.costPerUnit.toFixed(2)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 px-5 pb-5 pt-3">
            <div className="rounded-xl border border-border bg-primary-soft/40 p-3">
              <p className="text-sm font-bold">{chosen.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {chosen.code} · ₹{chosen.costPerUnit.toFixed(2)}/{chosen.unit} · stock{" "}
                {chosen.availableStock}
              </p>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-3">
              <label className="block min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Quantity ({chosen.unit})
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.25}
                  inputMode="decimal"
                  value={quantity || ""}
                  onChange={(e) => setQuantity(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
                />
              </label>
              <div className="pb-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">×</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Amount</p>
                <p className="text-lg font-extrabold text-primary tabular-nums">₹{amount.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setChosen(null)}
                className="rounded-xl border border-border px-3 py-2.5 text-xs font-bold text-muted-foreground hover:bg-accent"
              >
                Back
              </button>
              <button
                onClick={() => onSelect(group, chosen, quantity)}
                disabled={busy || quantity <= 0}
                className="ml-auto inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Add to sample
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CompactField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
      />
    </label>
  );
}

/* ---------- Sample Making (Operation Execution) ---------- */
//
// Pure execution screen, not a workflow builder: `workflow_steps.sequence`
// is only "the order it was added in" (for display), never an enforced
// path, and no default operations are seeded — the Production Manager
// adds only what the real factory situation calls for, via "+ Add
// Process". Every step's lifecycle is Pending -> Running -> Completed:
//
//   - Pending: shown as a compact row in the Workflow Timeline, with
//     Start / Edit / Delete (hard delete — nothing to audit yet).
//   - Running: moves out of the Timeline into Running Operations the
//     moment Start is confirmed; Pause/Resume/Cancel live behind
//     "More Actions" so Complete stays the one prominent action. More
//     than one step can be Running at once — that's just what happens
//     when a second Start happens before the first Complete, not a
//     separate "parallel" feature.
//   - Completed: moves back into the Timeline with Edit / Reopen. There
//     is no direct Delete on a completed row — deleting from inside the
//     edit dialog is a soft delete (status -> "deleted"): the row stays
//     in the Timeline, greyed out, for audit instead of disappearing.
//
// An operation can have multiple workers (assigned_to stores them as a
// comma-separated list — no schema change needed for that part). Costing
// is reachable at any time regardless of what's pending/running.
//
// workflow_steps stores start_date/end_date as calendar dates, not precise
// timestamps, so the live "Started at HH:MM" clock, ticking elapsed
// counter, and Timeline duration are tracked client-side for this viewing
// session (including pause time, subtracted from elapsed/duration). The
// persisted day-level record (who worked it, which day, remarks, done/not)
// is real; second-precision timing resets on reload.
//
// Each action here (start/pause/resume/complete/cancel/reopen/soft-delete)
// is a distinct, named function — deliberately, so a future Activity Log
// can hook into them individually without restructuring this screen.

const WORKERS = ["Ameen", "Suresh", "Fathima", "Anwar", "Vikas", "Meera"];

function parseWorkers(assignedTo: string | null): string[] {
  return (assignedTo ?? "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
}

function joinWorkers(workers: string[]): string {
  return workers.join(", ");
}

type OperationSession = {
  workers: string[];
  startedAt: Date | null;
  pausedAt: Date | null;
  pausedMs: number;
  completedAt: Date | null;
};

function emptySession(): OperationSession {
  return {
    workers: [],
    startedAt: null,
    pausedAt: null,
    pausedMs: 0,
    completedAt: null,
  };
}

function formatClock(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Live, ticking HH:MM:SS — used while an operation is actively Running.
function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(totalSeconds / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}`;
}

// Elapsed time excluding any paused stretches: frozen at pausedAt while
// paused, frozen at completedAt once done, otherwise counts up to `at`.
function elapsedMs(session: OperationSession, at: Date): number {
  if (!session.startedAt) return 0;
  const end = session.completedAt ?? session.pausedAt ?? at;
  return Math.max(0, end.getTime() - session.startedAt.getTime() - session.pausedMs);
}

function operationName(step: WorkflowStep, catalog: CatalogOperation[]): string {
  const op = catalog.find((o) => o.id === step.operationId);
  return step.label || op?.name || step.operationId;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_HOURLY_RATE = 150;

// Duration in seconds preferring persisted actuals, falling back to live session.
function stepDurationSeconds(step: WorkflowStep, session: OperationSession | undefined): number | null {
  if (step.durationSeconds != null) return step.durationSeconds;
  if (step.startedAt && step.completedAt) {
    return Math.max(0, Math.round((new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()) / 1000));
  }
  if (session?.startedAt && session?.completedAt) {
    return Math.max(0, Math.round(elapsedMs(session, session.completedAt) / 1000));
  }
  return null;
}

function stepLabourCost(step: WorkflowStep, session?: OperationSession): number {
  const secs = stepDurationSeconds(step, session);
  if (secs == null) return 0;
  const rate = step.hourlyRate || DEFAULT_HOURLY_RATE;
  return (secs / 3600) * rate;
}

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString()}`;
}

function formatIsoClock(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return formatClock(d);
}

function formatDurationSeconds(seconds: number | null): string {
  if (seconds == null) return "—";
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function SampleMakingPanel({ design, onContinue }: { design: Design; onContinue: () => void }) {
  const { data: workflows, isLoading } = useWorkflows(design.id);
  const { data: catalog = [] } = useOperationCatalog();
  const updateStep = useUpdateStep(design.id);
  const addStep = useAddStep(design.id);
  const deleteStep = useDeleteStep(design.id);
  const addOperation = useAddOperation();
  const sample = workflows?.find((w) => w.kind === "sample");
  const ordered = sample ? [...sample.steps].sort((a, b) => a.sequence - b.sequence) : [];

  const [sessions, setSessions] = useState<Record<string, OperationSession>>({});
  const [, forceTick] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Newly picked process, waiting on the Start Operation popup — nothing is
  // saved as a workflow step until Start Operation is confirmed here, so
  // Cancel simply forgets this and nothing is created.
  const [newProcess, setNewProcess] = useState<{ operationId: string; name: string } | null>(null);

  // Re-render every second so elapsed-time counters keep ticking.
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Any step already "in-progress" (from an earlier visit) resumes timing
  // from when this screen opened rather than showing a fabricated figure.
  useEffect(() => {
    setSessions((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const s of ordered) {
        if (s.status === "in-progress" && !next[s.id]?.startedAt) {
          next[s.id] = {
            ...(next[s.id] ?? emptySession()),
            workers: next[s.id]?.workers.length ? next[s.id].workers : parseWorkers(s.assignedTo),
            startedAt: s.startedAt ? new Date(s.startedAt) : new Date(),
            pausedAt: null,
            pausedMs: 0,
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [ordered]);

  function patchSession(stepId: string, patch: Partial<OperationSession>) {
    setSessions((prev) => ({ ...prev, [stepId]: { ...(prev[stepId] ?? emptySession()), ...patch } }));
  }

  function addWorker(step: WorkflowStep, worker: string) {
    const session = sessions[step.id] ?? emptySession();
    if (session.workers.includes(worker)) return;
    const workers = [...session.workers, worker];
    patchSession(step.id, { workers });
    if (step.status === "in-progress") {
      updateStep.mutate({ stepId: step.id, patch: { assignedTo: joinWorkers(workers) } });
    }
  }

  function removeWorker(step: WorkflowStep, worker: string) {
    const session = sessions[step.id] ?? emptySession();
    const workers = session.workers.filter((w) => w !== worker);
    patchSession(step.id, { workers });
    if (step.status === "in-progress") {
      updateStep.mutate({ stepId: step.id, patch: { assignedTo: joinWorkers(workers) } });
    }
  }

  function pause(step: WorkflowStep) {
    patchSession(step.id, { pausedAt: new Date() });
  }

  function resume(step: WorkflowStep) {
    const session = sessions[step.id];
    if (!session?.pausedAt) return;
    const extra = Date.now() - session.pausedAt.getTime();
    patchSession(step.id, { pausedAt: null, pausedMs: session.pausedMs + extra });
  }

  // There is no Pending list to move a cancelled operation back to, so
  // Cancel removes it entirely — same as deleting it.
  function cancel(step: WorkflowStep) {
    if (!window.confirm(`Cancel "${operationName(step, catalog)}"? This cannot be undone.`)) return;
    deleteStep.mutate(step.id);
  }

  function complete(step: WorkflowStep) {
    const session = sessions[step.id] ?? emptySession();
    const now = new Date();
    const startedAtIso = step.startedAt ?? session.startedAt?.toISOString() ?? now.toISOString();
    const durationSeconds = Math.max(
      0,
      Math.round((now.getTime() - new Date(startedAtIso).getTime() - session.pausedMs) / 1000),
    );
    patchSession(step.id, { completedAt: now, pausedAt: null });
    updateStep.mutate({
      stepId: step.id,
      patch: {
        status: "completed",
        endDate: today(),
        completedAt: now.toISOString(),
        startedAt: startedAtIso,
        durationSeconds,
      },
    });
  }

  // Reopening a completed operation puts it straight back into Running with
  // a fresh timer — there is no Pending state to return it to instead.
  function reopen(step: WorkflowStep) {
    const now = new Date();
    patchSession(step.id, { startedAt: now, pausedAt: null, pausedMs: 0, completedAt: null });
    updateStep.mutate({
      stepId: step.id,
      patch: {
        status: "in-progress",
        endDate: null,
        startedAt: now.toISOString(),
        completedAt: null,
        durationSeconds: null,
      },
    });
  }

  function removeStep(step: WorkflowStep) {
    if (!window.confirm(`Delete "${operationName(step, catalog)}"? This cannot be undone.`)) return;
    deleteStep.mutate(step.id);
  }

  function softDeleteStep(step: WorkflowStep) {
    if (
      !window.confirm(
        `Delete "${operationName(step, catalog)}" from the record? It will be marked Deleted but kept in the Workflow Timeline for audit.`,
      )
    )
      return;
    updateStep.mutate({ stepId: step.id, patch: { status: "deleted" } });
    setEditingId(null);
  }

  // Step 1, "Select Operation": picking a process never creates a Pending
  // Operation. It just remembers what was picked and opens the Start
  // Operation popup (Garment Part -> Area -> Worker) for it.
  function commitPick(operationId: string) {
    const op = catalog.find((o) => o.id === operationId);
    setNewProcess({ operationId, name: op?.name ?? operationId });
    setPickerOpen(false);
  }

  async function commitCustom(name: string) {
    const operationId = await addOperation.mutateAsync({ name });
    setNewProcess({ operationId, name });
    setPickerOpen(false);
  }

  // Creates the workflow step and starts it in one go, only once Start
  // Operation is confirmed. If the popup is cancelled instead, this never
  // runs, so nothing is ever created — it goes straight into Running.
  async function createAndStart(operationId: string, payload: WorkAreaPayload) {
    if (!sample || payload.workers.length === 0) return;
    const nextSeq = ordered.length ? Math.max(...ordered.map((s) => s.sequence)) + 1 : 1;
    const now = new Date();
    const stepId = await addStep.mutateAsync({ workflowId: sample.id, operationId, sequence: nextSeq });
    patchSession(stepId, { workers: payload.workers, startedAt: now, pausedAt: null, pausedMs: 0, completedAt: null });
    updateStep.mutate({
      stepId,
      patch: {
        status: "in-progress",
        assignedTo: joinWorkers(payload.workers),
        startDate: today(),
        startedAt: now.toISOString(),
        completedAt: null,
        durationSeconds: null,
        garmentPart: payload.garmentPart,
        workArea: payload.workArea,
        customArea: payload.customArea,
      },
    });
    setNewProcess(null);
  }

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const busy = updateStep.isPending || addStep.isPending || addOperation.isPending;
  const now = new Date();

  const running = ordered
    .filter((s) => s.status === "in-progress")
    .sort((a, b) => (sessions[a.id]?.startedAt?.getTime() ?? 0) - (sessions[b.id]?.startedAt?.getTime() ?? 0));
  const history = ordered
    .filter((s) => s.status === "completed" || s.status === "skipped" || s.status === "deleted")
    .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? "") || b.sequence - a.sequence);

  const editingStep = editingId ? ordered.find((s) => s.id === editingId) : undefined;

  return (
    <div className="grid gap-4">
      {/* The one way to add work: Select Operation -> Garment Part ->
          Area (Top only) -> Worker -> Start Operation. Goes straight into
          Running — there is no Pending Operations step in between. */}
      <button
        onClick={() => setPickerOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-bold text-primary-foreground shadow-sm hover:opacity-90"
      >
        ▶ Start Process
      </button>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Running Operations</p>
        {running.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No operations running right now.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {running.map((step) => {
              const session = sessions[step.id] ?? emptySession();
              const workers = session.workers.length ? session.workers : parseWorkers(step.assignedTo);
              return (
                <RunningOperationCard
                  key={step.id}
                  step={step}
                  catalog={catalog}
                  session={session}
                  workers={workers}
                  now={now}
                  onAddWorker={(w) => addWorker(step, w)}
                  onRemoveWorker={(w) => removeWorker(step, w)}
                  onPause={() => pause(step)}
                  onResume={() => resume(step)}
                  onComplete={() => complete(step)}
                  onCancel={() => cancel(step)}
                  busy={updateStep.isPending}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onContinue}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
        >
          Continue to Costing <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <WorkflowTimeline
        history={history}
        catalog={catalog}
        sessions={sessions}
        onEdit={setEditingId}
        onReopen={reopen}
      />

      {pickerOpen && (
        <OperationPickerModal
          title="Select Operation"
          catalog={catalog}
          busy={busy}
          onPick={commitPick}
          onCreateCustom={commitCustom}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {newProcess && (
        <WorkAreaDialog
          operationName={newProcess.name}
          workerOptions={WORKERS}
          busy={busy}
          onCancel={() => setNewProcess(null)}
          onConfirm={(payload) => createAndStart(newProcess.operationId, payload)}
        />
      )}

      {editingStep && (
        <TimelineEditModal
          step={editingStep}
          catalog={catalog}
          busy={updateStep.isPending}
          onSave={(patch) => {
            updateStep.mutate({ stepId: editingStep.id, patch });
            setEditingId(null);
          }}
          onSoftDelete={() => softDeleteStep(editingStep)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function WorkerChips({ workers, onRemove }: { workers: string[]; onRemove?: (worker: string) => void }) {
  if (workers.length === 0) {
    return <span className="text-[11px] text-muted-foreground">No workers yet</span>;
  }
  return (
    <>
      {workers.map((w) => (
        <span
          key={w}
          className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary"
        >
          ✓ {w}
          {onRemove && (
            <button
              onClick={() => onRemove(w)}
              aria-label={`Remove ${w}`}
              className="text-primary/60 hover:text-destructive"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </span>
      ))}
    </>
  );
}

function AddWorkerControl({ workers, onAdd }: { workers: string[]; onAdd: (worker: string) => void }) {
  const available = WORKERS.filter((w) => !workers.includes(w));
  if (available.length === 0) return null;
  return (
    <select
      value=""
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value);
      }}
      className="rounded-full border border-dashed border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-primary outline-none"
    >
      <option value="">+ Add Worker</option>
      {available.map((w) => (
        <option key={w} value={w}>
          {w}
        </option>
      ))}
    </select>
  );
}

function RunningOperationCard({
  step,
  catalog,
  session,
  workers,
  now,
  onAddWorker,
  onRemoveWorker,
  onPause,
  onResume,
  onComplete,
  onCancel,
  busy,
}: {
  step: WorkflowStep;
  catalog: CatalogOperation[];
  session: OperationSession;
  workers: string[];
  now: Date;
  onAddWorker: (worker: string) => void;
  onRemoveWorker: (worker: string) => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const op = catalog.find((o) => o.id === step.operationId);
  const opName = operationName(step, catalog);
  const Icon = op?.icon;
  const paused = !!session.pausedAt;

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <span aria-hidden>{paused ? "🟡" : "🟢"}</span>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
          {Icon ? <Icon className="h-4 w-4" /> : <Scissors className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-base font-extrabold tracking-tight">{opName}</h4>
          {formatWorkArea(step.garmentPart, step.workArea, step.customArea) && (
            <p className="truncate text-[11px] font-semibold text-primary">
              {formatWorkArea(step.garmentPart, step.workArea, step.customArea)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Workers</span>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <WorkerChips workers={workers} onRemove={onRemoveWorker} />
          <AddWorkerControl workers={workers} onAdd={onAddWorker} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatusTile label="Started" value={session.startedAt ? formatClock(session.startedAt) : "—"} />
        <StatusTile label="Elapsed" value={formatMs(elapsedMs(session, now))} mono />
        <StatusTile label="Status" value={paused ? "🟡 Paused" : "🟢 Running"} />
      </div>

      <div className="mt-3 flex gap-2">
        {paused && (
          <button
            onClick={onResume}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ▶ Resume
          </button>
        )}
        <button
          onClick={onComplete}
          disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-success px-4 py-3 text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}✓ Complete
        </button>
      </div>

      <div className="mt-2">
        <button
          onClick={() => setMoreOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary"
        >
          More Actions
          <ChevronDown className={"h-3 w-3 transition-transform " + (moreOpen ? "rotate-180" : "")} />
        </button>
        {moreOpen && (
          <div className="mt-1.5 flex gap-1.5">
            {!paused && (
              <button
                onClick={onPause}
                className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-accent"
              >
                ⏸ Pause
              </button>
            )}
            <button
              onClick={onCancel}
              className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/10"
            >
              ✕ Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function WorkflowTimeline({
  history,
  catalog,
  sessions,
  onEdit,
  onReopen,
}: {
  history: WorkflowStep[];
  catalog: CatalogOperation[];
  sessions: Record<string, OperationSession>;
  onEdit: (stepId: string) => void;
  onReopen: (step: WorkflowStep) => void;
}) {
  const totalLabour = history
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + stepLabourCost(s, sessions[s.id]), 0);

  if (history.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
        <p className="text-sm font-bold">Workflow Timeline</p>
        <p className="mt-2 text-sm text-muted-foreground">Completed operations will appear here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">Workflow Timeline</p>
        {totalLabour > 0 && (
          <span className="rounded-full bg-primary-soft px-3 py-1 text-[11px] font-bold text-primary">
            Total Labour · {formatCurrency(totalLabour)}
          </span>
        )}
      </div>
      <ul className="mt-3 grid gap-2">
        {history.map((step) => (
          <HistoryTimelineRow
            key={step.id}
            step={step}
            catalog={catalog}
            session={sessions[step.id]}
            onEdit={() => onEdit(step.id)}
            onReopen={() => onReopen(step)}
          />
        ))}
      </ul>
    </div>
  );
}

function HistoryTimelineRow({
  step,
  catalog,
  session,
  onEdit,
  onReopen,
}: {
  step: WorkflowStep;
  catalog: CatalogOperation[];
  session: OperationSession | undefined;
  onEdit: () => void;
  onReopen: () => void;
}) {
  const opName = operationName(step, catalog);

  if (step.status === "deleted") {
    return (
      <li className="rounded-xl border border-dashed border-border bg-muted/30 p-3 opacity-60">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold line-through">{opName}</p>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            Deleted
          </span>
        </div>
      </li>
    );
  }

  const workers = session?.workers.length ? session.workers : parseWorkers(step.assignedTo);
  const durationSecs = stepDurationSeconds(step, session);
  const duration = formatDurationSeconds(durationSecs);
  const start =
    formatIsoClock(step.startedAt) ?? (session?.startedAt ? formatClock(session.startedAt) : step.startDate || "—");
  const end =
    formatIsoClock(step.completedAt) ?? (session?.completedAt ? formatClock(session.completedAt) : step.endDate || "—");
  const isCompleted = step.status === "completed";
  const labour = isCompleted ? stepLabourCost(step, session) : 0;
  const rate = step.hourlyRate || DEFAULT_HOURLY_RATE;

  return (
    <li className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">✓ {opName}</p>
          {formatWorkArea(step.garmentPart, step.workArea, step.customArea) && (
            <p className="truncate text-[11px] font-semibold text-primary">
              {formatWorkArea(step.garmentPart, step.workArea, step.customArea)}
            </p>
          )}
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {workers.length ? `Workers: ${workers.join(", ")}` : "Unassigned"}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-4">
            <div>
              <span className="block font-semibold text-muted-foreground">Started</span>
              <span className="font-bold">{start}</span>
            </div>
            <div>
              <span className="block font-semibold text-muted-foreground">Completed</span>
              <span className="font-bold">{end}</span>
            </div>
            <div>
              <span className="block font-semibold text-muted-foreground">Duration</span>
              <span className="font-bold">{duration}</span>
            </div>
            {isCompleted && (
              <div>
                <span className="block font-semibold text-muted-foreground">Labour Cost</span>
                <span className="font-bold text-primary">
                  {formatCurrency(labour)}
                  <span className="ml-1 text-[10px] font-medium text-muted-foreground">@ ₹{rate}/hr</span>
                </span>
              </div>
            )}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
          {step.status === "skipped" ? "Skipped" : "Completed"}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1">
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent hover:text-primary"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
        <button
          onClick={onReopen}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent hover:text-primary"
        >
          <RotateCcw className="h-3 w-3" /> Reopen
        </button>
      </div>
    </li>
  );
}

function OperationPickerModal({
  title,
  catalog,
  busy,
  onPick,
  onCreateCustom,
  onClose,
}: {
  title: string;
  catalog: CatalogOperation[];
  busy: boolean;
  onPick: (operationId: string) => void;
  onCreateCustom: (name: string) => void;
  onClose: () => void;
}) {
  const [customName, setCustomName] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-foreground/40 p-0 sm:place-items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card p-4 shadow-2xl sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid gap-1.5">
          {catalog.map((op) => {
            const Icon = op.icon;
            return (
              <button
                key={op.id}
                onClick={() => onPick(op.id)}
                disabled={busy}
                className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5 text-left text-sm font-semibold hover:border-primary/40 hover:bg-primary-soft/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{op.name}</span>
                <span className="ml-auto shrink-0 text-[10px] font-medium uppercase text-muted-foreground">
                  {op.category}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Custom Process</p>
          <div className="mt-2 flex gap-2">
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customName.trim()) {
                  onCreateCustom(customName.trim());
                  setCustomName("");
                }
              }}
              placeholder="e.g. Beading, Tagging"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => {
                if (!customName.trim()) return;
                onCreateCustom(customName.trim());
                setCustomName("");
              }}
              disabled={!customName.trim() || busy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineEditModal({
  step,
  catalog,
  busy,
  onSave,
  onSoftDelete,
  onClose,
}: {
  step: WorkflowStep;
  catalog: CatalogOperation[];
  busy: boolean;
  onSave: (patch: Partial<Omit<WorkflowStep, "id" | "workflowId">>) => void;
  onSoftDelete: () => void;
  onClose: () => void;
}) {
  const [workersText, setWorkersText] = useState(parseWorkers(step.assignedTo).join(", "));
  const [status, setStatus] = useState<StepStatus>(step.status);
  const [startDate, setStartDate] = useState(step.startDate ?? "");
  const [endDate, setEndDate] = useState(step.endDate ?? "");
  const [remarks, setRemarks] = useState(step.remarks ?? "");
  const canSoftDelete = step.status === "completed" || step.status === "skipped";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-foreground/40 p-0 sm:place-items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl border border-border bg-card p-4 shadow-2xl sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="truncate text-base font-bold">Edit {operationName(step, catalog)}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid gap-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Workers (comma-separated)
            </span>
            <input
              value={workersText}
              onChange={(e) => setWorkersText(e.target.value)}
              placeholder="e.g. Ameen, Fathima"
              className="mt-1.5 w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StepStatus)}
              className="mt-1.5 w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-primary"
            >
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="skipped">Skipped</option>
              <option value="deleted">Deleted</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">End Date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Remarks</span>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
          </label>

          <button
            onClick={() =>
              onSave({
                assignedTo: workersText.trim() || null,
                status,
                startDate: startDate || null,
                endDate: endDate || null,
                remarks: remarks.trim() || null,
              })
            }
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save Changes
          </button>

          {canSoftDelete && (
            <button
              onClick={onSoftDelete}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-destructive/30 px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" /> Delete (Keep for Audit)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusTile({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={"mt-1 truncate text-sm font-bold " + (mono ? "font-mono tabular-nums" : "")}>{value}</p>
    </div>
  );
}

/* ---------- Costing ---------- */

function CostingPanel({ design, onContinue }: { design: Design; onContinue: () => void }) {
  const { data: workflows } = useWorkflows(design.id);
  const sample = workflows?.find((w) => w.kind === "sample");
  const completedSteps = (sample?.steps ?? []).filter((s) => s.status === "completed");
  // Sample Development ALWAYS costs a single piece. During sampling only one
  // physical garment is produced, so labour recorded on operations is already
  // per-piece. Material `quantity` stores consumption-per-piece × rate, so
  // that too is already per-piece. Do NOT multiply or divide by orderQuantity
  // here — that belongs to Production Costing after sample approval.
  const labourPerPiece = completedSteps.reduce((sum, s) => sum + stepLabourCost(s), 0);

  const { data: designMaterials = [] } = useDesignMaterials(design.id);
  const materialPerPiece = computeMaterialTotal(designMaterials);

  const [overheadItems, setOverheadItems] = useState<
    { id: string; label: string; amount: number }[]
  >(() => [
    { id: "oh-electricity", label: "Electricity", amount: 0 },
    { id: "oh-packing", label: "Packing", amount: 0 },
    { id: "oh-transport", label: "Transport", amount: 0 },
  ]);
  const overheadPerPiece = overheadItems.reduce((s, o) => s + (o.amount || 0), 0);

  const perPiece = materialPerPiece + labourPerPiece + overheadPerPiece;
  const projectedProductionTotal = perPiece * design.orderQuantity;

  const [openRow, setOpenRow] = useState<"material" | "overhead" | "labour" | null>("material");
  const toggle = (k: "material" | "overhead" | "labour") =>
    setOpenRow((cur) => (cur === k ? null : k));

  return (
    <div className="grid gap-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-bold">Sample Costing</p>
            <p className="text-xs text-muted-foreground">Cost of producing 1 piece</p>
          </div>
          <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            1 Piece
          </span>
        </div>

        <ul className="divide-y divide-border">
          {/* Material */}
          <CostRow
            title="Material"
            meta={`${designMaterials.length} Item${designMaterials.length === 1 ? "" : "s"}`}
            amount={materialPerPiece}
            open={openRow === "material"}
            onToggle={() => toggle("material")}
          >
            {designMaterials.length === 0 ? (
              <EmptyChild text="No materials selected." />
            ) : (
              <ul className="grid gap-2">
                {designMaterials.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {m.material?.name ?? "Material"}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {m.quantity} {m.material?.unit ?? ""} × ₹{m.rate.toFixed(2)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums">
                      {formatCurrency(m.amount)}
                    </span>
                  </li>
                ))}
                <ChildTotal label="Material Total" amount={materialPerPiece} />
              </ul>
            )}
          </CostRow>

          {/* Overhead */}
          <CostRow
            title="Overhead"
            amount={overheadPerPiece}
            open={openRow === "overhead"}
            onToggle={() => toggle("overhead")}
          >
            <ul className="grid gap-2">
              {overheadItems.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{o.label}</span>
                  <input
                    type="number"
                    min={0}
                    value={o.amount || ""}
                    onChange={(e) =>
                      setOverheadItems((prev) =>
                        prev.map((x) =>
                          x.id === o.id
                            ? { ...x, amount: Math.max(0, Number(e.target.value) || 0) }
                            : x,
                        ),
                      )
                    }
                    className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-primary"
                  />
                </li>
              ))}
              <ChildTotal label="Overhead Total" amount={overheadPerPiece} />
            </ul>
          </CostRow>

          {/* Labour */}
          <CostRow
            title="Labour"
            meta={`${completedSteps.length} Operation${completedSteps.length === 1 ? "" : "s"}`}
            amount={labourPerPiece}
            open={openRow === "labour"}
            onToggle={() => toggle("labour")}
          >
            {completedSteps.length === 0 ? (
              <EmptyChild text="No completed operations yet." />
            ) : (
              <ul className="grid gap-2">
                {completedSteps.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold">
                      {s.label || s.operationId}
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums">
                      {formatCurrency(stepLabourCost(s))}
                    </span>
                  </li>
                ))}
                <ChildTotal label="Labour Total" amount={labourPerPiece} />
              </ul>
            )}
          </CostRow>
        </ul>

        <div className="border-t-2 border-primary/20 bg-primary-soft px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">Total Sample Cost</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                1 Piece
              </p>
            </div>
            <p className="text-2xl font-extrabold tabular-nums text-primary">
              {formatCurrency(perPiece)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Production Projection
        </p>
        <p className="mt-1 text-lg font-extrabold tabular-nums">
          ₹{projectedProductionTotal.toLocaleString()}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {design.orderQuantity} pcs × ₹{perPiece.toLocaleString()}
        </p>
        <p className="mt-2 text-[11px] italic text-muted-foreground">
          Informational only. Actual production cost is calculated after sample approval when a
          Production Order is created.
        </p>
      </div>

      <button
        onClick={onContinue}
        className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
      >
        Continue to Approval <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function CostRow({
  title,
  meta,
  amount,
  open,
  onToggle,
  children,
}: {
  title: string;
  meta?: string;
  amount: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-muted/40"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronDown
            className={
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform " +
              (open ? "rotate-0" : "-rotate-90")
            }
          />
          <span className="text-sm font-bold">{title}</span>
          {meta && (
            <span className="truncate text-xs text-muted-foreground">({meta})</span>
          )}
        </div>
        <span className="shrink-0 text-sm font-extrabold tabular-nums">
          {formatCurrency(amount)}
        </span>
      </button>
      {open && (
        <div className="border-t border-dashed border-border bg-muted/20 px-4 py-3">
          {children}
        </div>
      )}
    </li>
  );
}

function ChildTotal({ label, amount }: { label: string; amount: number }) {
  return (
    <li className="mt-1 flex items-center justify-between border-t border-border pt-2">
      <span className="text-sm font-bold">{label}</span>
      <span className="text-sm font-extrabold tabular-nums text-primary">
        {formatCurrency(amount)}
      </span>
    </li>
  );
}

function EmptyChild({ text }: { text: string }) {
  return <p className="py-2 text-center text-xs text-muted-foreground">{text}</p>;
}


/* ---------- Approval ---------- */

const MANDATORY_APPROVAL_ROLES = ["Designer", "Merchandiser", "Production Head"] as const;
type ApprovalRoleName = (typeof MANDATORY_APPROVAL_ROLES)[number];

function ApprovalPanel({ design }: { design: Design }) {
  const { data: approvals = [], isLoading } = useSampleApprovals(design.id);
  const record = useRecordApproval(design.id);
  const approveSample = useApproveSample(design.id);
  const { session } = useSession();
  const autoRanRef = useRef(false);

  const currentUserName =
    (session?.user?.user_metadata?.full_name as string | undefined) ||
    (session?.user?.user_metadata?.name as string | undefined) ||
    session?.user?.email ||
    "";

  const byRole = new Map<string, (typeof approvals)[number]>(
    approvals.map((a) => [a.role, a]),
  );
  const approvedCount = MANDATORY_APPROVAL_ROLES.filter((r) => byRole.has(r)).length;
  const total = MANDATORY_APPROVAL_ROLES.length;
  const pct = Math.round((approvedCount / total) * 100);
  const allApproved = approvedCount === total;
  const sampleLocked =
    design.status === "sample_approved" ||
    design.status === "in_production" ||
    design.status === "completed";

  useEffect(() => {
    if (!allApproved || sampleLocked || autoRanRef.current) return;
    autoRanRef.current = true;
    approveSample.mutate();
  }, [allApproved, sampleLocked, approveSample]);

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary-soft to-background p-5">
        <div className="flex items-center justify-between text-sm">
          <div>
            <p className="font-bold">Approval progress</p>
            <p className="text-xs text-muted-foreground">
              {approvedCount} of {total} approvers signed off
            </p>
          </div>
          <p className="text-2xl font-extrabold text-primary">{pct}%</p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {MANDATORY_APPROVAL_ROLES.map((role) => (
            <ApprovalCard
              key={role}
              role={role}
              existing={byRole.get(role) ?? null}
              disabled={sampleLocked || record.isPending || !currentUserName}
              onApprove={() =>
                record.mutateAsync({ role, approverName: currentUserName })
              }
            />
          ))}
          <li className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 opacity-70">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Customer
                </p>
                <p className="mt-0.5 truncate text-base font-bold text-muted-foreground">
                  {design.customer}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                Coming soon
              </span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Customer approval will be enabled in a future release.
            </p>
          </li>
        </ul>
      )}

      {sampleLocked ? (
        <div className="rounded-2xl border border-success/40 bg-success/10 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-success">Sample approved · Ready for Production</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                This sample has been signed off and moved to the production queue.
              </p>
              <Link
                to="/production"
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
              >
                Open Production Queue <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      ) : allApproved ? (
        <div className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary/10 px-4 py-3.5 text-sm font-semibold text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finalising sample approval…
        </div>
      ) : (
        <p className="text-center text-[11px] text-muted-foreground">
          Awaiting {total - approvedCount} approval{total - approvedCount === 1 ? "" : "s"}. Sample moves to
          <span className="font-semibold text-foreground"> Ready for Production </span>
          automatically once all mandatory approvers sign off.
        </p>
      )}
    </div>
  );
}

function ApprovalCard({
  role,
  existing,
  disabled,
  onApprove,
}: {
  role: ApprovalRoleName;
  existing: SampleApproval | null;
  disabled: boolean;
  onApprove: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const isApproved = !!existing;

  async function submit() {
    setBusy(true);
    try {
      await onApprove();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{role}</p>
          <p className="mt-0.5 truncate text-base font-bold">
            {isApproved ? existing!.approverName : "—"}
          </p>
        </div>
        <span
          className={
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold " +
            (isApproved ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")
          }
        >
          {isApproved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          {isApproved ? "Approved" : "Pending"}
        </span>
      </div>

      {isApproved ? (
        <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">Approved by:</span>{" "}
            {existing!.approverName}
          </p>
          <p>
            <span className="font-semibold text-foreground">Approved on:</span>{" "}
            {new Date(existing!.approvedAt).toLocaleString(undefined, {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      ) : (
        <button
          onClick={submit}
          disabled={disabled || busy}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Approve
        </button>
      )}
    </li>
  );
}




/* ---------- Shared ---------- */

function SampleHeader({
  design,
  stage,
}: {
  design: Design;
  stage: "In Development" | "Ready for Review" | "Approved";
}) {
  // Mock financial + designer facts for UI-first pass.
  const targetCostPerPc = 1250;
  const estMargin = "25%";
  const designer = "Rifa";
  const createdOn = new Date(design.createdAt).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // 7-step workflow dots (per mockup). Mark step 3 as current when In Development.
  const total = 7;
  const currentIdx = stage === "Approved" ? total : stage === "Ready for Review" ? 5 : 3;

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[16/10] w-full bg-primary-soft">
        <DesignImage path={design.imagePath} alt={design.name} />
        <span
          className={
            "absolute right-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold shadow-sm " +
            STATUS_TONE[design.status]
          }
        >
          {STATUS_LABEL[design.status]}
        </span>
      </div>

      <div className="grid gap-4 p-3 sm:p-5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold tracking-widest text-muted-foreground">{design.code}</p>
          <h2 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{design.name}</h2>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Fact label="Order Qty (Planned)" value={`${design.orderQuantity.toLocaleString()} Pcs`} />
          <Fact label="Category" value={design.category || "—"} />
          <Fact label="Target Cost (Per Pc)" value={`₹${targetCostPerPc.toLocaleString()}`} />
          <Fact label="Est. Margin" value={estMargin} />
          <Fact label="Created On" value={createdOn} />
          <Fact label="Designer" value={designer} />
        </div>

        <div className="min-w-0 rounded-2xl border border-border bg-background p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-bold">Workflow Progress</p>
            <p className="shrink-0 text-[11px] font-semibold text-muted-foreground">
              Step {Math.min(currentIdx, total)} of {total}
            </p>
          </div>
          <ol className="mt-3 flex items-center gap-1 sm:gap-1.5">
            {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
              const done = n < currentIdx;
              const current = n === currentIdx;
              return (
                <li key={n} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5">
                  <span
                    className={
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-bold transition sm:h-8 sm:w-8 sm:text-[11px] " +
                      (done
                        ? "bg-primary text-primary-foreground"
                        : current
                          ? "bg-primary text-primary-foreground ring-2 ring-primary/20 sm:ring-4"
                          : "bg-muted text-muted-foreground")
                    }
                  >
                    {done ? "✓" : n}
                  </span>
                  {n < total && (
                    <span
                      className={"h-0.5 min-w-0 flex-1 rounded-full " + (n < currentIdx ? "bg-primary" : "bg-muted")}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <Link
          to="/designs/$code/workflow"
          params={{ code: design.code }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
        >
          View Workflow
        </Link>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}
