// Shared types + label helpers for the real (saved) bulk production workflow.
import { OPERATIONS } from "./operations";

export type StepStatus = "pending" | "in-progress" | "completed" | "skipped";

export type WorkflowStep = {
  stepId: string;
  operationId: string;
  sequence: number;
  label?: string;
  status: StepStatus;
};

export type DesignWorkflow = {
  designCode: string;
  steps: WorkflowStep[];
};

/** Fallback display names for process operations not in the design catalog. */
const OPERATION_NAMES: Record<string, string> = {
  cutting: "Bulk Cutting",
  handwork: "Bulk Hand Work",
  embroidery: "Machine Embroidery",
  stitching: "Bulk Stitching",
  qc: "Quality Check",
  packing: "Packing",
  barcode: "Barcode",
  "ready-stock": "Ready Stock",
};

const OPERATION_ROUTES: Record<string, string> = {
  cutting: "/cutting",
  handwork: "/handwork",
  embroidery: "/handwork",
  stitching: "/stitching",
  qc: "/qc",
  packing: "/packing",
  barcode: "/barcode",
  "ready-stock": "/stock",
};

export function operationName(operationId: string): string {
  return (
    OPERATIONS.find((o) => o.id === operationId)?.name ??
    OPERATION_NAMES[operationId] ??
    operationId
  );
}
export function operationShort(operationId: string): string {
  return (
    OPERATIONS.find((o) => o.id === operationId)?.short ??
    OPERATION_NAMES[operationId] ??
    operationId
  );
}
export function operationRoute(operationId: string): string | undefined {
  return (
    OPERATIONS.find((o) => o.id === operationId)?.route ??
    OPERATION_ROUTES[operationId]
  );
}

export function stepLabel(step: WorkflowStep, wf: DesignWorkflow): string {
  if (step.label) return step.label;
  const same = wf.steps.filter((s) => s.operationId === step.operationId);
  if (same.length > 1) {
    const round = same.findIndex((s) => s.stepId === step.stepId) + 1;
    return `${operationName(step.operationId)} · Round ${round}`;
  }
  return operationName(step.operationId);
}

