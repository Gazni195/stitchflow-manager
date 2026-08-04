// Bulk Production Activities — multi-activity log per Production Order.
// Each activity captures Start Time, End Time, Elapsed Time, Effective
// Working Time (via the Factory Working Clock), assigned worker/team/line,
// issued qty and returned qty. Kept separate from the older
// `production_processes` model so the new operator-focused workflow can
// evolve independently.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_FACTORY_CALENDAR, effectiveWorkingSeconds, elapsedSeconds } from "@/lib/factory-clock";

export type ActivityOperationId =
  | "cutting"
  | "handwork"
  | "embroidery"
  | "stitching"
  | "printing"
  | "washing"
  | "qc"
  | "packing";

export const ACTIVITY_OPERATIONS: { id: ActivityOperationId; name: string; sequence: number }[] = [
  { id: "cutting", name: "Cutting", sequence: 1 },
  { id: "handwork", name: "Hand Work", sequence: 2 },
  { id: "embroidery", name: "Machine Embroidery", sequence: 3 },
  { id: "printing", name: "Printing", sequence: 4 },
  { id: "washing", name: "Washing", sequence: 5 },
  { id: "stitching", name: "Stitching", sequence: 6 },
  { id: "qc", name: "QC", sequence: 7 },
  { id: "packing", name: "Packing", sequence: 8 },
];
export const ACTIVITY_OP_NAME: Record<ActivityOperationId, string> = Object.fromEntries(
  ACTIVITY_OPERATIONS.map((o) => [o.id, o.name]),
) as Record<ActivityOperationId, string>;

// pending  = assigned to a workstation/employee, operator hasn't started it
// running  = operator's clock is ticking
// paused   = operator paused mid-work; elapsed/effective time stop accruing
// completed / cancelled = terminal
export type ActivityStatus = "pending" | "running" | "paused" | "completed" | "cancelled";

export type SizeCode = "S" | "M" | "L" | "XL" | "XXL" | "XXXL" | "4XL" | "5XL";
export const STANDARD_SIZES: SizeCode[] = ["M", "L", "XL", "XXL"];
export const SMALL_SIZES: SizeCode[] = ["S"];
export const PLUS_SIZES: SizeCode[] = ["XXXL", "4XL", "5XL"];
export const ALL_SIZES: SizeCode[] = ["S", "M", "L", "XL", "XXL", "XXXL", "4XL", "5XL"];
export type SizeBreakdown = Partial<Record<SizeCode, number>>;

export function sumSizeBreakdown(b: SizeBreakdown | null | undefined): number {
  if (!b) return 0;
  return Object.values(b).reduce((s, v) => s + (Number(v) || 0), 0);
}

export type ProductionActivity = {
  id: string;
  productionOrderId: string;
  workstationId: string | null;
  operationId: ActivityOperationId;
  assignedTo: string;
  issuedQty: number;
  returnedQty: number | null;
  notes: string | null;
  status: ActivityStatus;
  /** When a supervisor assigned this job to a workstation/employee. Always set. */
  assignedAt: string;
  /** When the operator actually started the clock. Null while status='pending'. */
  startedAt: string | null;
  completedAt: string | null;
  /** When the current pause began. Null unless status='paused'. */
  pausedAt: string | null;
  /** Total accumulated pause time (closed intervals only — see pausedAt for any open one). */
  pausedSeconds: number;
  elapsedSeconds: number | null;
  effectiveSeconds: number | null;
  sizeBreakdown: SizeBreakdown | null;
  issuedSizes: SizeBreakdown | null;
  completedSizes: SizeBreakdown | null;
  varianceReason: string | null;
};

// Exported so lib/api/workstations.ts (which queries this same table
// across production orders for the Workstation Queue) can share the row
// shape and mapActivityRow instead of duplicating them.
export type DbActivityRow = {
  id: string;
  production_order_id: string;
  workstation_id: string | null;
  operation_id: string;
  assigned_to: string;
  issued_qty: number;
  returned_qty: number | null;
  notes: string | null;
  status: ActivityStatus;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  paused_at: string | null;
  paused_seconds: number;
  elapsed_seconds: number | null;
  effective_seconds: number | null;
  size_breakdown: SizeBreakdown | null;
  issued_sizes: SizeBreakdown | null;
  completed_sizes: SizeBreakdown | null;
  variance_reason: string | null;
};

export const ACTIVITY_COLUMNS =
  "id, production_order_id, workstation_id, operation_id, assigned_to, issued_qty, returned_qty, notes, status, " +
  "assigned_at, started_at, completed_at, paused_at, paused_seconds, elapsed_seconds, effective_seconds, " +
  "size_breakdown, issued_sizes, completed_sizes, variance_reason";

