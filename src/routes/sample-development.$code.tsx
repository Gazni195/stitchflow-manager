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
import { Switch } from "@/components/ui/switch";
import { useRequireAuth } from "@/hooks/use-auth";
import { useDesignByCode } from "@/lib/api/designs";
import { useAddOperation, useOperationCatalog, type CatalogOperation } from "@/lib/api/operations";
import {
  useAddDesignMaterial,
  useDeleteDesignMaterial,
  useDesignMaterials,
  useMaterials,
  useUpdateDesignMaterial,
  type Material,
} from "@/lib/api/materials";
import {
  useAddStep,
  useDeleteStep,
  useUpdateStep,
  useWorkflows,
  type StepStatus,
  type WorkflowStep,
} from "@/lib/api/workflows";
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
            {tab === "status" && <StatusPanel design={design} stage={stage} />}
            {tab === "materials" && <MaterialsPanel design={design} onCompleted={() => setTab("making")} />}
            {tab === "making" && <SampleMakingPanel design={design} onContinue={() => setTab("costing")} />}
            {tab === "costing" && <CostingPanel design={design} />}
            {tab === "approval" && <ApprovalPanel design={design} />}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/* ---------- Status ---------- */

function StatusPanel({ design, stage }: { design: Design; stage: "In Development" | "Ready for Review" | "Approved" }) {
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
    </div>
  );
}

/* ---------- Materials (Select from Material Master, persisted) ---------- */
//
// Material Groups (Top/Pant/Shawl always-present, Lining/Lace/Accessories
// optional, plus custom ones) are still a client-side organizing shell —
// but every row inside them is now a real design_materials record: pick a
// Material from the (locally stored) Material Master, enter Quantity, and
// Rate/Amount are derived automatically (Amount = Quantity x Rate, computed
// by the database so it can never drift). Saved rows are reloaded and
// re-grouped by their stored group_name on every visit, so this survives
// reloads and tab switches — Costing reads the same table for its "Total
// Material Cost". No ERPNext calls happen here; Material Master is a local
// list for now, meant to later sync from ERPNext's Item Master.

type MaterialRowState = {
  id: string;
  designMaterialId: string | null;
  materialId: string;
  quantity: number;
  editing: boolean;
};

type MaterialGroupState = {
  id: string;
  name: string;
  enabled: boolean;
  expanded: boolean;
  rows: MaterialRowState[];
};

function newGroup(name: string, enabled: boolean, expanded = false): MaterialGroupState {
  return { id: crypto.randomUUID(), name, enabled, expanded, rows: [] };
}

function newRow(): MaterialRowState {
  return { id: crypto.randomUUID(), designMaterialId: null, materialId: "", quantity: 0, editing: true };
}

function initialGroups(): MaterialGroupState[] {
  return [
    newGroup("Top", true, true),
    newGroup("Pant", true, false),
    newGroup("Shawl", true, false),
    newGroup("Lining", false, false),
    newGroup("Lace", false, false),
    newGroup("Accessories", false, false),
  ];
}

