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
  Trash2,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { DesignImage } from "@/components/DesignImage";
import {
  WorkAreaDialog,
  WorkerSelectionDialog,
  formatWorkArea,
  type WorkAreaPayload,
} from "@/components/WorkAreaDialog";
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
  type DesignWorkflow,
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

type TabId = "materials" | "making" | "costing" | "approval";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "making", label: "Sample Making", icon: Scissors },
  { id: "materials", label: "Material Selection", icon: Layers },
  { id: "costing", label: "Costing", icon: Coins },
  { id: "approval", label: "Approval", icon: FileCheck2 },
];

const MANDATORY_APPROVAL_ROLES = ["Designer", "Merchandiser", "Production Head"] as const;
type ApprovalRoleName = (typeof MANDATORY_APPROVAL_ROLES)[number];

const SAMPLE_STAGES: { id: string; label: string }[] = [
  { id: "sample-created", label: "Sample Created" },
  { id: "sample-making", label: "Sample Making" },
  { id: "material-selection", label: "Material Selection" },
  { id: "costing", label: "Costing" },
  { id: "approval", label: "Approval" },
  { id: "ready-for-production", label: "Ready for Production" },
  { id: "production", label: "Production" },
];

function computeStageIndex(design: Design, sample: DesignWorkflow | undefined, approvals: SampleApproval[]): number {
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
  const allMakingDone =
    makingSteps.length > 0 && makingSteps.every((s) => s.status === "completed" || s.status === "skipped");

  // Same trigger conditions as before reordering SAMPLE_STAGES — only the
  // indices changed, to match Sample Making (now slot 1) and Material
  // Selection (now slot 2) swapping places.
  if (allMakingDone) return 3;
  if (anyMakingActive) return 1;
  if (materialDone) return 1;
  if (materialStep || steps.length > 0) return 2;

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
  const [tab, setTab] = useState<TabId>("making");
  const { data: workflows, isLoading: wfLoading } = useWorkflows(design.id);
  const sample = workflows?.find((w) => w.kind === "sample");
  const bulk = workflows?.find((w) => w.kind === "bulk");
  const { data: approvals = [] } = useSampleApprovals(design.id);
  const stageIndex = computeStageIndex(design, sample, approvals);
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
        <SampleHeader design={design} stageIndex={stageIndex} />

        {/* Start Operation is a permanent quick action: it used to live only
            inside the Sample Making tab (and would disappear once anything
            was running), but a new operation should be startable from any
            tab without switching to Sample Making first. */}
        <StartOperationCard design={design} />

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

/* ---------- Materials (garment-part based Inventory selection) ---------- */
//
// Material Selection ONLY selects materials from the shared Inventory Master
// (`/inventory`). The screen is organised the way a tailor actually thinks
// about a sample: by garment part (Top / Pant / Shawl-Dupatta). Category
// (Primary Fabric / Lining / Accessories / Lace / Other) is asked once,
// inside the popup, when a material is added — it is never shown as a
// permanent section on the main screen, only the materials actually
// selected are. Quantity is never edited inline: tapping a saved material
// reopens the same popup, pre-filled, where it can be swapped, requantified
// or deleted. Unit + Rate always load from Inventory automatically; the
// user only ever types Quantity. Amount = Quantity × Rate. The `rate`
// stored on `design_materials` is a snapshot of the material's current
// `cost_per_unit` at the moment of selection (or re-selection) so
// historical samples stay stable even when inventory prices change later.
// Selections persist in `design_materials` and drive the Costing tab.
//
// No schema change was needed for the garment-part × category split: both
// are packed into the existing free-text `group_name` column as
// "<Garment Part>::<Category>" (buildGroupKey/parseGroupKey below). Rows
// saved before this redesign (a bare "Top"/"Lace"/etc.) are still readable
// — parseGroupKey falls back to a best-effort mapping for those instead of
// hiding them.

type GarmentPartKey = "Top" | "Pant" | "Shawl / Dupatta";
type GarmentPartDef = { key: GarmentPartKey; label: string; emoji: string };

const GARMENT_PARTS: GarmentPartDef[] = [
  { key: "Top", label: "Top", emoji: "👚" },
  { key: "Pant", label: "Pant", emoji: "👖" },
  { key: "Shawl / Dupatta", label: "Shawl / Dupatta", emoji: "🧣" },
];

const MATERIAL_CATEGORIES = ["Primary Fabric", "Lining", "Accessories", "Lace", "Other"] as const;
type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

const GROUP_KEY_SEP = "::";

function buildGroupKey(part: GarmentPartKey, category: MaterialCategory): string {
  return `${part}${GROUP_KEY_SEP}${category}`;
}

const LEGACY_PART_MAP: Record<string, GarmentPartKey> = {
  Top: "Top",
  Pant: "Pant",
  Shawl: "Shawl / Dupatta",
};
const LEGACY_CATEGORY_MAP: Record<string, MaterialCategory> = {
  Lining: "Lining",
  Lace: "Lace",
  Accessories: "Accessories",
  Other: "Other",
  "Other Materials": "Other",
};

function parseGroupKey(groupName: string): { part: GarmentPartKey; category: MaterialCategory } {
  const idx = groupName.indexOf(GROUP_KEY_SEP);
  if (idx >= 0) {
    const part = groupName.slice(0, idx);
    const category = groupName.slice(idx + GROUP_KEY_SEP.length);
    if (GARMENT_PARTS.some((p) => p.key === part) && (MATERIAL_CATEGORIES as readonly string[]).includes(category)) {
      return { part: part as GarmentPartKey, category: category as MaterialCategory };
    }
    if (GARMENT_PARTS.some((p) => p.key === part) && LEGACY_CATEGORY_MAP[category]) {
      return { part: part as GarmentPartKey, category: LEGACY_CATEGORY_MAP[category] };
    }
  }
  // Legacy row from before this redesign — best-effort mapping so nothing
  // saved earlier silently disappears from the screen.
  if (LEGACY_PART_MAP[groupName]) {
    return { part: LEGACY_PART_MAP[groupName], category: "Primary Fabric" };
  }
  if (LEGACY_CATEGORY_MAP[groupName]) {
    return { part: "Top", category: LEGACY_CATEGORY_MAP[groupName] };
  }
  return { part: "Top", category: "Other" };
}

export function computeMaterialTotal(items: DesignMaterial[]): number {
  return items.reduce((s, i) => s + i.amount, 0);
}

type PickerState = { mode: "add"; part: GarmentPartKey } | { mode: "edit"; row: DesignMaterial };

function MaterialsPanel({ design, onCompleted }: { design: Design; onCompleted: () => void }) {
  const { data: workflows } = useWorkflows(design.id);
  const updateStep = useUpdateStep(design.id);
  const { data: inventory = [], isLoading: invLoading } = useMaterials();
  const { data: selected = [], isLoading: selLoading } = useDesignMaterials(design.id);
  const addLine = useAddDesignMaterial(design.id);
  const removeLine = useRemoveDesignMaterial(design.id);
  const updateLine = useUpdateDesignMaterial(design.id);

  const [openPart, setOpenPart] = useState<GarmentPartKey | null>("Top");
  const [picker, setPicker] = useState<PickerState | null>(null);

  const byPart = GARMENT_PARTS.map((p) => ({
    part: p,
    rows: selected.filter((r) => parseGroupKey(r.groupName).part === p.key),
  }));

  const materialTotal = computeMaterialTotal(selected);
  const activeInventory = inventory.filter((m) => m.status === "active");

  // Saves — always replaces the one existing row when editing, so nothing
  // is ever duplicated. Material Total recalculates immediately because
  // both the panel and Costing read the same live design_materials data.
  async function handleSaveNew(part: GarmentPartKey, category: MaterialCategory, material: Material, quantity: number) {
    await addLine.mutateAsync({
      materialId: material.id,
      groupName: buildGroupKey(part, category),
      quantity,
      rate: material.costPerUnit,
    });
    setPicker(null);
  }

  async function handleSaveEdit(row: DesignMaterial, material: Material, quantity: number) {
    await updateLine.mutateAsync({ id: row.id, quantity, materialId: material.id, rate: material.costPerUnit });
    setPicker(null);
  }

  async function handleDelete(row: DesignMaterial) {
    await removeLine.mutateAsync(row.id);
    setPicker(null);
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
  const pickerBusy = addLine.isPending || updateLine.isPending || removeLine.isPending;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between rounded-2xl border border-border bg-gradient-to-br from-primary-soft to-background p-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Material total</p>
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
        <div className="grid gap-2">
          {byPart.map(({ part, rows }) => (
            <GarmentPartCard
              key={part.key}
              part={part}
              rows={rows}
              open={openPart === part.key}
              onToggle={() => setOpenPart((cur) => (cur === part.key ? null : part.key))}
              onAddMaterial={() => setPicker({ mode: "add", part: part.key })}
              onEditMaterial={(row) => setPicker({ mode: "edit", row })}
            />
          ))}
        </div>
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

      {picker && (
        <MaterialPickerDialog
          picker={picker}
          inventory={activeInventory}
          busy={pickerBusy}
          onClose={() => setPicker(null)}
          onSaveNew={handleSaveNew}
          onSaveEdit={handleSaveEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// Compact, collapsed by default (except Top): an emoji "illustration",
// the part name, a small item/total summary, and — only once expanded —
// the flat list of whatever's actually been selected plus one
// "+ Add Material" button. No category headers are ever shown here.
function GarmentPartCard({
  part,
  rows,
  open,
  onToggle,
  onAddMaterial,
  onEditMaterial,
}: {
  part: GarmentPartDef;
  rows: DesignMaterial[];
  open: boolean;
  onToggle: () => void;
  onAddMaterial: () => void;
  onEditMaterial: (row: DesignMaterial) => void;
}) {
  const subtotal = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-xl" aria-hidden>
          {part.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{part.label}</p>
          <p className="text-[11px] text-muted-foreground">
            {rows.length === 0
              ? "No materials yet"
              : `${rows.length} item${rows.length === 1 ? "" : "s"} · ₹${subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          </p>
        </div>
        <span
          aria-hidden
          className={
            "grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-transform " +
            (open ? "rotate-45" : "")
          }
        >
          <Plus className="h-4 w-4" />
        </span>
      </button>

      {open && (
        <div className="grid gap-2 border-t border-border p-3">
          {rows.length > 0 && (
            <ul className="grid gap-1.5">
              {rows.map((r) => (
                <SelectedMaterialRow key={r.id} row={r} onClick={() => onEditMaterial(r)} />
              ))}
            </ul>
          )}
          <button
            onClick={onAddMaterial}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-background py-2 text-xs font-semibold text-primary hover:bg-primary-soft/40"
          >
            <Plus className="h-3.5 w-3.5" /> Add Material
          </button>
        </div>
      )}
    </div>
  );
}

// Display-only — tapping it is the only way to change anything about this
// row (per the "no inline editing" rule), so the whole row is one big
// tap target that reopens the same popup, pre-filled.
function SelectedMaterialRow({ row, onClick }: { row: DesignMaterial; onClick: () => void }) {
  const mat = row.material;
  return (
    <li>
      <button
        onClick={onClick}
        className="flex w-full items-start justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2 text-left hover:bg-muted/50"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            <span className="text-muted-foreground" aria-hidden>
              •{" "}
            </span>
            {mat?.name ?? "Deleted material"}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.quantity} {mat?.unit ?? ""}
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold text-primary tabular-nums">₹{row.amount.toFixed(2)}</span>
      </button>
    </li>
  );
}

// One popup for both adding and editing.
// Add:  Step 1 — pick a Category  ->  Step 2 — search + pick a Material,
//       enter Quantity, Save.
// Edit: opens straight on Step 2 with the current material + quantity
//       filled in; "Change Material" goes back into the search list.
//       Category is fixed once a material is first added (not re-askable
//       on edit) and Delete Material is available.
function MaterialPickerDialog({
  picker,
  inventory,
  busy,
  onClose,
  onSaveNew,
  onSaveEdit,
  onDelete,
}: {
  picker: PickerState;
  inventory: Material[];
  busy: boolean;
  onClose: () => void;
  onSaveNew: (part: GarmentPartKey, category: MaterialCategory, material: Material, quantity: number) => void;
  onSaveEdit: (row: DesignMaterial, material: Material, quantity: number) => void;
  onDelete: (row: DesignMaterial) => void;
}) {
  const isEdit = picker.mode === "edit";
  const part = isEdit ? parseGroupKey(picker.row.groupName).part : picker.part;
  const category = isEdit ? parseGroupKey(picker.row.groupName).category : null;

  const [step, setStep] = useState<"category" | "search" | "detail">(isEdit ? "detail" : "category");
  const [chosenCategory, setChosenCategory] = useState<MaterialCategory | null>(category);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Material | null>(isEdit ? picker.row.material : null);
  const [quantity, setQuantity] = useState<number>(isEdit ? picker.row.quantity : 1);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? inventory.filter((m) => m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
    : inventory;
  const amount = chosen ? chosen.costPerUnit * quantity : 0;

  function save() {
    if (!chosen || quantity <= 0) return;
    if (isEdit) {
      onSaveEdit(picker.row, chosen, quantity);
    } else if (chosenCategory) {
      onSaveNew(part, chosenCategory, chosen, quantity);
    }
  }

  const title = isEdit ? "Edit material" : "Add material";
  const subtitle = isEdit ? `${part} → ${category}` : chosenCategory ? `${part} → ${chosenCategory}` : part;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-foreground/40 p-0 sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step 1 (add only): choose a category */}
        {step === "category" && (
          <div className="grid gap-2 px-5 pb-5 pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Select Material Category
            </p>
            {MATERIAL_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setChosenCategory(c);
                  setStep("search");
                }}
                className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left text-sm font-semibold hover:border-primary/40 hover:bg-primary-soft/30"
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Step 2 (both): search Inventory and pick a material */}
        {step === "search" && (
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
                  <p className="text-xs text-muted-foreground">Add materials in the Inventory module first.</p>
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
                        onClick={() => {
                          setChosen(m);
                          setStep("detail");
                        }}
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
            {isEdit && (
              <button
                onClick={() => setStep("detail")}
                className="rounded-xl border border-border px-3 py-2.5 text-xs font-bold text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
            )}
          </div>
        )}

        {/* Step 3 / detail (both): quantity + amount, Save, Change Material, Delete */}
        {step === "detail" && chosen && (
          <div className="grid gap-3 px-5 pb-5 pt-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-primary-soft/40 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{chosen.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {chosen.code} · ₹{chosen.costPerUnit.toFixed(2)}/{chosen.unit} · stock {chosen.availableStock}
                </p>
              </div>
              <button
                onClick={() => setStep("search")}
                className="shrink-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-primary-soft/40"
              >
                Change Material
              </button>
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
              {isEdit ? (
                <button
                  onClick={() => onDelete(picker.row)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 px-3 py-2.5 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              ) : (
                <button
                  onClick={() => setStep("category")}
                  className="rounded-xl border border-border px-3 py-2.5 text-xs font-bold text-muted-foreground hover:bg-accent"
                >
                  Back
                </button>
              )}
              <button
                onClick={save}
                disabled={busy || quantity <= 0}
                className="ml-auto inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
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

type ErpEmployee = { employee: string; employee_name: string; status: string };
type ErpEmployeesResponse = { success: boolean; employees?: ErpEmployee[]; error?: string };

// Live Active-employee names from ERPNext, via the existing read-only
// erpnext-employees-test Edge Function. Never hardcoded and never persisted
// beyond this query's own cache — every page load/refresh re-fetches the
// current Active list, so newly added employees appear and Inactive ones
// stop appearing without any code change. If ERPNext is unreachable this
// safely resolves to an empty list rather than breaking the page; already
// -assigned worker names on existing steps are plain saved text (assignedTo)
// and are unaffected by this list either way.
function useActiveErpWorkers() {
  return useQuery({
    queryKey: ["erpnext-active-employees"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.functions.invoke<ErpEmployeesResponse>("erpnext-employees-test");
      if (error || !data?.success) return [];
      return (data.employees ?? [])
        .map((e) => e.employee_name)
        .filter((n): n is string => !!n && n.trim() !== "")
        .sort((a, b) => a.localeCompare(b));
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Extension point for operation-specific eligibility: every Active ERPNext
// employee counts as "eligible" for every operation today, because ERPNext
// doesn't yet expose a department/skill mapping per operation. Once it
// does, filter activeWorkerNames by operationId here — the Worker
// Selection popup itself only ever renders whatever list this returns, so
// no UI change is needed when real filtering lands.
function useEligibleWorkers(operationId: string | null) {
  const { data: activeWorkerNames = [], isLoading } = useActiveErpWorkers();
  return { data: activeWorkerNames, isLoading };
}

// The one way to add work: Select Operation -> Garment Part -> Area (Top
// only) -> Worker -> Start Operation. Goes straight into Running — there is
// no Pending Operations step in between, and no default operations are
// seeded. Lives at the page level (not inside SampleMakingPanel) so it's
// always available regardless of which tab is active; SampleMakingPanel
// still owns everything about already-created steps (pause/resume/complete/
// cancel/reopen/edit, timers, the Timeline), it just no longer creates them.
function StartOperationCard({ design }: { design: Design }) {
  const { data: workflows } = useWorkflows(design.id);
  const { data: catalog = [] } = useOperationCatalog();
  const addStep = useAddStep(design.id);
  const updateStep = useUpdateStep(design.id);
  const addOperation = useAddOperation();
  const sample = workflows?.find((w) => w.kind === "sample");
  const ordered = sample ? [...sample.steps].sort((a, b) => a.sequence - b.sequence) : [];

  const [pickerOpen, setPickerOpen] = useState(false);
  // Newly picked process, waiting on the Worker Selection / Garment Part
  // popups — nothing is saved as a workflow step until Start Operation is
  // confirmed at the end, so Cancel at any point simply forgets this and
  // nothing is created. operationId is null for the "Other" custom-operation
  // card: the same two popups open, just with an editable name field in the
  // first one, and the operations_catalog row is only created once Start
  // Operation is actually confirmed.
  const [newProcess, setNewProcess] = useState<{ operationId: string | null; name: string } | null>(null);
  // Set once Worker Selection is confirmed — its presence is what switches
  // the flow from the Worker Selection popup to the Garment Part popup.
  const [selectedWorkers, setSelectedWorkers] = useState<string[] | null>(null);
  // For the very first sample operation, the Garment Part popup does NOT
  // immediately start the operation. Instead the Material Confirmation
  // popup opens so the user can review / edit the materials they saved in
  // Material Selection before any timer starts. After confirmation the
  // operation starts exactly the same way as any subsequent one. This
  // popup never opens again for this sample — later operations skip
  // straight from Garment Part -> start — unless materials are edited
  // manually from the Materials tab.
  const [pendingStart, setPendingStart] = useState<
    { operationId: string | null; payload: WorkAreaPayload } | null
  >(null);
  const isFirstSampleOperation = !ordered.some((s) => s.startedAt);


  const { data: eligibleWorkers = [] } = useEligibleWorkers(newProcess?.operationId ?? null);

  function commitPick(operationId: string) {
    const op = catalog.find((o) => o.id === operationId);
    setNewProcess({ operationId, name: op?.name ?? operationId });
    setPickerOpen(false);
  }

  function commitPickCustom() {
    setNewProcess({ operationId: null, name: "" });
    setPickerOpen(false);
  }

  function cancelStart() {
    setNewProcess(null);
    setSelectedWorkers(null);
    setPendingStart(null);
  }


  // Creates the workflow step and starts it in one go, only once Start
  // Operation is confirmed. For the "Other" flow (operationId null), the
  // operations_catalog row for the typed name is created here first, right
  // before the step itself, so a cancelled dialog never leaves behind an
  // unused catalog entry. No local session/timer state to seed here —
  // SampleMakingPanel derives a fresh one from the persisted startedAt the
  // moment it's mounted (or already showing), so this works identically
  // whether that tab is currently active or not.
  async function createAndStart(operationId: string | null, payload: WorkAreaPayload) {
    if (!sample || payload.workers.length === 0) return;
    let opId = operationId;
    if (!opId) {
      const customName = payload.operationName?.trim();
      if (!customName) return;
      opId = await addOperation.mutateAsync({ name: customName });
    }
    const nextSeq = ordered.length ? Math.max(...ordered.map((s) => s.sequence)) + 1 : 1;
    const now = new Date();
    const stepId = await addStep.mutateAsync({ workflowId: sample.id, operationId: opId, sequence: nextSeq });
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
    setSelectedWorkers(null);
  }

  const busy = updateStep.isPending || addStep.isPending || addOperation.isPending;

  return (
    <>
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <button
          onClick={() => setPickerOpen(true)}
          className="mt-2 flex w-full flex-col items-center gap-1.5 rounded-2xl py-10 text-center transition hover:bg-primary-soft/20"
        >
          <span className="grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow shadow-lg shadow-primary/30 transition-transform duration-200 hover:scale-105 hover:shadow-xl hover:shadow-primary/40">
            <Plus className="h-12 w-12 text-primary-foreground" strokeWidth={2.5} />
          </span>
          <span className="mt-2 text-base font-bold text-foreground">Start Operation</span>
          <span className="text-xs text-muted-foreground">Click to start a new sample operation</span>
        </button>
      </div>

      {pickerOpen && (
        <OperationPickerModal
          title="Select Operation"
          catalog={catalog}
          busy={busy}
          onPick={commitPick}
          onPickCustom={commitPickCustom}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {newProcess && selectedWorkers === null && (
        <WorkerSelectionDialog
          operationName={newProcess.name}
          operationNameEditable={newProcess.operationId === null}
          workerOptions={eligibleWorkers}
          busy={busy}
          onCancel={cancelStart}
          onConfirm={({ workers, operationName }) => {
            if (operationName !== undefined) {
              setNewProcess((p) => (p ? { ...p, name: operationName } : p));
            }
            setSelectedWorkers(workers);
          }}
        />
      )}

      {newProcess && selectedWorkers !== null && !pendingStart && (
        <WorkAreaDialog
          operationId={newProcess.operationId}
          operationName={newProcess.name}
          workers={selectedWorkers}
          busy={busy}
          onCancel={cancelStart}
          onConfirm={(payload) => {
            if (isFirstSampleOperation) {
              setPendingStart({ operationId: newProcess.operationId, payload });
            } else {
              createAndStart(newProcess.operationId, payload);
            }
          }}
        />
      )}

      {pendingStart && (
        <MaterialConfirmDialog
          design={design}
          busy={busy}
          onCancel={cancelStart}
          onConfirm={async () => {
            await createAndStart(pendingStart.operationId, pendingStart.payload);
            setPendingStart(null);
          }}
        />
      )}
    </>
  );
}


function SampleMakingPanel({ design, onContinue }: { design: Design; onContinue: () => void }) {
  const { data: workflows, isLoading } = useWorkflows(design.id);
  const { data: catalog = [] } = useOperationCatalog();
  const { data: activeWorkerNames = [] } = useActiveErpWorkers();
  const updateStep = useUpdateStep(design.id);
  const deleteStep = useDeleteStep(design.id);
  const sample = workflows?.find((w) => w.kind === "sample");
  const ordered = sample ? [...sample.steps].sort((a, b) => a.sequence - b.sequence) : [];

  const [sessions, setSessions] = useState<Record<string, OperationSession>>({});
  const [, forceTick] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

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
      {/* Starting new work now happens from the always-visible Start
          Operation card above the tabs (StartOperationCard) — this section
          only ever manages steps that already exist: several can run at
          once, each with its own workers/timer/status, and completing one
          never touches the others. */}
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
                  workerOptions={activeWorkerNames}
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

      <div className="flex flex-col items-end gap-1">
        <button
          onClick={onContinue}
          disabled={running.length > 0}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to Costing <ArrowRight className="h-4 w-4" />
        </button>
        {running.length > 0 && (
          <p className="text-[11px] text-muted-foreground">Complete all running operations to continue.</p>
        )}
      </div>

      <WorkflowTimeline
        history={history}
        catalog={catalog}
        sessions={sessions}
        onEdit={setEditingId}
        onReopen={reopen}
      />

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

function AddWorkerControl({
  workers,
  workerOptions,
  onAdd,
}: {
  workers: string[];
  workerOptions: string[];
  onAdd: (worker: string) => void;
}) {
  const available = workerOptions.filter((w) => !workers.includes(w));
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
  workerOptions,
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
  workerOptions: string[];
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
          <AddWorkerControl workers={workers} workerOptions={workerOptions} onAdd={onAddWorker} />
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

// Sample Making only ever starts these four Sample-stage operations from the
// picker — everything else in operations_catalog (Fabric Selection, Sample
// QC/Approval, all Bulk + Finishing ops) belongs to other screens/stages and
// is hidden here rather than duplicated into a second catalog. Anything not
// in this hidden set — including every custom operation ever added, since
// their ids are random slugs — shows up automatically, so newly added custom
// operations need no extra allowlisting.
const OPERATION_PICKER_HIDDEN_IDS = new Set([
  "fabric-selection",
  "sample-qc",
  "sample-approval",
  "cutting",
  "handwork",
  "stitching",
  "bulk-embroidery",
  "qc",
  "packing",
  "barcode",
  "ready-stock",
]);

function OperationPickerModal({
  title,
  catalog,
  busy,
  onPick,
  onPickCustom,
  onClose,
}: {
  title: string;
  catalog: CatalogOperation[];
  busy: boolean;
  onPick: (operationId: string) => void;
  // "Other" behaves exactly like picking any other card: it just has no
  // catalog operation behind it yet, so there's no id to pass. The very
  // same Start Operation dialog (WorkAreaDialog) opens either way — see
  // commitPickCustom / newProcess in SampleMakingPanel.
  onPickCustom: () => void;
  onClose: () => void;
}) {
  const visibleCatalog = catalog.filter((op) => !OPERATION_PICKER_HIDDEN_IDS.has(op.id));

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

        <div className="mt-4 grid grid-cols-2 gap-3">
          {visibleCatalog.map((op) => {
            const Icon = op.icon;
            return (
              <button
                key={op.id}
                onClick={() => onPick(op.id)}
                disabled={busy}
                className="flex flex-col items-center gap-2 rounded-3xl border border-border bg-background p-5 text-center hover:border-primary/40 hover:bg-primary-soft/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                  {op.iconUrl ? (
                    <img src={op.iconUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
                  ) : (
                    <Icon className="h-7 w-7" />
                  )}
                  {op.logoUrl && (
                    <img
                      src={op.logoUrl}
                      alt=""
                      className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-background bg-background object-cover"
                    />
                  )}
                </span>
                <span className="text-sm font-bold leading-tight">{op.name}</span>
              </button>
            );
          })}

          <button
            onClick={onPickCustom}
            disabled={busy}
            className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border bg-background p-5 text-center hover:border-primary/40 hover:bg-primary-soft/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <Plus className="h-7 w-7" />
            </span>
            <span className="text-sm font-bold leading-tight">Other</span>
            <span className="text-[11px] text-muted-foreground">Add Custom Operation</span>
          </button>
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

  const [overheadItems, setOverheadItems] = useState<{ id: string; label: string; amount: number }[]>(() => [
    { id: "oh-electricity", label: "Electricity", amount: 0 },
    { id: "oh-packing", label: "Packing", amount: 0 },
    { id: "oh-transport", label: "Transport", amount: 0 },
  ]);
  const overheadPerPiece = overheadItems.reduce((s, o) => s + (o.amount || 0), 0);

  const perPiece = materialPerPiece + labourPerPiece + overheadPerPiece;
  const projectedProductionTotal = perPiece * design.orderQuantity;

  const [openRow, setOpenRow] = useState<"material" | "overhead" | "labour" | null>("material");
  const toggle = (k: "material" | "overhead" | "labour") => setOpenRow((cur) => (cur === k ? null : k));

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
                      <p className="truncate text-sm font-semibold">{m.material?.name ?? "Material"}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {m.quantity} {m.material?.unit ?? ""} × ₹{m.rate.toFixed(2)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums">{formatCurrency(m.amount)}</span>
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
                          x.id === o.id ? { ...x, amount: Math.max(0, Number(e.target.value) || 0) } : x,
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
                    <span className="truncate text-sm font-semibold">{s.label || s.operationId}</span>
                    <span className="shrink-0 text-sm font-bold tabular-nums">{formatCurrency(stepLabourCost(s))}</span>
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
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">1 Piece</p>
            </div>
            <p className="text-2xl font-extrabold tabular-nums text-primary">{formatCurrency(perPiece)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Production Projection</p>
        <p className="mt-1 text-lg font-extrabold tabular-nums">₹{projectedProductionTotal.toLocaleString()}</p>
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {design.orderQuantity} pcs × ₹{perPiece.toLocaleString()}
        </p>
        <p className="mt-2 text-[11px] italic text-muted-foreground">
          Informational only. Actual production cost is calculated after sample approval when a Production Order is
          created.
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
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform " + (open ? "rotate-0" : "-rotate-90")
            }
          />
          <span className="text-sm font-bold">{title}</span>
          {meta && <span className="truncate text-xs text-muted-foreground">({meta})</span>}
        </div>
        <span className="shrink-0 text-sm font-extrabold tabular-nums">{formatCurrency(amount)}</span>
      </button>
      {open && <div className="border-t border-dashed border-border bg-muted/20 px-4 py-3">{children}</div>}
    </li>
  );
}

function ChildTotal({ label, amount }: { label: string; amount: number }) {
  return (
    <li className="mt-1 flex items-center justify-between border-t border-border pt-2">
      <span className="text-sm font-bold">{label}</span>
      <span className="text-sm font-extrabold tabular-nums text-primary">{formatCurrency(amount)}</span>
    </li>
  );
}

function EmptyChild({ text }: { text: string }) {
  return <p className="py-2 text-center text-xs text-muted-foreground">{text}</p>;
}

/* ---------- Approval ---------- */

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

  const byRole = new Map<string, (typeof approvals)[number]>(approvals.map((a) => [a.role, a]));
  const approvedCount = MANDATORY_APPROVAL_ROLES.filter((r) => byRole.has(r)).length;
  const total = MANDATORY_APPROVAL_ROLES.length;
  const pct = Math.round((approvedCount / total) * 100);
  const allApproved = approvedCount === total;
  const sampleLocked =
    design.status === "sample_approved" || design.status === "in_production" || design.status === "completed";

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
              onApprove={() => record.mutateAsync({ role, approverName: currentUserName })}
            />
          ))}
          <li className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 opacity-70">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Customer</p>
                <p className="mt-0.5 truncate text-base font-bold text-muted-foreground">{design.customer}</p>
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
          <p className="mt-0.5 truncate text-base font-bold">{isApproved ? existing!.approverName : "—"}</p>
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
            <span className="font-semibold text-foreground">Approved by:</span> {existing!.approverName}
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

function SampleHeader({ design, stageIndex }: { design: Design; stageIndex: number }) {
  const createdOn = new Date(design.createdAt).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const total = SAMPLE_STAGES.length;
  const currentIdx = Math.min(Math.max(stageIndex, 0), total - 1);

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="flex justify-center">
        <div className="relative aspect-[4/3] w-full max-w-[280px] overflow-hidden rounded-2xl border border-border bg-primary-soft sm:max-w-[320px]">
          <DesignImage path={design.imagePath} alt={design.name} />
        </div>
      </div>

      <div className="mt-3 grid gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold tracking-widest text-muted-foreground">{design.code}</p>
          <h2 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{design.name}</h2>
          <p className="mt-1 truncate text-sm text-muted-foreground">{design.customer}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Fact label="Order Qty" value={`${design.orderQuantity.toLocaleString()} Pcs`} />
          <Fact label="Category" value={design.category || "—"} />
          <Fact label="Product Type" value={design.productType || "—"} />
          <Fact label="Color" value={design.color || "—"} />
          <Fact label="Created On" value={createdOn} />
          <Fact label="Status" value={STATUS_LABEL[design.status]} />
        </div>

        <div className="min-w-0 rounded-2xl border border-border bg-background p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-bold">Workflow Progress</p>
            <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary">
              {SAMPLE_STAGES[currentIdx].label}
            </span>
          </div>
          <ol className="mt-3 flex items-start gap-1 sm:gap-1.5">
            {SAMPLE_STAGES.map((step, i) => {
              const n = i + 1;
              const done = i < currentIdx;
              const current = i === currentIdx;
              return (
                <li key={step.id} className="flex min-w-0 flex-1 flex-col items-center gap-1 sm:gap-1.5">
                  <div className="flex w-full items-center gap-1 sm:gap-1.5">
                    <span
                      className={
                        "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-bold transition sm:h-8 sm:w-8 sm:text-[11px] " +
                        (done
                          ? "bg-primary text-primary-foreground"
                          : current
                            ? "bg-primary text-primary-foreground ring-[3px] ring-primary/30 sm:ring-[5px]"
                            : "bg-muted text-muted-foreground")
                      }
                    >
                      {done ? "✓" : n}
                    </span>
                    {i < total - 1 && (
                      <span
                        className={"h-0.5 min-w-0 flex-1 rounded-full " + (i < currentIdx ? "bg-primary" : "bg-muted")}
                      />
                    )}
                  </div>
                  <span
                    className={
                      "hidden w-full truncate text-center text-[9px] font-semibold leading-tight sm:block " +
                      (current ? "text-primary" : done ? "text-foreground" : "text-muted-foreground")
                    }
                    title={step.label}
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
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
