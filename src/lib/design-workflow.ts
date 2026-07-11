// Legacy shim. Workflow data now lives in Supabase.
// See src/lib/api/workflows.ts for the real hooks and CRUD.
//
// The old in-memory store hooks (useDesignWorkflow, resolveStep, etc.) still
// exist for the production module screens (cutting/handwork/stitching/etc.)
// that were written before the DB migration. They return an in-memory shape
// derived from the operation catalog and marked as unlocked. This keeps those
// legacy screens compiling; the Designs > Configure Workflow flow uses the
// live DB hooks directly.

import { useMemo } from "react";
import { OPERATIONS, type OperationId } from "./operations";

export type StepStatus = "pending" | "in-progress" | "completed" | "skipped";

export type WorkflowStep = {
  stepId: string;
  operationId: OperationId;
  sequence: number;
  label?: string;
  status: StepStatus;
};

export type DesignWorkflow = {
  designCode: string;
  steps: WorkflowStep[];
};

const DEFAULT_FLOW: OperationId[] = [
  "cutting", "handwork", "stitching", "qc", "packing", "barcode", "ready-stock",
];

function build(code: string): DesignWorkflow {
  return {
    designCode: code,
    steps: DEFAULT_FLOW.map((id, i) => ({
      stepId: `${code}-${id}-${i}`,
      operationId: id,
      sequence: i + 1,
      status: "pending",
    })),
  };
}

export function useDesignWorkflow(designCode: string): DesignWorkflow {
  return useMemo(() => build(designCode), [designCode]);
}

export function getCurrentStep(wf: DesignWorkflow): WorkflowStep | undefined {
  return wf.steps.find((s) => s.status !== "completed" && s.status !== "skipped");
}

export function resolveStep(
  wf: DesignWorkflow,
  operationId: OperationId,
  stepIdParam?: string,
): WorkflowStep | undefined {
  if (stepIdParam) {
    const byId = wf.steps.find((s) => s.stepId === stepIdParam);
    if (byId) return byId;
  }
  return wf.steps.find((s) => s.operationId === operationId);
}

export function getNextStep(
  wf: DesignWorkflow,
  fromStepId: string | undefined,
): WorkflowStep | undefined {
  if (!fromStepId) return getCurrentStep(wf);
  const idx = wf.steps.findIndex((s) => s.stepId === fromStepId);
  if (idx < 0) return undefined;
  for (let i = idx + 1; i < wf.steps.length; i++) {
    if (wf.steps[i].status !== "skipped") return wf.steps[i];
  }
  return undefined;
}

export function stepLabel(step: WorkflowStep, wf: DesignWorkflow): string {
  if (step.label) return step.label;
  const op = OPERATIONS.find((o) => o.id === step.operationId);
  const same = wf.steps.filter((s) => s.operationId === step.operationId);
  if (same.length > 1) {
    const round = same.findIndex((s) => s.stepId === step.stepId) + 1;
    return `${op?.name ?? step.operationId} · Round ${round}`;
  }
  return op?.name ?? step.operationId;
}

export const ALL_OPERATIONS = OPERATIONS;