function MaterialsPanel({ design, onCompleted }: { design: Design; onCompleted: () => void }) {
  const [groups, setGroups] = useState<MaterialGroupState[]>(initialGroups);
  const [hydrated, setHydrated] = useState(false);
  const [customName, setCustomName] = useState("");
  const { data: workflows } = useWorkflows(design.id);
  const updateStep = useUpdateStep(design.id);
  const { data: materials = [] } = useMaterials();
  const { data: designMaterials = [], isLoading: rowsLoading } = useDesignMaterials(design.id);
  const addDesignMaterial = useAddDesignMaterial(design.id);
  const updateDesignMaterial = useUpdateDesignMaterial(design.id);
  const deleteDesignMaterial = useDeleteDesignMaterial(design.id);

  // Fold previously-saved rows into the group shell once, on first load —
  // enabling any group (default or custom) that already has saved rows.
  useEffect(() => {
    if (hydrated || rowsLoading) return;
    if (designMaterials.length > 0) {
      setGroups((prev) => {
        const next = prev.map((g) => ({ ...g, rows: [] as MaterialRowState[] }));
        for (const dm of designMaterials) {
          let group = next.find((g) => g.name.toLowerCase() === dm.groupName.toLowerCase());
          if (!group) {
            group = newGroup(dm.groupName, true, false);
            next.push(group);
          }
          group.enabled = true;
          group.rows.push({
            id: crypto.randomUUID(),
            designMaterialId: dm.id,
            materialId: dm.materialId,
            quantity: dm.quantity,
            editing: false,
          });
        }
        return next;
      });
    }
    setHydrated(true);
  }, [designMaterials, rowsLoading, hydrated]);

  function updateGroup(id: string, patch: Partial<MaterialGroupState>) {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }
  function addGroup(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setGroups((prev) => {
      if (prev.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [...prev, newGroup(trimmed, true, true)];
    });
  }
  function addRow(groupId: string) {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, expanded: true, rows: [...g.rows, newRow()] } : g)),
    );
  }
  function patchRow(groupId: string, rowId: string, patch: Partial<MaterialRowState>) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, rows: g.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) } : g,
      ),
    );
  }
  async function saveRow(group: MaterialGroupState, row: MaterialRowState) {
    const material = materials.find((m) => m.id === row.materialId);
    if (!material || row.quantity <= 0) return;
    if (row.designMaterialId) {
      await updateDesignMaterial.mutateAsync({
        id: row.designMaterialId,
        patch: { materialId: row.materialId, groupName: group.name, quantity: row.quantity, rate: material.rate },
      });
      patchRow(group.id, row.id, { editing: false });
    } else {
      const id = await addDesignMaterial.mutateAsync({
        materialId: row.materialId,
        groupName: group.name,
        quantity: row.quantity,
        rate: material.rate,
      });
      patchRow(group.id, row.id, { editing: false, designMaterialId: id });
    }
  }
  async function removeRow(groupId: string, row: MaterialRowState) {
    if (row.designMaterialId) {
      await deleteDesignMaterial.mutateAsync(row.designMaterialId);
    }
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, rows: g.rows.filter((r) => r.id !== row.id) } : g)),
    );
  }

  const enabledGroups = groups.filter((g) => g.enabled);
  const allRequiredMaterialsSaved =
    enabledGroups.length > 0 && enabledGroups.every((g) => g.rows.length > 0 && g.rows.every((r) => !r.editing));
  const busy = addDesignMaterial.isPending || updateDesignMaterial.isPending || deleteDesignMaterial.isPending;

  // The real, saved sample workflow may or may not include a Fabric/Material
  // Selection step (workflows are user-configured). When it does, completing
  // here marks that step done in the same data Sample Making reads its "next
  // operation" from — so workflow progress and the Sample Making tab both
  // reflect this automatically, with no separate hardcoded state.
  async function completeMaterialSelection() {
    const sample = workflows?.find((w) => w.kind === "sample");
    const step = sample?.steps.find((s) => s.operationId === "fabric-selection");
    if (step && step.status !== "completed") {
      await updateStep.mutateAsync({ stepId: step.id, patch: { status: "completed" } });
    }
    onCompleted();
  }

  return (
    <div className="grid gap-2">
      <Link
        to="/material-master"
        className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline"
      >
        Manage Material Master →
      </Link>

      {materials.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-3 text-center text-xs text-muted-foreground">
          No materials in the Material Master yet.{" "}
          <Link to="/material-master" className="font-semibold text-primary hover:underline">
            Add some
          </Link>{" "}
          before selecting.
        </div>
      )}

      {groups.map((group) => (
        <MaterialGroupCard
          key={group.id}
          group={group}
          materials={materials}
          busy={busy}
          onToggleExpanded={() => updateGroup(group.id, { expanded: !group.expanded })}
          onToggleEnabled={(enabled) => updateGroup(group.id, { enabled })}
          onAddRow={() => addRow(group.id)}
          onPatchRow={(rowId, patch) => patchRow(group.id, rowId, patch)}
          onSaveRow={(row) => saveRow(group, row)}
          onRemoveRow={(row) => removeRow(group.id, row)}
        />
      ))}

      <div className="rounded-2xl border border-dashed border-border bg-card p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">+ Add Material Group</p>
        <div className="mt-2 flex gap-2">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addGroup(customName);
                setCustomName("");
              }
            }}
            placeholder="Custom group e.g. Interlining, Embroidery, Dupatta Border"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => {
              addGroup(customName);
              setCustomName("");
            }}
            disabled={!customName.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      {allRequiredMaterialsSaved ? (
        <div className="rounded-2xl border border-success/30 bg-success/5 p-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-bold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Material Selection Completed
          </span>
          <button
            onClick={completeMaterialSelection}
            disabled={updateStep.isPending}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {updateStep.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Complete Material Selection & Continue
          </button>
        </div>
      ) : (
        <p className="text-center text-[11px] text-muted-foreground">
          Save at least one material in every enabled group to continue.
        </p>
      )}
    </div>
  );
}