// Exported so the Workstation Queue page (lib/api/workstations.ts), which
// reads this same table across production orders, maps rows the same way
// instead of duplicating the shape.
export function mapActivityRow(r: DbActivityRow): ProductionActivity {
  return {
    id: r.id,
    productionOrderId: r.production_order_id,
    workstationId: r.workstation_id ?? null,
    operationId: r.operation_id as ActivityOperationId,
    assignedTo: r.assigned_to,
    issuedQty: r.issued_qty,
    returnedQty: r.returned_qty,
    notes: r.notes,
    status: r.status,
    assignedAt: r.assigned_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    pausedAt: r.paused_at,
    pausedSeconds: r.paused_seconds ?? 0,
    elapsedSeconds: r.elapsed_seconds,
    effectiveSeconds: r.effective_seconds,
    sizeBreakdown: r.size_breakdown ?? null,
    issuedSizes: r.issued_sizes ?? null,
    completedSizes: r.completed_sizes ?? null,
    varianceReason: r.variance_reason ?? null,
  };
}

// Latest completed Cutting activity for a PO = master size bundle.
export function findCuttingBundle(activities: ProductionActivity[] | undefined): {
  activity: ProductionActivity;
  bundle: SizeBreakdown;
  total: number;
} | null {
  if (!activities?.length) return null;
  const completed = activities
    .filter((a) => a.operationId === "cutting" && a.status === "completed" && a.sizeBreakdown)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const top = completed[0];
  if (!top || !top.sizeBreakdown) return null;
  return { activity: top, bundle: top.sizeBreakdown, total: sumSizeBreakdown(top.sizeBreakdown) };
}

// Once Cutting is completed, its actual output becomes the master
// production quantity for every remaining operation. The Production
// Order's original quantity never changes — it stays fixed as the
// "Planned Qty" for reference only.
export function currentProductionQuantity(orderQuantity: number, activities: ProductionActivity[] | undefined): number {
  const bundle = findCuttingBundle(activities);
  return bundle ? bundle.total : orderQuantity;
}

// Selling-set templates for Size Set Calculation — a Planning/Marketing
// view over the Cutting size breakdown; nothing here is persisted.
export type SetTemplateId = "m-xxl" | "s-xxl" | "m-xxxl" | "m-4xl";
export const SET_TEMPLATES: { id: SetTemplateId; label: string; sizes: SizeCode[] }[] = [
  { id: "m-xxl", label: "M → XXL", sizes: ["M", "L", "XL", "XXL"] },
  { id: "s-xxl", label: "S → XXL", sizes: ["S", "M", "L", "XL", "XXL"] },
  { id: "m-xxxl", label: "M → XXXL", sizes: ["M", "L", "XL", "XXL", "XXXL"] },
  { id: "m-4xl", label: "M → 4XL", sizes: ["M", "L", "XL", "XXL", "XXXL", "4XL"] },
];
export const DEFAULT_SET_TEMPLATE: SetTemplateId = "m-xxl";

// Complete sets = the smallest size count within the template (the
// bottleneck size); remaining = whatever's left per size once that many
// sets are pulled out.
export function computeSizeSets(
  breakdown: SizeBreakdown,
  templateSizes: SizeCode[],
): { completeSets: number; remaining: SizeBreakdown } {
  if (templateSizes.length === 0) return { completeSets: 0, remaining: {} };
  const counts = templateSizes.map((s) => breakdown[s] ?? 0);
  const completeSets = Math.min(...counts);
  const remaining: SizeBreakdown = {};
  templateSizes.forEach((s, i) => {
    const rem = counts[i] - completeSets;
    if (rem > 0) remaining[s] = rem;
  });
  return { completeSets, remaining };
}

export function useProductionActivities(productionOrderId: string | undefined) {
  return useQuery({
    queryKey: ["production-activities", productionOrderId],
    enabled: !!productionOrderId,
    queryFn: async (): Promise<ProductionActivity[]> => {
      const { data, error } = await supabase
        .from("production_activities")
        .select(ACTIVITY_COLUMNS)
        .eq("production_order_id", productionOrderId!)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as DbActivityRow[]).map(mapActivityRow);
    },
  });
}

function invalidateActivity(qc: ReturnType<typeof useQueryClient>, productionOrderId: string) {
  qc.invalidateQueries({ queryKey: ["production-activities", productionOrderId] });
  qc.invalidateQueries({ queryKey: ["workstation-cards"] });
  qc.invalidateQueries({ predicate: (query) => query.queryKey[0] === "workstation-history" });
}

