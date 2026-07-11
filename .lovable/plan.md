## Goal

Replace the fixed 12-stage workflow with per-design, configurable workflows where operations can repeat, be skipped, or reordered. Every workflow step becomes a first-class tracked entity.

## Core architectural changes

### 1. Operation Catalog (`src/lib/operations.ts` — new)
A flat, non-sequential registry of available operations the factory can perform. Operations are building blocks, not stages.

```ts
export type OperationId =
  | "sample-creation" | "material-selection" | "sample-making" | "costing" | "sample-approval"
  | "cutting" | "handwork" | "stitching" | "qc" | "packing" | "barcode" | "ready-stock";

export type Operation = {
  id: OperationId;
  name: string;          // "Bulk Stitching"
  short: string;         // "Stitching"
  icon: LucideIcon;
  route: string;         // module route used to log work
  category: "Sample" | "Bulk" | "Finishing";
  repeatable: boolean;   // stitching/handwork = true
};
```

No ordering, no `step` number. `WORKFLOW` in `src/lib/workflow.ts` is deleted; anything that imported it now imports from `operations.ts`.

### 2. Design Workflow Model (`src/lib/design-workflow.ts` — new)
Each design owns an ordered list of workflow steps. Same operation can appear multiple times — each instance is a distinct step with its own tracking.

```ts
export type StepStatus = "pending" | "in-progress" | "completed" | "skipped";

export type WorkflowStep = {
  stepId: string;             // stable uuid, unique per design
  operationId: OperationId;
  sequence: number;           // position in this design's flow
  label?: string;             // optional override ("Stitching — Round 2")
  status: StepStatus;
  assignedTo?: string;        // team or worker
  quantity?: number;
  startDate?: string;
  endDate?: string;
  remarks?: string;
};

export type DesignWorkflow = {
  designCode: string;
  steps: WorkflowStep[];
};
```

Helpers:
- `getWorkflow(code)` — returns the design's step list (mock store for now).
- `getCurrentStep(wf)` / `getNextStep(wf, fromStepId)` — always compute from configured steps, never a global constant.
- `updateStep(wf, stepId, patch)` — immutable update.
- `addStep`, `removeStep`, `moveStep`, `duplicateStep` — used by the configurator.

Mock data seeds 2–3 designs with different flows (matching the user's Design A/B/C examples) so the UI has realistic variety.

### 3. Workflow Configurator (`src/routes/designs.$code.workflow.tsx` — new)
Production-manager screen to build/edit a design's workflow.

- Left/top: current ordered step list (draggable cards with up/down buttons — no dnd library, just reorder controls to stay dependency-free).
- Right/bottom: "Add operation" palette listing all operations from the catalog; tapping one appends a step.
- Per step: rename label, delete, duplicate (for repeated operations), toggle "skip".
- Save action persists to the mock store.

Link from `designs.$code.tsx` header: "Configure Workflow".

### 4. Design Details rework (`src/routes/designs.$code.tsx`)
Progress list is driven by the design's own `steps` (not the global WORKFLOW). Shows repeats correctly ("Stitching · Round 2"), skipped steps dimmed, current step highlighted.

### 5. Stage / module screens become operation-agnostic
Today every module (`cutting.tsx`, `stitching.tsx`, `handwork.tsx`, `qc.tsx`, `packing.tsx`, `barcode.tsx`, `stock.tsx`) hardcodes:
- its position ("Step 8 of 12"),
- the "Continue to X" next-stage link,
- a fixed timeline via `buildTimeline(...)`.

Changes:
- Each module reads the selected order/design, looks up its workflow, and finds the **current step** matching that operation (by `stepId` from a query param `?step=<stepId>` when navigated from the design page, otherwise the first non-completed step of that operation type).
- Header subtitle becomes `Step {sequence} of {total} · {category}` derived from the design's workflow.
- The "Continue to …" button uses `getNextStep(wf, currentStepId)` — routes to that operation's module with `?step=<nextStepId>`. If no next step, shows "Finish workflow".
- The bottom timeline renders the design's actual step list, not the global one. `buildTimeline` in `src/components/production/ui.tsx` is rewritten to accept `(steps, currentStepId)` and render dynamically, including repeats.
- Save/Complete buttons call `updateStep(...)` on the mock store with quantity/assigned/dates/remarks/status.

### 6. Dashboard (`src/routes/index.tsx`) + AppShell nav
- Dashboard's "workflow stages" grid becomes an "Operations" grid sourced from the operation catalog (no numbered steps).
- Sidebar/bottom nav keeps the same top-level entries (Dashboard, Designs, Samples, plus a few key operation shortcuts) but drops any "Step N of 12" phrasing.

### 7. Shared production UI (`src/components/production/ui.tsx`)
- `buildTimeline(currentTitle)` → replaced by `buildTimelineFromWorkflow(steps, currentStepId)`.
- `ProductionTimeline` renders `{sequence}. {label ?? operation.name}` and supports repeated operations + skipped state.
- `SAMPLE_ORDERS` gains a `designCode` link so modules can resolve the correct workflow.

## Files touched

New:
- `src/lib/operations.ts`
- `src/lib/design-workflow.ts`
- `src/routes/designs.$code.workflow.tsx`

Rewritten:
- `src/lib/workflow.ts` — thin shim re-exporting from `operations.ts` during migration, then deleted once callers move (done in same pass).
- `src/components/production/ui.tsx` — dynamic timeline + workflow-aware helpers.
- `src/routes/designs.$code.tsx` — workflow-driven progress + link to configurator.
- `src/routes/index.tsx` — operation grid.
- `src/routes/cutting.tsx`, `handwork.tsx`, `stitching.tsx`, `qc.tsx`, `packing.tsx`, `barcode.tsx`, `stock.tsx` — read/write via `design-workflow` helpers; dynamic subtitle, next-step button, timeline.
- `src/components/AppShell.tsx` — remove "12-stage" language, keep nav.
- `src/components/StagePage.tsx` — becomes an operation-based placeholder for sample-stage routes still using it.

Out of scope (kept as-is for this pass):
- Persistence beyond an in-memory mock store. When Cloud is enabled later, `design-workflow.ts` swaps its store for Supabase-backed reads/writes without changing callers.
- Drag-and-drop reordering (up/down buttons are enough for now).
- Role-based access control on the configurator.

## Technical notes

- Step identity uses `crypto.randomUUID()` at creation. Route deep-links carry `?step=<uuid>` so a module knows *which* instance of a repeated operation it's logging against.
- All workflow reads/writes go through pure helpers in `design-workflow.ts` — modules never mutate structures directly, making the future Supabase swap mechanical.
- `getNextStep` skips over `status === "skipped"` and stops at the first `pending` step after the current one.