function MaterialGroupCard({
  group,
  materials,
  busy,
  onToggleExpanded,
  onToggleEnabled,
  onAddRow,
  onPatchRow,
  onSaveRow,
  onRemoveRow,
}: {
  group: MaterialGroupState;
  materials: Material[];
  busy: boolean;
  onToggleExpanded: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onAddRow: () => void;
  onPatchRow: (rowId: string, patch: Partial<MaterialRowState>) => void;
  onSaveRow: (row: MaterialRowState) => void;
  onRemoveRow: (row: MaterialRowState) => void;
}) {
  return (
    <div
      className={
        "overflow-hidden rounded-2xl border border-border bg-card transition-opacity " +
        (group.enabled ? "" : "opacity-60")
      }
    >
      <div className="flex h-12 items-center gap-2 px-3">
        <button onClick={onToggleExpanded} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronDown
            className={
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform " + (group.expanded ? "rotate-180" : "")
            }
          />
          <span className="truncate text-sm font-semibold">{group.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            ({group.rows.length} Material{group.rows.length === 1 ? "" : "s"})
          </span>
        </button>
        <Switch
          checked={group.enabled}
          onCheckedChange={onToggleEnabled}
          onClick={(e) => e.stopPropagation()}
          aria-label={group.enabled ? `Disable ${group.name}` : `Enable ${group.name}`}
        />
      </div>

      {group.expanded && (
        <div className="grid gap-2 border-t border-border p-3">
          {group.rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
              No materials added yet.
            </p>
          ) : (
            group.rows.map((row) => (
              <MaterialRowItem
                key={row.id}
                row={row}
                materials={materials}
                busy={busy}
                onPatch={(patch) => onPatchRow(row.id, patch)}
                onSave={() => onSaveRow(row)}
                onDelete={() => onRemoveRow(row)}
              />
            ))
          )}
          <button
            onClick={onAddRow}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-background py-2 text-xs font-semibold text-primary hover:bg-primary-soft/40"
          >
            <Plus className="h-3.5 w-3.5" /> Add Material
          </button>
        </div>
      )}
    </div>
  );
}

function MaterialRowItem({
  row,
  materials,
  busy,
  onPatch,
  onSave,
  onDelete,
}: {
  row: MaterialRowState;
  materials: Material[];
  busy: boolean;
  onPatch: (patch: Partial<MaterialRowState>) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const selected = materials.find((m) => m.id === row.materialId);
  const amount = (selected?.rate ?? 0) * row.quantity;
  const valid = !!row.materialId && row.quantity > 0;

  if (!row.editing) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{selected?.name ?? "Unknown material"}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {row.quantity} {selected?.unit ?? ""} × ₹{(selected?.rate ?? 0).toLocaleString()} = ₹
            {amount.toLocaleString()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onPatch({ editing: true })}
            aria-label="Edit material"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            aria-label="Delete material"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary-soft/30 p-2.5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="block min-w-0 sm:col-span-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Select Material
          </span>
          <select
            value={row.materialId}
            onChange={(e) => onPatch({ materialId: e.target.value })}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
          >
            <option value="">Select Material</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.unit})
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Quantity</span>
          <input
            type="number"
            min={0}
            step={0.25}
            inputMode="decimal"
            value={row.quantity || ""}
            onChange={(e) => onPatch({ quantity: Math.max(0, Number(e.target.value) || 0) })}
            placeholder="0.00"
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
          />
        </label>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <StatusTile label="Rate" value={selected ? `₹${selected.rate.toLocaleString()}` : "—"} />
        <StatusTile label="Amount" value={selected ? `₹${amount.toLocaleString()}` : "—"} mono />
      </div>

      <div className="mt-2 flex gap-2">
        <button
          onClick={onSave}
          disabled={!valid || busy}
          className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete material"
          className="shrink-0 rounded-xl border border-border bg-background px-3 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
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
  estimatedHours: string;
  remarks: string;
  startedAt: Date | null;
  pausedAt: Date | null;
  pausedMs: number;
  completedAt: Date | null;
};

