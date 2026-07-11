// Derives a Design's current lifecycle stage/step/progress from its
// workflows. A "Sample" is not a separate entity — it's the sample-kind
// workflow that lives on the Design, same as bulk production is the
// bulk-kind workflow. This is the single source of truth so every screen
// (Dashboard, Design module) agrees. There is only one Design page —
// /designs/$code — with the current stage's tab pre-selected.
import { stepLabel, type DesignWorkflow, type WorkflowStep } from "@/lib/api/workflows";
import type { CatalogOperation } from "@/lib/api/operations";

export type LifecycleStage =
  | "Sample Development"
  | "Sample Approval"
  | "Bulk Production"
  | "Quality Check"
  | "Packing"
  | "Ready Stock";

export type DesignModuleTab =
  | "overview"
  | "parts"
  | "materials"
  | "sample"
  | "production"
  | "costing"
  | "documents"
  | "history";

const STAGE_BY_OPERATION: Record<string, LifecycleStage> = {
  "fabric-selection": "Sample Development",
  "sample-cutting": "Sample Development",
  "sample-handwork": "Sample Development",
  "sample-stitching": "Sample Development",
  "machine-embroidery": "Sample Development",
  "sample-qc": "Sample Development",
  "sample-approval": "Sample Approval",
  printing: "Sample Development",
  "wash-dye": "Sample Development",
  "other-process": "Sample Development",
  cutting: "Bulk Production",
  handwork: "Bulk Production",
  stitching: "Bulk Production",
  "bulk-embroidery": "Bulk Production",
  qc: "Quality Check",
  packing: "Packing",
  barcode: "Packing",
  "ready-stock": "Ready Stock",
};

const TAB_BY_STAGE: Record<LifecycleStage, DesignModuleTab> = {
  "Sample Development": "sample",
  "Sample Approval": "sample",
  "Bulk Production": "production",
  "Quality Check": "production",
  Packing: "production",
  "Ready Stock": "production",
};

export type DesignLifecycle = {
  stage: LifecycleStage;
  currentStepLabel: string;
  progressPct: number;
  /** Which Design-module tab shows this design's current stage. */
  tab: DesignModuleTab;
};

export function getDesignLifecycle(
  workflows: DesignWorkflow[],
  catalog: CatalogOperation[],
): DesignLifecycle {
  const sample = workflows.find((w) => w.kind === "sample");
  const bulk = workflows.find((w) => w.kind === "bulk");
  const active = bulk ?? sample;

  if (!active || active.steps.length === 0) {
    return {
      stage: "Sample Development",
      currentStepLabel: "Not started",
      progressPct: 0,
      tab: "sample",
    };
  }

  const total = active.steps.length;
  const done = active.steps.filter((s) => s.status === "completed").length;
  const progressPct = Math.round((done / total) * 100);

  const current: WorkflowStep =
    active.steps.find((s) => s.status === "pending" || s.status === "in-progress") ??
    active.steps[active.steps.length - 1];

  const catalogById = new Map(catalog.map((o) => [o.id, o]));
  const op = catalogById.get(current.operationId);
  const stage =
    STAGE_BY_OPERATION[current.operationId] ??
    (active.kind === "bulk" ? "Bulk Production" : "Sample Development");

  return {
    stage,
    currentStepLabel: stepLabel(current, active.steps, op?.name ?? current.operationId),
    progressPct,
    tab: TAB_BY_STAGE[stage],
  };
}
