import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  GripVertical,
  Layers,
  Loader2,
  PlayCircle,
  Settings as SettingsIcon,
  Target,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDesignMaterials, useMaterialBundlesForMaterials, type MaterialBundle } from "@/lib/api/materials";
import {
  useStartProductionV2,
  PROCESS_OPERATIONS,
  type ProcessOperationId,
  type StartProductionStep,
} from "@/lib/api/production";
import { useDesignByCode } from "@/lib/api/designs";
import { useWorkflows } from "@/lib/api/workflows";
import { useOperationCatalog } from "@/lib/api/operations";
import { calcProductionPerPiece, calcSetsPossible } from "@/lib/production-calc";
import type { PendingDesign } from "@/lib/api/production";

// Sample-operation name/short keywords that map into each of the 5 fixed
// bulk Production operations — data-driven merge, not a hardcoded per-design
// list, so "Sample Cutting · Round 1" + "Sample Cutting · Round 2" both
// collapse into a single "Cutting" step, matching however the operations
// catalog happens to name them.
const OPERATION_KEYWORDS: Record<ProcessOperationId, RegExp> = {
  cutting: /cut/i,
  handwork: /hand/i,
  embroidery: /embroider/i,
  stitching: /stitch/i,
  qc: /\bqc\b|quality/i,
};

type WorkflowStepConfig = {
  operationId: ProcessOperationId;
  name: string;
};

type Props = { design: PendingDesign; onClose: () => void; onStarted?: () => void };

