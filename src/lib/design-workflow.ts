// Per-design dynamic production workflow.
//
// Every design owns its own ordered list of workflow steps. The same
// operation can appear multiple times, and any step can be skipped.
// Modules never reason about a "global" 12-stage pipeline — they always
// resolve the current step from the configured workflow.
//
// This module is intentionally a pure in-memory store today. When the
// backend is added later, only the `store` object needs to change.

import { useSyncExternalStore } from "react";
import { OPERATIONS, type OperationId, getOperation } from "./operations";

export type StepStatus = "pending" | "in-progress" | "completed" | "skipped";

export type WorkflowStep = {
  stepId: string;
  operationId: OperationId;
  sequence: number;
  label?: string;
  status: StepStatus;
  assignedTo?: string;
  quantity?: number;
  startDate?: string;
  endDate?: string;
  remarks?: string;
};

export type DesignWorkflow = {
  designCode: string;
  steps: WorkflowStep[];
};

// ---------- helpers ----------

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s-${Math.random().toString(36).slice(2, 10)}`;
}

function resequence(steps: WorkflowStep[]): WorkflowStep[] {
  return steps.map((s, i) => ({ ...s, sequence: i + 1 }));
}

function mkStep(
  operationId: OperationId,
  overrides: Partial<WorkflowStep> = {},
): WorkflowStep {
  return {
    stepId: uid(),
    operationId,
    sequence: 0,
    status: "pending",
    ...overrides,
  };
}

export function makeWorkflow(
  designCode: string,
  operationIds: OperationId[],
): DesignWorkflow {
  return {
    designCode,
    steps: resequence(operationIds.map((id) => mkStep(id))),
  };
}

// ---------- store ----------

const DEFAULT_FLOW: OperationId[] = [
  "sample-creation",
  "material-selection",
  "sample-making",
  "costing",
  "sample-approval",
  "cutting",
  "handwork",
  "stitching",
  "qc",
  "packing",
  "barcode",
  "ready-stock",
];

// Seed 3 designs matching the user's Design A/B/C examples so the UI has
// realistic variety out of the box. All others fall back to DEFAULT_FLOW.
function seed(): Record<string, DesignWorkflow> {
  const seeded: Record<string, DesignWorkflow> = {};

  // Design A: Sample → Cutting → Hand Work → Stitching → QC → Packing
  seeded["MG001"] = withDemoProgress(
    makeWorkflow("MG001", [
      "sample-approval",
      "cutting",
      "handwork",
      "stitching",
      "qc",
      "packing",
    ]),
    3,
  );

  // Design B: Sample → Cutting → Stitching → Hand Work → Stitching → QC
  seeded["MG002"] = withDemoProgress(
    makeWorkflow("MG002", [
      "sample-approval",
      "cutting",
      "stitching",
      "handwork",
      "stitching",
      "qc",
    ]),
    2,
  );

  // Design C: Sample → Cutting → Hand Work → Hand Work → Stitching → QC
  seeded["MG003"] = withDemoProgress(
    makeWorkflow("MG003", [
      "sample-approval",
      "cutting",
      "handwork",
      "handwork",
      "stitching",
      "qc",
    ]),
    4,
  );

  return seeded;
}

function withDemoProgress(wf: DesignWorkflow, doneCount: number): DesignWorkflow {
  return {
    ...wf,
    steps: wf.steps.map((s, i) => {
      if (i < doneCount) return { ...s, status: "completed" };
      if (i === doneCount) return { ...s, status: "in-progress" };
      return s;
    }),
  };
}

type Store = {
  workflows: Record<string, DesignWorkflow>;
};

const state: Store = { workflows: seed() };
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}

// ---------- reads ----------

export function getWorkflow(designCode: string): DesignWorkflow {
  const existing = state.workflows[designCode];
  if (existing) return existing;
  // Auto-provision the default full pipeline for unknown designs so the
  // configurator has something to edit and modules always resolve a step.
  const created = makeWorkflow(designCode, DEFAULT_FLOW);
  state.workflows[designCode] = created;
  return created;
}

export function getCurrentStep(wf: DesignWorkflow): WorkflowStep | undefined {
  return (
    wf.steps.find((s) => s.status === "in-progress") ??
    wf.steps.find((s) => s.status === "pending")
  );
}

export function getStepById(
  wf: DesignWorkflow,
  stepId: string | undefined,
): WorkflowStep | undefined {
  if (!stepId) return undefined;
  return wf.steps.find((s) => s.stepId === stepId);
}

/**
 * Resolve which step of the workflow this module screen is logging against.
 * Prefer an explicit `?step=<uuid>` deep link; otherwise fall back to the
 * first non-completed, non-skipped step with the matching operation.
 */
export function resolveStep(
  wf: DesignWorkflow,
  operationId: OperationId,
  stepIdParam?: string,
): WorkflowStep | undefined {
  const byId = getStepById(wf, stepIdParam);
  if (byId && byId.operationId === operationId) return byId;
  return (
    wf.steps.find(
      (s) =>
        s.operationId === operationId &&
        s.status !== "completed" &&
        s.status !== "skipped",
    ) ?? wf.steps.find((s) => s.operationId === operationId)
  );
}

export function getNextStep(
  wf: DesignWorkflow,
  fromStepId: string | undefined,
): WorkflowStep | undefined {
  if (!fromStepId) return getCurrentStep(wf);
  const idx = wf.steps.findIndex((s) => s.stepId === fromStepId);
  if (idx === -1) return undefined;
  for (let i = idx + 1; i < wf.steps.length; i++) {
    if (wf.steps[i].status !== "skipped") return wf.steps[i];
  }
  return undefined;
}

export function stepLabel(step: WorkflowStep, wf: DesignWorkflow): string {
  if (step.label) return step.label;
  const op = getOperation(step.operationId);
  // If this operation repeats in the workflow, disambiguate with a round #.
  const sameOp = wf.steps.filter((s) => s.operationId === step.operationId);
  if (sameOp.length > 1) {
    const round = sameOp.findIndex((s) => s.stepId === step.stepId) + 1;
    return `${op.name} · Round ${round}`;
  }
  return op.name;
}

// ---------- writes ----------

function mutate(designCode: string, fn: (wf: DesignWorkflow) => DesignWorkflow) {
  const current = getWorkflow(designCode);
  const next = fn(current);
  state.workflows[designCode] = { ...next, steps: resequence(next.steps) };
  emit();
}

export function updateStep(
  designCode: string,
  stepId: string,
  patch: Partial<WorkflowStep>,
) {
  mutate(designCode, (wf) => ({
    ...wf,
    steps: wf.steps.map((s) => (s.stepId === stepId ? { ...s, ...patch } : s)),
  }));
}

export function addStep(designCode: string, operationId: OperationId, atIndex?: number) {
  mutate(designCode, (wf) => {
    const step = mkStep(operationId);
    const steps = [...wf.steps];
    if (atIndex === undefined || atIndex >= steps.length) steps.push(step);
    else steps.splice(atIndex, 0, step);
    return { ...wf, steps };
  });
}

export function removeStep(designCode: string, stepId: string) {
  mutate(designCode, (wf) => ({
    ...wf,
    steps: wf.steps.filter((s) => s.stepId !== stepId),
  }));
}

export function moveStep(designCode: string, stepId: string, direction: -1 | 1) {
  mutate(designCode, (wf) => {
    const idx = wf.steps.findIndex((s) => s.stepId === stepId);
    if (idx === -1) return wf;
    const target = idx + direction;
    if (target < 0 || target >= wf.steps.length) return wf;
    const steps = [...wf.steps];
    [steps[idx], steps[target]] = [steps[target], steps[idx]];
    return { ...wf, steps };
  });
}

export function duplicateStep(designCode: string, stepId: string) {
  mutate(designCode, (wf) => {
    const idx = wf.steps.findIndex((s) => s.stepId === stepId);
    if (idx === -1) return wf;
    const src = wf.steps[idx];
    const clone: WorkflowStep = { ...src, stepId: uid(), status: "pending" };
    const steps = [...wf.steps];
    steps.splice(idx + 1, 0, clone);
    return { ...wf, steps };
  });
}

export function toggleSkip(designCode: string, stepId: string) {
  mutate(designCode, (wf) => ({
    ...wf,
    steps: wf.steps.map((s) =>
      s.stepId === stepId
        ? { ...s, status: s.status === "skipped" ? "pending" : "skipped" }
        : s,
    ),
  }));
}

export function renameStep(designCode: string, stepId: string, label: string) {
  updateStep(designCode, stepId, { label: label.trim() || undefined });
}

// ---------- React binding ----------

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Live-subscribing hook — re-renders whenever the workflow store changes. */
export function useDesignWorkflow(designCode: string): DesignWorkflow {
  return useSyncExternalStore(
    subscribe,
    () => {
      // Ensure the workflow exists in the store so getSnapshot is stable.
      return getWorkflow(designCode);
    },
    () => getWorkflow(designCode),
  );
}

export const ALL_OPERATIONS = OPERATIONS;
