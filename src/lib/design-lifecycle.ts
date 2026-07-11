// Derives a Design's current lifecycle stage/step/progress from its
// workflows. A "Sample" is not a separate entity — it's the sample-kind
// workflow that lives on the Design, same as bulk production is the
// bulk-kind workflow. This is the single source of truth for both so
// every screen (Dashboard, Design Details, Sample Development) agrees.
import { stepLabel, type DesignWorkflow, type WorkflowStep } from "@/lib/api/workflows";
import type { CatalogOperation } from "@/lib/api/operations";

export type LifecycleStage =
  | "Sample Development"
  | "Sample Approval"
  | "Bulk Production"
  | "Quality Check"
  | "Packing"
  | "Ready Stock";

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

export type DesignLifecycle = {
  stage: LifecycleStage;
  currentStepLabel: string;
  progressPct: number;
  /** Route pattern for the "Continue" action — always design-keyed. */
  continueTo: "/sample-development/$code" | "/designs/$code";
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
      continueTo: "/sample-development/$code",
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
    continueTo: active.kind === "bulk" ? "/designs/$code" : "/sample-development/$code",
  };
}
