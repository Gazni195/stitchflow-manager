// Legacy shim. The "12-stage" fixed WORKFLOW no longer drives production —
// each design owns its own configurable workflow (see design-workflow.ts).
// This constant is retained only so the sidebar, dashboard grid, and the
// generic StagePage placeholders keep rendering the operation catalog in
// a canonical order. New code should import from ./operations directly.

import { OPERATIONS, type Operation, type OperationCategory } from "./operations";

export type WorkflowStage = Operation & {
  step: number;
  title: string;
  to: string;
  phase: OperationCategory;
};

export const WORKFLOW: WorkflowStage[] = OPERATIONS.map((op, i) => ({
  ...op,
  step: i + 1,
  title: op.name,
  to: op.route,
  phase: op.category,
}));