// Books a job onto a workstation/employee without starting the clock —
// STEP 1 (Assign) of the Workstation Queue flow. Creates a 'pending' row;
// the operator promotes it to 'running' from the Workstation Queue page
// (useBeginActivity below).
export function useAssignActivity(productionOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      operationId: ActivityOperationId;
      assignedTo: string;
      issuedQty: number;
      issuedSizes?: SizeBreakdown | null;
      notes?: string;
      workstationId?: string | null;
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("production_activities").insert({
        production_order_id: productionOrderId,
        workstation_id: v.workstationId ?? null,
        operation_id: v.operationId,
        assigned_to: v.assignedTo,
        issued_qty: v.issuedQty,
        issued_sizes: v.issuedSizes ?? null,
        notes: v.notes?.trim() || null,
        status: "pending",
        assigned_at: new Date().toISOString(),
        started_at: null,
        created_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateActivity(qc, productionOrderId),
  });
}

// Operations with no workstation concept (printing, washing, qc, packing —
// see WORKSTATION_TYPE_OPERATION in lib/api/workstations.ts) have no queue
// to sit in, so they keep the old immediate-start behavior: this creates an
// already-'running' row directly, same as before the Workstation Queue.
export function useStartActivity(productionOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      operationId: ActivityOperationId;
      assignedTo: string;
      issuedQty: number;
      issuedSizes?: SizeBreakdown | null;
      notes?: string;
      workstationId?: string | null;
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const { error } = await supabase.from("production_activities").insert({
        production_order_id: productionOrderId,
        workstation_id: v.workstationId ?? null,
        operation_id: v.operationId,
        assigned_to: v.assignedTo,
        issued_qty: v.issuedQty,
        issued_sizes: v.issuedSizes ?? null,
        notes: v.notes?.trim() || null,
        status: "running",
        assigned_at: now,
        started_at: now,
        created_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateActivity(qc, productionOrderId),
  });
}

// STEP 3 (Start Work): operator promotes a pending assignment to running
// from the Workstation Queue page. This is the only place started_at is
// ever set for a workstation-bound job — the timer reflects real work
// time, not assignment time.
export function useBeginActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (activity: ProductionActivity) => {
      const { error } = await supabase
        .from("production_activities")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", activity.id)
        .eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: (_data, activity) => invalidateActivity(qc, activity.productionOrderId),
  });
}

export function usePauseActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (activity: ProductionActivity) => {
      const { error } = await supabase
        .from("production_activities")
        .update({ status: "paused", paused_at: new Date().toISOString() })
        .eq("id", activity.id)
        .eq("status", "running");
      if (error) throw error;
    },
    onSuccess: (_data, activity) => invalidateActivity(qc, activity.productionOrderId),
  });
}

export function useResumeActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (activity: ProductionActivity) => {
      const pausedSince = activity.pausedAt ? elapsedSeconds(new Date(activity.pausedAt), new Date()) : 0;
      const { error } = await supabase
        .from("production_activities")
        .update({
          status: "running",
          paused_at: null,
          paused_seconds: activity.pausedSeconds + pausedSince,
        })
        .eq("id", activity.id)
        .eq("status", "paused");
      if (error) throw error;
    },
    onSuccess: (_data, activity) => invalidateActivity(qc, activity.productionOrderId),
  });
}

export function useCompleteActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      activity: ProductionActivity;
      returnedQty: number;
      sizeBreakdown?: SizeBreakdown | null;
      completedSizes?: SizeBreakdown | null;
      varianceReason?: string | null;
    }) => {
      const end = new Date();
      const start = new Date(v.activity.startedAt ?? v.activity.assignedAt);
      // Completing while paused is allowed (operator forgot to resume) —
      // fold the still-open pause interval in before subtracting it out.
      const openPause =
        v.activity.status === "paused" && v.activity.pausedAt
          ? elapsedSeconds(new Date(v.activity.pausedAt), end)
          : 0;
      const totalPaused = v.activity.pausedSeconds + openPause;
      const rawElapsed = elapsedSeconds(start, end);
      const rawEffective = effectiveWorkingSeconds(start, end, DEFAULT_FACTORY_CALENDAR);
      const patch = {
        status: "completed" as const,
        completed_at: end.toISOString(),
        returned_qty: v.returnedQty,
        elapsed_seconds: Math.max(0, rawElapsed - totalPaused),
        effective_seconds: Math.max(0, rawEffective - totalPaused),
        paused_seconds: totalPaused,
        paused_at: null,
        ...(v.sizeBreakdown !== undefined ? { size_breakdown: v.sizeBreakdown as SizeBreakdown | null } : {}),
        ...(v.completedSizes !== undefined ? { completed_sizes: v.completedSizes as SizeBreakdown | null } : {}),
        ...(v.varianceReason !== undefined ? { variance_reason: v.varianceReason?.trim() || null } : {}),
      };
      const { error } = await supabase.from("production_activities").update(patch).eq("id", v.activity.id);
      if (error) throw error;
    },
    onSuccess: (_data, v) => invalidateActivity(qc, v.activity.productionOrderId),
  });
}

