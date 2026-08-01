# Start Production Redesign — Analysis & Plan

## 1. Current state (findings)

**Start Production popup** (`src/routes/production.index.tsx` → `StartProductionDialog`)
- Only 3 fields: Order Quantity, Start Date, Supervisor. No material/bundle allocation, no consumption logic.
- Calls RPC `start_production(_design_id, _order_quantity, _start_date, _supervisor)` which just creates a `production_orders` row and seeds the 5 fixed processes (`cutting → handwork → embroidery → stitching → qc`).
- Sets `designs.status = 'in_production'`.

**Production Order workflow** (`src/routes/production.$po.tsx`, `src/lib/api/production.ts`)
- Stage list uses fixed `PROCESS_OPERATIONS`. Issue bundle / complete process RPCs already exist (`issue_bundle`, `complete_process`).
- Workstation is chosen at issue-time (already wired to `workstation_config`).

**Material / Bundle allocation**
- `production_reservations` table exists (material_id + quantity + lot_code), but the Start dialog never populates it. Reservations are added later on the PO detail page.
- `inventory_bundles` (per material) has `purchased_length`, `layer_length`, `fabric_width`, `allocated_length`, `status` maintained by triggers `set_bundle_status` + `recompute_material_stock`.
- No link between a reservation and a specific bundle id.

**Consumption reduction**
- No "reduction %" exists anywhere in code today (grep confirms only prose mentions). The requirement is net-new — nothing to remove, but the new rule engine must be introduced.

**Materials**
- `materials` table has no `fabric_type` column. Needed for rule matching.

**Design consumption (BOM)**
- `design_materials` stores per-part quantity (units per piece). Required fabric per piece = Σ(quantity) per material — this feeds "Required Fabric".

**Settings**
- Settings shell + `/settings/workstations` exists. No production-settings section yet.

---

## 2. Database changes (single migration)

1. `materials.fabric_type text null` — free-text; suggestions in UI, no enum (nothing hardcoded).
2. New table `consumption_reduction_rules`:
   - `name text not null`
   - `fabric_type text not null`
   - `width_min numeric, width_max numeric` (inches)
   - `layer_min numeric, layer_max numeric` (cm)
   - `reduction_pct numeric not null` (0–100)
   - `status text not null default 'active'` check in (`active`,`inactive`)
   - timestamps + `updated_at` trigger
   - GRANTs (`authenticated` full CRUD via `has_permission('settings.edit')`; SELECT for all authenticated for lookup)
   - RLS: read = authenticated; write = `has_permission(auth.uid(),'settings.edit')`.
3. Extend `production_reservations` with `bundle_id uuid null references inventory_bundles(id)` so a reservation targets a specific roll. Keep `material_id` for aggregation.
4. New RPC `start_production_v2(_design_id, _order_quantity, _start_date, _supervisor, _bundle_ids uuid[])`:
   - Locks each bundle row, sets `allocated_length = purchased_length` (trigger flips status to `consumed`… but we want `reserved` — so instead insert a `production_reservations` row per bundle with `quantity = layer_length_effective` and increment `allocated_length` by effective consumption). Actual per-piece consumption stays server-side, not user-editable.
   - Creates PO + seeds fixed 5 processes (unchanged behavior).
   - Marks design `in_production`.
   - Bundle status transitions handled by existing trigger via `allocated_length` updates.

---

## 3. Settings changes

New route **`/settings/production`** (index) with a sub-page **`/settings/production/reduction-rules`**:
- Table: Name · Fabric Type · Width range · Layer range · Reduction % · Status · actions.
- Create / Edit dialog (reuse existing form primitives in `src/components/settings/shared.tsx`).
- Enable/Disable toggle, Delete confirm, Preview (shows a sample calc).
- Sidebar link added under Settings.

API module: `src/lib/api/reduction-rules.ts` (list/create/update/delete/toggle).

---

## 4. Production calculation

New pure helper `src/lib/production-calc.ts`:
```
requiredPerPiece = Σ design_materials.quantity for the selected fabric material
requiredTotal    = requiredPerPiece × orderQuantity
for each selected bundle:
  rule = findRule({ fabricType, width, layerLength }) // status=active, ranges inclusive
  if !rule → return { error: "No matching rule…" }
  effectiveLength = purchasedLength × (1 - rule.reductionPct/100)
  piecesFromBundle = floor(effectiveLength / requiredPerPiece)
allocatedFabric   = Σ effectiveLength
balanceFabric     = requiredTotal - allocatedFabric
maxPossiblePieces = Σ piecesFromBundle
```
UI shows the rule name + % actually applied per bundle, and a summary row.

Start button disabled while any selected bundle has no matching active rule; inline warning references Settings link.

---

## 5. UI — 2-step wizard (reuses existing Dialog + Field primitives)

**Progress header:** `1 Production Order → 2 Workflow Configuration`

**Step 1 — Production Order**
- Read-only header: PO#(auto), Design Code + Name, Customer.
- Supervisor (optional).
- **Raw Material Allocation** table: pick fabric material → list its `available` bundles (Bundle#, Available Qty, Layer Length, Width) with checkbox multi-select.
- **Production Summary** card: Required / Allocated / Balance / Max Pieces / Applied Rules list.

**Step 2 — Workflow Configuration**
- Reuses existing process list (Cutting / Handwork / Embroidery / Stitching / QC) with per-process default Workstation + Supervisor selectors (persist to `production_processes.assigned_to` / preset workstation stored in `notes` JSON for now, no schema change).

**Footer:** Back · Start Production.

Responsive: `sm:` centered modal (max-w-2xl), `md:` wider (max-w-4xl), mobile full-screen sheet.

---

## 6. Migration plan

1. Apply DB migration (fabric_type, rules table, bundle_id on reservations, RPC).
2. Add API modules + calc helper.
3. Build Settings pages.
4. Refactor `StartProductionDialog` into the 2-step wizard component (new file `src/components/production/StartProductionWizard.tsx`).
5. Wire wizard into `production.index.tsx`; delete old dialog.
6. Add `fabric_type` field to Inventory create/edit forms (`src/routes/inventory.tsx`) — optional but needed for rule matching.

Backward compatibility: old `start_production` RPC left in place; page switches to v2.

---

## 7. Files to modify / create

**New**
- `supabase` migration (schema + RPC + grants + RLS)
- `src/lib/api/reduction-rules.ts`
- `src/lib/production-calc.ts`
- `src/components/production/StartProductionWizard.tsx`
- `src/routes/settings.production.tsx` (index)
- `src/routes/settings.production.reduction-rules.tsx`

**Modified**
- `src/routes/production.index.tsx` — swap dialog for wizard
- `src/lib/api/production.ts` — add `useStartProductionV2`
- `src/lib/api/production-reservations.ts` — accept `bundleId`
- `src/lib/api/materials.ts` + `src/routes/inventory.tsx` — add `fabric_type` field
- `src/routes/settings.tsx` (sidebar) — add Production section link
- `src/integrations/supabase/types.ts` — regenerated post-migration

**Untouched**
- `production.$po.tsx`, workstations, approvals, workflow engine — no functional changes.

---

## 8. Guarantees
- No hardcoded fabric types, widths, lengths or percentages anywhere.
- Users cannot enter reduction % during production.
- Bundle status transitions remain trigger-driven.
- Existing components (Dialog Field, DesignImage, workstation selector) reused.