function emptySession(): OperationSession {
  return {
    workers: [],
    estimatedHours: "",
    remarks: "",
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

// Friendly "1h 30m" — used for finished durations in the Workflow Timeline.
function formatHM(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
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
            startedAt: new Date(),
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

  function start(step: WorkflowStep) {
    const session = sessions[step.id] ?? emptySession();
    if (session.workers.length === 0) return;
    const hoursNote = session.estimatedHours.trim()
      ? `Est. ${session.estimatedHours.trim()} hr${session.estimatedHours.trim() === "1" ? "" : "s"}`
      : "";
    const remarks = [hoursNote, session.remarks.trim()].filter(Boolean).join(" · ");
    patchSession(step.id, { startedAt: new Date(), pausedAt: null, pausedMs: 0, completedAt: null });
    updateStep.mutate({
      stepId: step.id,
      patch: {
        status: "in-progress",
        assignedTo: joinWorkers(session.workers),
        remarks: remarks || null,
        startDate: today(),
      },
    });
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

  function cancel(step: WorkflowStep) {
    if (!window.confirm(`Cancel "${operationName(step, catalog)}"? It will move back to Pending.`)) return;
    patchSession(step.id, { startedAt: null, pausedAt: null, pausedMs: 0, completedAt: null });
    updateStep.mutate({ stepId: step.id, patch: { status: "pending", startDate: null } });
  }

  function complete(step: WorkflowStep) {
    patchSession(step.id, { completedAt: new Date(), pausedAt: null });
    updateStep.mutate({ stepId: step.id, patch: { status: "completed", endDate: today() } });
  }

  function reopen(step: WorkflowStep) {
    patchSession(step.id, { startedAt: null, pausedAt: null, pausedMs: 0, completedAt: null });
    updateStep.mutate({ stepId: step.id, patch: { status: "pending", endDate: null } });
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

  async function commitPick(operationId: string) {
    if (!sample) return;
    const nextSeq = ordered.length ? Math.max(...ordered.map((s) => s.sequence)) + 1 : 1;
    await addStep.mutateAsync({ workflowId: sample.id, operationId, sequence: nextSeq });
    setPickerOpen(false);
  }

  async function commitCustom(name: string) {
    const operationId = await addOperation.mutateAsync({ name });
    await commitPick(operationId);
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

  const pending = ordered.filter((s) => s.status === "pending").sort((a, b) => a.sequence - b.sequence);
  const running = ordered
    .filter((s) => s.status === "in-progress")
    .sort((a, b) => (sessions[a.id]?.startedAt?.getTime() ?? 0) - (sessions[b.id]?.startedAt?.getTime() ?? 0));
  const history = ordered
    .filter((s) => s.status === "completed" || s.status === "skipped" || s.status === "deleted")
    .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? "") || b.sequence - a.sequence);

  const editingStep = editingId ? ordered.find((s) => s.id === editingId) : undefined;

  return (
    <div className="grid gap-4">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Running Operations</p>
          <button
            onClick={() => setPickerOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-border bg-background px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-primary-soft/40"
          >
            <Plus className="h-3.5 w-3.5" /> Add Process
          </button>
        </div>
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

      <PendingOperationsSection
        pending={pending}
        catalog={catalog}
        sessions={sessions}
        busy={updateStep.isPending}
        onAddWorker={addWorker}
        onRemoveWorker={removeWorker}
        onHoursChange={(step, v) => patchSession(step.id, { estimatedHours: v })}
        onStart={start}
        onEdit={setEditingId}
        onDelete={removeStep}
      />

      <WorkflowTimeline
        history={history}
        catalog={catalog}
        sessions={sessions}
        onEdit={setEditingId}
        onReopen={reopen}
      />

      {pickerOpen && (
        <OperationPickerModal
          title="Add Process"
          catalog={catalog}
          busy={busy}
          onPick={commitPick}
          onCreateCustom={commitCustom}
          onClose={() => setPickerOpen(false)}
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
        <h4 className="truncate text-base font-extrabold tracking-tight">{opName}</h4>
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

// Its own section, directly below Running Operations — compact Pending
// rows (Start / Edit / Delete) live here now instead of inside the
// Workflow Timeline, which is reserved for completed/skipped/deleted
// history. Same PendingTimelineRow component and callbacks as before,
// just relocated: no business logic changed, only placement.
function PendingOperationsSection({
  pending,
  catalog,
  sessions,
  busy,
  onAddWorker,
  onRemoveWorker,
  onHoursChange,
  onStart,
  onEdit,
  onDelete,
}: {
  pending: WorkflowStep[];
  catalog: CatalogOperation[];
  sessions: Record<string, OperationSession>;
  busy: boolean;
  onAddWorker: (step: WorkflowStep, worker: string) => void;
  onRemoveWorker: (step: WorkflowStep, worker: string) => void;
  onHoursChange: (step: WorkflowStep, value: string) => void;
  onStart: (step: WorkflowStep) => void;
  onEdit: (stepId: string) => void;
  onDelete: (step: WorkflowStep) => void;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <p className="text-sm font-bold">Pending Operations</p>
      {pending.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing pending. Use "+ Add Process" above to queue one up.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {pending.map((step) => (
            <PendingTimelineRow
              key={step.id}
              step={step}
              catalog={catalog}
              session={sessions[step.id] ?? emptySession()}
              busy={busy}
              onAddWorker={(w) => onAddWorker(step, w)}
              onRemoveWorker={(w) => onRemoveWorker(step, w)}
              onHoursChange={(v) => onHoursChange(step, v)}
              onStart={() => onStart(step)}
              onEdit={() => onEdit(step.id)}
              onDelete={() => onDelete(step)}
            />
          ))}
        </ul>
      )}
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
  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <p className="text-sm font-bold">Workflow Timeline</p>
      {history.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No completed operations yet.</p>
      ) : (
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
      )}
    </div>
  );
}

function PendingTimelineRow({
  step,
  catalog,
  session,
  busy,
  onAddWorker,
  onRemoveWorker,
  onHoursChange,
  onStart,
  onEdit,
  onDelete,
}: {
  step: WorkflowStep;
  catalog: CatalogOperation[];
  session: OperationSession;
  busy: boolean;
  onAddWorker: (worker: string) => void;
  onRemoveWorker: (worker: string) => void;
  onHoursChange: (value: string) => void;
  onStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [starting, setStarting] = useState(false);
  const op = catalog.find((o) => o.id === step.operationId);
  const opName = operationName(step, catalog);
  const Icon = op?.icon;

  return (
    <li className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
            {Icon ? <Icon className="h-3.5 w-3.5" /> : <Scissors className="h-3.5 w-3.5" />}
          </div>
          <p className="truncate text-sm font-bold">{opName}</p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          Pending
        </span>
      </div>

      {starting ? (
        <div className="mt-3 grid gap-2.5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Workers</span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <WorkerChips workers={session.workers} onRemove={onRemoveWorker} />
              <AddWorkerControl workers={session.workers} onAdd={onAddWorker} />
            </div>
          </div>
          <label className="block w-40">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Estimated Hours
            </span>
            <input
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              placeholder="e.g. 2"
              value={session.estimatedHours}
              onChange={(e) => onHoursChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-semibold outline-none focus:border-primary"
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onStart();
                setStarting(false);
              }}
              disabled={session.workers.length === 0 || busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} ▶ Confirm Start
            </button>
            <button
              onClick={() => setStarting(false)}
              className="rounded-xl border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-1.5">
          <button
            onClick={() => setStarting(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground hover:opacity-90"
          >
            ▶ Start
          </button>
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent hover:text-primary"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
          <button
            onClick={onDelete}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>
      )}
    </li>
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
  const duration = session?.startedAt && session?.completedAt ? formatHM(elapsedMs(session, session.completedAt)) : "—";
  const start = session?.startedAt ? formatClock(session.startedAt) : step.startDate || "—";
  const end = session?.completedAt ? formatClock(session.completedAt) : step.endDate || "—";

  return (
    <li className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">✓ {opName}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {workers.length ? `Workers: ${workers.join(", ")}` : "Unassigned"} · {start} → {end} · {duration}
          </p>
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
              <option value="pending">Pending</option>
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

function CostingPanel({ design }: { design: Design }) {
  const { data: designMaterials = [] } = useDesignMaterials(design.id);
  const materialCost = designMaterials.reduce((s, m) => s + m.amount, 0);

  const [costs, setCosts] = useState<
    { id: string; label: string; category: "Labor" | "Overhead" | "Other"; amount: number }[]
  >(() => [
    { id: "c2", label: "Stitching", category: "Labor", amount: 0 },
    { id: "c3", label: "Overheads", category: "Overhead", amount: 0 },
  ]);

  const materialRow = {
    id: "material",
    label: "Material (from Material Selection)",
    category: "Material" as const,
    amount: materialCost,
  };
  const rows: { id: string; label: string; category: string; amount: number }[] = [materialRow, ...costs];

  const perPiece = rows.reduce((s, c) => s + c.amount, 0);
  const orderTotal = perPiece * design.orderQuantity;
  const byCategory = rows.reduce<Record<string, number>>((acc, c) => {
    acc[c.category] = (acc[c.category] ?? 0) + c.amount;
    return acc;
  }, {});

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3 text-left font-semibold">Cost Item</th>
              <th className="p-3 text-left font-semibold">Category</th>
              <th className="p-3 text-right font-semibold">Amount (₹/pc)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3 font-semibold">{c.label}</td>
                <td className="p-3 text-muted-foreground">{c.category}</td>
                <td className="p-3 text-right">
                  {c.id === "material" ? (
                    <span
                      className="inline-block w-28 text-right font-bold text-primary"
                      title="Auto-calculated from Material Selection"
                    >
                      ₹{c.amount.toLocaleString()}
                    </span>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      value={c.amount || ""}
                      onChange={(e) =>
                        setCosts((prev) =>
                          prev.map((x) =>
                            x.id === c.id ? { ...x, amount: Math.max(0, Number(e.target.value) || 0) } : x,
                          ),
                        )
                      }
                      className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-sm outline-none focus:border-primary"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-primary-soft">
              <td className="p-3 font-bold" colSpan={2}>
                Total per piece
              </td>
              <td className="p-3 text-right text-lg font-extrabold text-primary">₹{perPiece.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid gap-3">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary to-primary-glow p-5 text-primary-foreground shadow-md">
          <p className="text-[11px] font-bold uppercase tracking-widest opacity-85">Order total</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">₹{orderTotal.toLocaleString()}</p>
          <p className="mt-1 text-xs opacity-85">
            {design.orderQuantity} pcs × ₹{perPiece.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Breakdown</p>
          <ul className="mt-2 space-y-2 text-sm">
            {Object.entries(byCategory).map(([cat, amt]) => {
              const pct = perPiece > 0 ? Math.round((amt / perPiece) * 100) : 0;
              return (
                <li key={cat}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{cat}</span>
                    <span className="text-muted-foreground">
                      ₹{amt.toLocaleString()} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------- Approval ---------- */

type ApprovalRow = {
  id: string;
  role: string;
  name: string;
  status: "Pending" | "Approved" | "Rejected";
};

const APPROVAL_TONE: Record<ApprovalRow["status"], string> = {
  Pending: "bg-muted text-muted-foreground",
  Approved: "bg-success/15 text-success",
  Rejected: "bg-destructive/15 text-destructive",
};

function ApprovalPanel({ design }: { design: Design }) {
  const [approvals, setApprovals] = useState<ApprovalRow[]>(() => [
    { id: "a1", role: "Designer", name: "—", status: "Pending" },
    { id: "a2", role: "Merchandiser", name: "—", status: "Pending" },
    { id: "a3", role: "Production Head", name: "—", status: "Pending" },
    { id: "a4", role: "Customer", name: design.customer || "—", status: "Pending" },
  ]);

  const approved = approvals.filter((a) => a.status === "Approved").length;
  const total = approvals.length;
  const pct = Math.round((approved / total) * 100);

  function setStatus(id: string, status: ApprovalRow["status"]) {
    setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary-soft to-background p-5">
        <div className="flex items-center justify-between text-sm">
          <div>
            <p className="font-bold">Approval progress</p>
            <p className="text-xs text-muted-foreground">
              {approved} of {total} approvers signed off
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

      <ul className="grid gap-3 sm:grid-cols-2">
        {approvals.map((a) => {
          const Icon = a.status === "Approved" ? CheckCircle2 : a.status === "Rejected" ? XCircle : Clock;
          return (
            <li key={a.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{a.role}</p>
                  <p className="mt-0.5 truncate text-base font-bold">{a.name}</p>
                </div>
                <span
                  className={
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold " +
                    APPROVAL_TONE[a.status]
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {a.status}
                </span>
              </div>
              {a.status === "Pending" && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setStatus(a.id, "Approved")}
                    className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setStatus(a.id, "Rejected")}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:border-destructive/40 hover:text-destructive"
                  >
                    Reject
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
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
