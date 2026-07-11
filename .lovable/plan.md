## Goal

Replace the current in-memory/seeded workflow model with a real production workflow engine backed by Lovable Cloud. Each design has its own Sample Workflow, built up during sample development. Approving the sample snapshots it as the Bulk Workflow. The Bulk Workflow stays editable until bulk production begins, then locks. New designs come from a full Create Design wizard (with image upload). All demo/hardcoded design data is removed.

## Data model (Lovable Cloud / Postgres)

Tables in `public`, all with RLS + explicit GRANTs.

- **designs**
  - `id uuid pk`, `code text unique`, `name text`, `customer text`, `category text`, `fabric text`, `color text`, `order_quantity int`, `image_path text` (storage key), `status text` — one of `draft | sampling | sample_approved | in_production | completed`, `created_by uuid`, timestamps.
- **operations_catalog** (seeded, read-only for users)
  - `id text pk` (e.g. `cutting`), `name`, `short`, `category`, `repeatable bool`, `sort int`.
- **design_workflows**
  - `id uuid pk`, `design_id uuid fk`, `kind text check in ('sample','bulk')`, `locked bool default false`, `created_at`, unique `(design_id, kind)`.
- **workflow_steps**
  - `id uuid pk`, `workflow_id uuid fk`, `operation_id text fk`, `sequence int`, `label text null`, `status text check in ('pending','in-progress','completed','skipped') default 'pending'`, `assigned_to text`, `input_quantity int`, `output_quantity int`, `wastage_quantity int`, `start_date date`, `end_date date`, `remarks text`, timestamps. Index `(workflow_id, sequence)`.

Storage bucket `design-images` (public read, authenticated write).

RLS: authenticated users can CRUD their org's rows (single-tenant for now → `auth.uid() = created_by` on designs, workflow rows joined via design ownership through a `has_design_access(design_id)` SECURITY DEFINER helper). Service role bypass as usual.

## Server functions (`src/lib/*.functions.ts`)

All go through `requireSupabaseAuth`.

- `designs.functions.ts`: `listDesigns`, `getDesign(code)`, `createDesign(input)`, `updateDesign`, `uploadDesignImage` (returns signed upload URL or accepts base64 → stores in bucket).
- `workflows.functions.ts`:
  - `getWorkflows(designId)` → `{ sample, bulk }`
  - `upsertSampleStep`, `addStep(workflowId, operationId, atIndex)`, `removeStep`, `moveStep(stepId, dir)`, `reorderSteps(workflowId, orderedIds)`, `duplicateStep`, `renameStep`, `toggleSkip`, `updateStepFields` (assigned/quantities/dates/remarks/status).
  - `approveSample(designId)` — server-side snapshot: copy sample steps → new bulk workflow, set `designs.status = 'sample_approved'`.
  - `startBulkProduction(designId)` — locks the bulk workflow, sets status `in_production`.
- `operations.functions.ts`: `listOperations()` from catalog table.

Client-side reads use TanStack Query with `ensureQueryData` in loaders.

## Frontend changes

### 1. Remove demo data
- Delete seeded designs from `src/lib/designs.ts` and the seed block in `src/lib/design-workflow.ts`. Keep the operation catalog as a fallback until the DB catalog loads (single source of truth: DB, but the static list mirrors it for icon/route lookup).
- `SAMPLE_ORDERS` in `production/ui.tsx` becomes a live query for in-production designs (or is removed from module screens in favor of an actual design picker driven by DB rows).

### 2. New Design wizard (`/designs/new`)
Multi-step form:
1. Basics — code (auto-suggested), name, customer, category.
2. Specs — fabric, color, order quantity.
3. Image upload — drop zone → uploads to `design-images` bucket.
4. Sample workflow starter — optional; user can add first few operations now or later.
Submit → `createDesign` → redirect to `/designs/<code>`.

### 3. Design Details (`/designs/$code`)
- Two-tab "Workflow" section: **Sample Workflow** and **Bulk Workflow**.
- Sample tab: always editable while `status !== 'sample_approved'`. Big "Approve Sample & Generate Bulk Workflow" CTA.
- Bulk tab: appears after approval; editable while `status === 'sample_approved'`; shows "Start Bulk Production" CTA that locks it. After lock, read-only with progress.
- Both tabs render the shared **Workflow Configurator** component.

### 4. Workflow Configurator (`src/components/workflow/Configurator.tsx`)
Uses `@dnd-kit/core` + `@dnd-kit/sortable`.
- Vertical sortable list of step cards (drag handle, sequence #, operation name, status pill, quantities summary).
- Per card: edit label, duplicate, skip toggle, delete, expand to edit assigned/quantities/dates/remarks.
- Bottom "Add Operation" palette (chips grouped by category) → inserts at end or at a chosen "+" slot between existing cards.
- All mutations optimistic via TanStack Query + `invalidateQueries`.
- Disabled when workflow is `locked`.

### 5. Production modules
Each module screen (`cutting`, `handwork`, `stitching`, `qc`, `packing`, `barcode`, `stock`) keeps the `useStageChrome` hook but sources the workflow from DB via `getWorkflows(designId).bulk`. Saving a step calls `updateStepFields`. "Next" navigation reads the DB sequence.

### 6. Dashboard & list
- `/designs` lists rows from DB, empty state → "Create your first design" CTA.
- Dashboard KPIs become live counts (designs in each status).

## Files touched

New:
- Migration files for tables + storage bucket + RLS + GRANTs + operation catalog seed.
- `src/lib/designs.functions.ts`, `src/lib/workflows.functions.ts`, `src/lib/operations.functions.ts`.
- `src/routes/designs.new.tsx` (wizard).
- `src/components/workflow/Configurator.tsx`, `StepCard.tsx`, `AddOperationPalette.tsx`.

Rewritten:
- `src/lib/designs.ts` → thin types + query hooks (no mock data).
- `src/lib/design-workflow.ts` → server-backed helpers + query hooks (no seed).
- `src/routes/designs.index.tsx`, `src/routes/designs.$code.tsx`, `src/routes/designs.$code.workflow.tsx` (becomes redirect into the details tab, or removed).
- `src/routes/index.tsx` (live KPIs).
- `src/components/production/ui.tsx` (drop `SAMPLE_ORDERS`).
- All production module routes (DB-backed step reads/writes).

Dependency: `bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`.

## Out of scope for this pass
- Multi-tenant orgs / role-based permissions (Production Manager vs operator). All authenticated users can edit for now; noted in a follow-up.
- Real-time collaboration on the configurator (single-user optimistic updates only).
- ERPNext sync.

## Technical notes
- `approveSample` runs in a single SQL transaction (RPC) so the snapshot is atomic.
- `locked` on bulk workflows is enforced by both an RLS/CHECK trigger and the client (disabled UI). Modules can still write step **execution** fields (status/quantities/dates/remarks) on a locked workflow — the lock only blocks structural changes (add/remove/reorder/rename/skip).
- Step identity remains UUID so deep links (`?step=<uuid>`) keep working.
- Image upload goes through a signed-URL flow to keep the service role out of the client.