export function StartProductionWizard({ design, onClose, onStarted }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [orderQty] = useState<number>(design.orderQuantity);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [supervisor, setSupervisor] = useState<string>("");

  const dmQ = useDesignMaterials(design.id);
  const designQ = useDesignByCode(design.code);
  const dm = dmQ.data ?? [];

  // Every garment part configured on this Design — loaded dynamically, never
  // hardcoded, so "Used For" always matches whatever the Design defines
  // (Three Piece, Two Piece, Kurti, or any custom part set).
  const designPartNames = useMemo(() => {
    const names = (designQ.data?.parts ?? []).map((p) => p.name).filter((n) => n.trim() !== "");
    if (names.length) return names;
    return Array.from(new Set(dm.map((r) => r.groupName.split("::")[0] || r.groupName)));
  }, [designQ.data, dm]);

  // BOM per material aggregated across garment parts (for the allocation table).
  // Each material carries the single Consumption Rule assigned to it in
  // Inventory — Production never re-matches a rule by width/layer length.
  const bomMaterials = useMemo(() => {
    const seen = new Map<
      string,
      { id: string; code: string; name: string; unit: string; reductionPct: number; hasRule: boolean }
    >();
    for (const r of dm) {
      if (!r.material) continue;
      if (!seen.has(r.materialId)) {
        const rule =
          r.material.consumptionRule && r.material.consumptionRule.status === "active"
            ? r.material.consumptionRule
            : null;
        seen.set(r.materialId, {
          id: r.materialId,
          code: r.material.code,
          name: r.material.name,
          unit: r.material.unit,
          reductionPct: rule?.reductionPct ?? 0,
          hasRule: !!rule,
        });
      }
    }
    return Array.from(seen.values());
  }, [dm]);

  const materialIds = useMemo(() => bomMaterials.map((m) => m.id), [bomMaterials]);
  const bundlesQ = useMaterialBundlesForMaterials(materialIds);
  const allBundles = bundlesQ.data ?? [];

  // Bundle selection is per material (multi-select), not a single active material.
  const [selectedByMaterial, setSelectedByMaterial] = useState<Record<string, Set<string>>>({});
  // Which garment parts each material's allocation counts towards — defaults
  // to the parts actually recorded on the Design's BOM, user-editable.
  const [usedForByMaterial, setUsedForByMaterial] = useState<Record<string, Set<string>>>({});
  const start = useStartProductionV2();

  // ---- Workflow Configuration (Step 2) ----------------------------------
  const sampleWorkflowQ = useWorkflows(design.id);
  const operationCatalogQ = useOperationCatalog();

  const sampleSteps = useMemo(
    () => sampleWorkflowQ.data?.find((w) => w.kind === "sample")?.steps ?? [],
    [sampleWorkflowQ.data],
  );

  // Unique bulk operations present in the approved Sample Workflow —
  // duplicate sample rounds (Sample Cutting 1 + 2) merge into one.
  const sampleOperations = useMemo(() => {
    const catalog = operationCatalogQ.data ?? [];
    const present = PROCESS_OPERATIONS.filter((op) => {
      const re = OPERATION_KEYWORDS[op.id];
      return sampleSteps.some((s) => {
        const cat = catalog.find((c) => c.id === s.operationId);
        return re.test(`${cat?.name ?? ""} ${cat?.short ?? ""} ${s.operationId}`);
      });
    });
    return present.length ? present : PROCESS_OPERATIONS;
  }, [sampleSteps, operationCatalogQ.data]);

  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStepConfig[]>([]);
  const [workflowInitialized, setWorkflowInitialized] = useState(false);

  // Seed the list once; never overwrites the user's own reordering.
  useEffect(() => {
    if (workflowInitialized) return;
    if (sampleWorkflowQ.isLoading || operationCatalogQ.isLoading) return;
    setWorkflowSteps(sampleOperations.map((op) => ({ operationId: op.id, name: op.name })));
    setWorkflowInitialized(true);
  }, [workflowInitialized, sampleWorkflowQ.isLoading, operationCatalogQ.isLoading, sampleOperations]);

  const workflowDndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function onWorkflowDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setWorkflowSteps((prev) => {
      const ids = prev.map((s): string => s.operationId);
      const oldIdx = ids.indexOf(String(active.id));
      const newIdx = ids.indexOf(String(over.id));
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }
  // ------------------------------------------------------------------------

  // Commits the drafted bundle selection for a material — only called when
  // the user clicks Apply inside the Bundle Selection popover, so nothing
  // downstream (Sets Possible, Required Fabric, Production Summary) recalculates
  // until the selection is confirmed.
  function applyBundleSelection(materialId: string, next: Set<string>) {
    setSelectedByMaterial((prev) => ({ ...prev, [materialId]: next }));
  }

  function toggleUsedFor(materialId: string, part: string) {
    setUsedForByMaterial((prev) => {
      const set = new Set(prev[materialId] ?? []);
      if (set.has(part)) set.delete(part);
      else set.add(part);
      return { ...prev, [materialId]: set };
    });
  }

  // 2. Fabric Consumption Per Piece — one row per garment part.
  // Sample Consumption → (material's assigned Consumption Rule) → Reduction % → Production Consumption.
  const partRows = useMemo(() => {
    const byMaterial = new Map(bomMaterials.map((m) => [m.id, m]));
    return dm
      .filter((r) => r.material)
      .map((r) => {
        const mat = byMaterial.get(r.materialId);
        const reductionPct = mat?.reductionPct ?? 0;
        return {
          part: r.groupName.split("::")[0] || r.groupName,
          material: r.material!,
          materialId: r.materialId,
          samplePerPiece: r.quantity,
          reductionPct,
          productionPerPiece: calcProductionPerPiece(r.quantity, reductionPct),
        };
      });
  }, [dm, bomMaterials]);

  // Default "Used For" selection = the parts this material actually appears
  // against in the Design's BOM. Only fills in materials not yet touched by
  // the user, so manual chip edits are never overwritten.
  useEffect(() => {
    setUsedForByMaterial((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const m of bomMaterials) {
        if (!(m.id in next)) {
          next[m.id] = new Set(partRows.filter((p) => p.materialId === m.id).map((p) => p.part));
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [bomMaterials, partRows]);

  // 3. Raw Material & Bundle Allocation — one row per material, bundles multi-selected.
  const materialRows = useMemo(() => {
    return bomMaterials.map((m) => {
      const availableForMaterial = allBundles.filter(
        (b) => b.materialId === m.id && b.purchasedLength - b.allocatedLength > 0.001,
      );
      const selectedSet = selectedByMaterial[m.id] ?? new Set<string>();
      const selectedBundles = availableForMaterial.filter((b) => selectedSet.has(b.id));
      const effectiveAvailable = Number(
        selectedBundles.reduce((s, b) => s + (b.purchasedLength - b.allocatedLength), 0).toFixed(2),
      );

      const partsForMaterial = partRows.filter((p) => p.materialId === m.id);
      const usedForSelected = usedForByMaterial[m.id] ?? new Set(partsForMaterial.map((p) => p.part));
      // Sets Possible is never calculated until at least one bundle is selected.
      // The selected garment parts share the same fabric pool, so a "set" consumes
      // the SUM of their Production Consumption — one shared Sets figure applies
      // to every selected part, never each part divided independently.
      const selectedRows = Array.from(usedForSelected)
        .map((part) => partsForMaterial.find((p) => p.part === part))
        .filter((row): row is (typeof partsForMaterial)[number] => !!row);
      const totalSetConsumption = selectedRows.reduce((s, row) => s + row.productionPerPiece, 0);
      const sharedSets = selectedSet.size === 0 ? null : calcSetsPossible(effectiveAvailable, totalSetConsumption);
      const setsPossible =
        selectedSet.size === 0
          ? []
          : Array.from(usedForSelected).map((part) => {
              const row = partsForMaterial.find((p) => p.part === part);
              return { part, sets: row ? sharedSets : null };
            });
      // Required Fabric is what the achievable Sets Possible actually consumes —
      // never the Production Order Quantity — so it only exists once Sets
      // Possible has been calculated (bundles selected and applied).
      const requiredFabric = sharedSets != null ? Number((sharedSets * totalSetConsumption).toFixed(2)) : null;

      return {
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
        availableForMaterial,
        selectedSet,
        effectiveAvailable,
        usedForOptions: designPartNames,
        usedForSelected,
        setsPossible,
        requiredFabric,
        noRule: !m.hasRule,
      };
    });
  }, [bomMaterials, allBundles, selectedByMaterial, usedForByMaterial, designPartNames, partRows]);

  // 4. Production Summary — bottleneck across every part of every material.
  const allSets = useMemo(
    () =>
      materialRows.flatMap((mr) =>
        mr.setsPossible
          .filter((s): s is { part: string; sets: number } => s.sets !== null)
          .map((s) => ({ ...s, materialId: mr.id, materialName: mr.name, unit: mr.unit })),
      ),
    [materialRows],
  );
  const bottleneck = useMemo(
    () => (allSets.length ? allSets.reduce((min, s) => (s.sets < min.sets ? s : min), allSets[0]) : null),
    [allSets],
  );
  const totalSelectedCount = Object.values(selectedByMaterial).reduce((s, set) => s + set.size, 0);
  // Production Summary is never calculated until at least one bundle has been Applied.
  const hasAnySelection = totalSelectedCount > 0;
  const balancedProduction = hasAnySelection && bottleneck ? bottleneck.sets : null;
  const balancedBy = hasAnySelection && bottleneck ? `${bottleneck.part} · ${bottleneck.materialName}` : null;
  const nextBalanceTarget = hasAnySelection ? orderQty : null;
  const bottleneckPartRow = bottleneck
    ? partRows.find((p) => p.part === bottleneck.part && p.materialId === bottleneck.materialId)
    : null;
  const additionalFabricRequired =
    hasAnySelection && bottleneck && bottleneckPartRow
      ? Number((Math.max(0, orderQty - bottleneck.sets) * bottleneckPartRow.productionPerPiece).toFixed(2))
      : null;
  const additionalFabricUnit = bottleneck?.unit ?? "";

  const hasWarnings = materialRows.some((mr) => mr.noRule && mr.selectedSet.size > 0);
  const canProceed =
    totalSelectedCount > 0 &&
    !hasWarnings &&
    bomMaterials.length > 0 &&
    bomMaterials.every((m) => (selectedByMaterial[m.id]?.size ?? 0) > 0);

  async function submit() {
    const bundleIds = Object.values(selectedByMaterial).flatMap((set) => Array.from(set));
    // The order configured in Workflow (Step 2), in the exact drag-and-drop
    // order, becomes the actual production execution order.
    const steps: StartProductionStep[] = workflowSteps.map((s) => ({
      operationId: s.operationId,
      workstationId: null,
      assignedTo: null,
    }));
    await start.mutateAsync({
      designId: design.id,
      orderQuantity: orderQty,
      startDate,
      supervisor: supervisor.trim(),
      bundleIds,
      steps,
    });
    onStarted?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-stretch bg-foreground/50 p-0 sm:place-items-center sm:p-4">
      <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-card shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:border sm:border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold">Start Production</h3>
            <p className="truncate text-xs text-muted-foreground">Create a new production order</p>
          </div>
          <StepBar step={step} />
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 1 ? (
            <div className="grid gap-5">
              {/* 1. Production Order Summary */}
              <Section title="1. Production Order Summary">
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-background p-3 sm:grid-cols-3">
                  <KV k="PO Number" v="Auto (PO###)" />
                  <KV k="Design" v={`${design.code} · ${design.name}`} />
                  <KV k="Customer" v={design.customer || "—"} />
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Date</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Supervisor (optional)
                    </span>
                    <input
                      value={supervisor}
                      onChange={(e) => setSupervisor(e.target.value)}
                      placeholder="e.g. Ramesh K."
                      className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold"
                    />
                  </label>
                </div>
              </Section>

              {/* 2. Fabric Consumption Per Piece */}
              <Section title="2. Fabric Consumption Per Piece">
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[560px] text-xs">
                    <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Part</th>
                        <th className="px-3 py-2 text-left">Fabric</th>
                        <th className="px-3 py-2 text-right">Sample Consumption (Per Piece)</th>
                        <th className="px-3 py-2 text-right">Reduction %</th>
                        <th className="px-3 py-2 text-right">Production Consumption (Per Piece)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {partRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                            No BOM entries. Add materials on the design first.
                          </td>
                        </tr>
                      ) : (
                        partRows.map((r, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-semibold">{r.part}</td>
                            <td className="px-3 py-2">
                              <div className="font-bold">{r.material.name}</div>
                              <div className="text-[10px] text-muted-foreground">{r.material.code}</div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              {r.samplePerPiece} {r.material.unit}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold">
                              {r.reductionPct > 0 ? `${r.reductionPct}%` : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-primary">
                              {r.productionPerPiece} {r.material.unit}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Section>

              {/* 3. Raw Material & Bundle Allocation */}
              <Section title="3. Raw Material & Bundle Allocation">
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[680px] text-xs">
                    <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">Fabric</th>
                        <th className="px-4 py-3 text-left">Bundles</th>
                        <th className="px-4 py-3 text-left">Used For</th>
                        <th className="px-4 py-3 text-left">Sets Possible</th>
                        <th className="px-4 py-3 text-right">Required Fabric</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {bundlesQ.isLoading ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center">
                            <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
                          </td>
                        </tr>
                      ) : materialRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-5 text-center text-muted-foreground">
                            No BOM materials. Add materials on the design first.
                          </td>
                        </tr>
                      ) : (
                        materialRows.map((mr) => (
                          <tr key={mr.id}>
                            <td className="px-4 py-3">
                              <div className="font-bold">{mr.name}</div>
                              <div className="text-[10px] text-muted-foreground">{mr.code}</div>
                            </td>
                            <td className="px-4 py-3">
                              <BundleMultiSelect
                                bundles={mr.availableForMaterial}
                                selected={mr.selectedSet}
                                onApply={(next) => applyBundleSelection(mr.id, next)}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <UsedForMultiSelect
                                options={mr.usedForOptions}
                                selected={mr.usedForSelected}
                                onToggle={(part) => toggleUsedFor(mr.id, part)}
                              />
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {mr.selectedSet.size === 0 ? (
                                <span className="text-[11px] italic">Select bundles to calculate</span>
                              ) : mr.setsPossible.length ? (
                                mr.setsPossible.map((s) => `${s.part} ${s.sets ?? "—"}`).join(" / ")
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-bold">
                              {mr.requiredFabric != null ? `${mr.requiredFabric} ${mr.unit}` : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {hasWarnings && (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px]">
                    <span className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Some selected materials have no Consumption Rule assigned. Assign one in Inventory before starting
                      Production.
                    </span>
                    <Link
                      to="/inventory"
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 font-bold text-primary hover:bg-accent"
                    >
                      <SettingsIcon className="h-3 w-3" /> Open Inventory
                    </Link>
                  </div>
                )}
              </Section>

              {/* 4. Production Summary */}
              <Section title="4. Production Summary">
                {!hasAnySelection && (
                  <p className="mb-2 text-[11px] font-semibold text-muted-foreground">
                    Select one or more bundles to calculate.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SummaryTile
                    icon={<CheckCircle2 className="h-4 w-4 text-success" />}
                    label="Balanced Production"
                    value={balancedProduction != null ? `${balancedProduction} pcs` : "--"}
                  />
                  <SummaryTile
                    icon={<Layers className="h-4 w-4 text-primary" />}
                    label="Balanced By"
                    value={balancedBy ?? "--"}
                  />
                  <SummaryTile
                    icon={<Target className="h-4 w-4 text-primary" />}
                    label="Next Balance Target"
                    value={nextBalanceTarget != null ? `${nextBalanceTarget} pcs` : "--"}
                  />
                  <SummaryTile
                    icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
                    label="Additional Fabric Required"
                    value={
                      additionalFabricRequired == null
                        ? "--"
                        : additionalFabricRequired > 0
                          ? `${additionalFabricRequired} ${additionalFabricUnit}`
                          : "None"
                    }
                    tone={additionalFabricRequired != null && additionalFabricRequired > 0 ? "warn" : "ok"}
                  />
                </div>
              </Section>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Workflow Configuration
                </h4>
                {!workflowInitialized && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>

              {workflowInitialized && workflowSteps.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No workflow operations available.
                </p>
              ) : (
                <DndContext
                  sensors={workflowDndSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onWorkflowDragEnd}
                >
                  <SortableContext
                    items={workflowSteps.map((s) => s.operationId)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="grid gap-2">
                      {workflowSteps.map((s, i) => (
                        <WorkflowStepRow key={s.operationId} step={s} index={i} />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}


              <p className="text-[11px] text-muted-foreground">
                Bundles will move Available → Reserved on start, and Reserved → Consumed as work completes.
              </p>
              {start.error && (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-2 text-xs font-semibold text-destructive">
                  {(start.error as Error).message}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-5 py-3">
          {step === 1 ? (
            <button
              onClick={onClose}
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-accent"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-accent"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}
          {step === 1 ? (
            <button
              onClick={() => canProceed && setStep(2)}
              disabled={!canProceed}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              Next: Workflow <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={start.isPending || workflowSteps.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {start.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlayCircle className="h-3.5 w-3.5" />
              )}
              Start Production
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-sm font-bold text-primary">{title}</h4>
      {children}
    </section>
  );
}

function StepBar({ step }: { step: 1 | 2 }) {
  return (
    <div className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide sm:flex">
      <span
        className={
          "flex items-center gap-1 rounded-full px-2 py-0.5 " +
          (step === 1 ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary")
        }
      >
        {step > 1 ? <Check className="h-3 w-3" /> : <span>1</span>} Order
      </span>
      <span className="h-px w-4 bg-border" />
      <span
        className={
          "rounded-full px-2 py-0.5 " +
          (step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")
        }
      >
        2 Workflow
      </span>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="mt-0.5 truncate text-xs font-bold">{v}</div>
    </div>
  );
}

/** One draggable, reorderable Workflow row — drag handle, step number, name. */
function WorkflowStepRow({ step, index }: { step: WorkflowStepConfig; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.operationId,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={"rounded-xl border border-border bg-background p-2.5" + (isDragging ? " shadow-lg" : "")}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-accent active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{step.name}</span>
      </div>
    </li>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 py-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted/60">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase leading-tight tracking-wide text-muted-foreground">{label}</div>
        <div
          className={
            "break-words text-sm font-bold leading-tight " +
            (tone === "warn" ? "text-amber-600 dark:text-amber-400" : "")
          }
        >
          {value}
        </div>
      </div>
    </div>
  );
}

/** Tracks the trigger's on-screen position while a floating popover is open, so the
 * popover can be portaled to <body> and never gets clipped by a scrolling table. */
function useFloatingPosition(triggerRef: React.RefObject<HTMLElement | null>, open: boolean) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }
    function update() {
      const r = triggerRef.current!.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, triggerRef]);
  return pos;
}

/** Closes a floating popover on any mousedown outside every given ref (trigger + portaled content). */
function useOutsideClose(refs: React.RefObject<HTMLElement | null>[], open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (refs.every((r) => r.current && !r.current.contains(target))) onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, refs, onClose]);
}

/** Multi-select for which of the selected Design's garment parts a material counts towards — shown as chips.
 * The chip field itself is the trigger (no separate Edit button); the option list floats in a portal so it's
 * never clipped by the table's horizontal scroll container. */
function UsedForMultiSelect({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: Set<string>;
  onToggle: (part: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const pos = useFloatingPosition(triggerRef, open);
  useOutsideClose([triggerRef, popoverRef], open, () => setOpen(false));

  return (
    <>
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen((o) => !o);
        }}
        className="flex min-h-[26px] w-full min-w-[140px] cursor-pointer flex-wrap items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 hover:border-primary"
      >
        {selected.size === 0 && <span className="text-[11px] text-muted-foreground">Select parts…</span>}
        {Array.from(selected).map((part) => (
          <span
            key={part}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary"
          >
            {part}
          </span>
        ))}
      </div>
      {open &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 180) }}
            className="z-50 rounded-lg border border-border bg-card p-1 shadow-2xl"
          >
            {options.length === 0 ? (
              <p className="px-2 py-2 text-[11px] text-muted-foreground">No garment parts on this Design.</p>
            ) : (
              options.map((part) => (
                <label
                  key={part}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(part)}
                    onChange={() => onToggle(part)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="flex-1 font-semibold">{part}</span>
                </label>
              ))
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Floating popover for a material's available bundles — opens outside the table so it's never
 * clipped, supports multi-select, and only commits the selection when Apply is clicked. */
function BundleMultiSelect({
  bundles,
  selected,
  onApply,
}: {
  bundles: MaterialBundle[];
  selected: Set<string>;
  onApply: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const pos = useFloatingPosition(triggerRef, open);
  // Deliberately no outside-click close here — the dropdown must stay open
  // until the user explicitly clicks Apply or Cancel.
  const count = bundles.filter((b) => selected.has(b.id)).length;

  function openPopover() {
    setDraft(new Set(selected));
    setOpen(true);
  }
  function toggleDraft(id: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function apply() {
    onApply(draft);
    setOpen(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPopover())}
        disabled={bundles.length === 0}
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold hover:bg-accent disabled:opacity-50"
      >
        {bundles.length === 0 ? "No Bundles" : count > 0 ? `${count} Selected` : "Select Bundles"}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 260) }}
            className="z-50 grid gap-1 rounded-lg border border-border bg-card p-1 shadow-2xl"
          >
            <div className="max-h-64 overflow-y-auto">
              {bundles.map((b) => {
                const avail = b.purchasedLength - b.allocatedLength;
                return (
                  <label
                    key={b.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={draft.has(b.id)}
                      onChange={() => toggleDraft(b.id)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="flex-1 font-semibold">Bundle {b.bundleNumber}</span>
                    <span className="text-muted-foreground">Available: {avail.toFixed(2)}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-bold hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={apply}
                className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground hover:opacity-90"
              >
                Apply
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