// Cancels a pending, running, or paused activity. For a still-pending job
// this simply removes it from the workstation's queue.
export function useCancelActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (activity: ProductionActivity) => {
      const { error } = await supabase
        .from("production_activities")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", activity.id);
      if (error) throw error;
    },
    onSuccess: (_data, activity) => invalidateActivity(qc, activity.productionOrderId),
  });
}

// Highest operation (in the order's own configured workflow — see
// production_processes / nextConfiguredOperation below) that has any
// completed activity → the "current" stage. Falls back to the most
// recently completed activity if it's on an operation outside the
// configured workflow (e.g. one logged via "Add Additional Operation").
export function currentProductionStage(
  activities: ProductionActivity[] | undefined,
  configuredOperationIds: ActivityOperationId[] = [],
): {
  operationId: ActivityOperationId | null;
  label: string;
} {
  if (!activities?.length) return { operationId: null, label: "Not started" };
  const active = activities.find((a) => a.status === "running" || a.status === "paused");
  if (active) return { operationId: active.operationId, label: ACTIVITY_OP_NAME[active.operationId] };
  const pending = activities.find((a) => a.status === "pending");
  if (pending) return { operationId: pending.operationId, label: `${ACTIVITY_OP_NAME[pending.operationId]} (Pending)` };
  const completed = activities.filter((a) => a.status === "completed");
  if (!completed.length) return { operationId: null, label: "Not started" };
  const completedIds = new Set(completed.map((a) => a.operationId));
  let last: ActivityOperationId | null = null;
  for (const op of configuredOperationIds) {
    if (completedIds.has(op)) last = op;
  }
  if (!last) last = completed[completed.length - 1].operationId;
  return { operationId: last, label: ACTIVITY_OP_NAME[last] };
}

/* ---------------- Configured-workflow helpers ---------------- */
// The operation order is never assumed here — callers always pass the
// production order's own configured workflow (production_processes,
// seeded from the ordered list built in Start Production → Step 2; see
// start_production_v2 and src/lib/api/production.ts). There is no
// default/fallback sequence.

// Next operation the operator should be prompted for, walking the given
// configured operation order. null = workflow done, or an operation is
// already assigned/running/paused (must be completed or cancelled first —
// only one configured operation is ever in flight at a time, whether or
// not the operator has actually started its clock yet).
export function nextConfiguredOperation(
  configuredOperationIds: ActivityOperationId[],
  activities: ProductionActivity[] | undefined,
): ActivityOperationId | null {
  if (activities?.some((a) => a.status === "pending" || a.status === "running" || a.status === "paused")) return null;
  const doneOps = new Set((activities ?? []).filter((a) => a.status === "completed").map((a) => a.operationId));
  for (const op of configuredOperationIds) {
    if (doneOps.has(op)) continue;
    return op;
  }
  return null;
}

// Master input available to a downstream operation = latest Cutting bundle
// minus every size already issued to earlier activities of the same op.
export function availableInputForOperation(
  operationId: ActivityOperationId,
  activities: ProductionActivity[] | undefined,
): { bundle: SizeBreakdown; total: number } | null {
  const cutting = findCuttingBundle(activities);
  if (!cutting) return null;
  const already: SizeBreakdown = {};
  for (const a of activities ?? []) {
    if (a.operationId !== operationId) continue;
    if (a.status === "cancelled") continue;
    const src = a.issuedSizes ?? null;
    if (!src) continue;
    for (const [k, v] of Object.entries(src) as [SizeCode, number][]) {
      already[k] = (already[k] ?? 0) + (v ?? 0);
    }
  }
  const remaining: SizeBreakdown = {};
  let total = 0;
  for (const [k, v] of Object.entries(cutting.bundle) as [SizeCode, number][]) {
    const rem = Math.max(0, (v ?? 0) - (already[k] ?? 0));
    if (rem > 0) {
      remaining[k] = rem;
      total += rem;
    }
  }
  return { bundle: remaining, total };
}
