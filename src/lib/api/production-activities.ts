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

export type ActivityStatus = "running" | "completed" | "cancelled";

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
  operationId: ActivityOperationId;
  assignedTo: string;
  issuedQty: number;
  returnedQty: number | null;
  notes: string | null;
  status: ActivityStatus;
  startedAt: string;
  completedAt: string | null;
  elapsedSeconds: number | null;
  effectiveSeconds: number | null;
  sizeBreakdown: SizeBreakdown | null;
  issuedSizes: SizeBreakdown | null;
  completedSizes: SizeBreakdown | null;
  varianceReason: string | null;
};

type DbRow = {
  id: string;
  production_order_id: string;
  operation_id: string;
  assigned_to: string;
  issued_qty: number;
  returned_qty: number | null;
  notes: string | null;
  status: ActivityStatus;
  started_at: string;
  completed_at: string | null;
  elapsed_seconds: number | null;
  effective_seconds: number | null;
  size_breakdown: SizeBreakdown | null;
  issued_sizes: SizeBreakdown | null;
  completed_sizes: SizeBreakdown | null;
  variance_reason: string | null;
};

function mapRow(r: DbRow): ProductionActivity {
  return {
    id: r.id,
    productionOrderId: r.production_order_id,
    operationId: r.operation_id as ActivityOperationId,
    assignedTo: r.assigned_to,
    issuedQty: r.issued_qty,
    returnedQty: r.returned_qty,
    notes: r.notes,
    status: r.status,
    startedAt: r.started_at,
    completedAt: r.completed_at,
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
        .select("*")
        .eq("production_order_id", productionOrderId!)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as DbRow[]).map(mapRow);
    },
  });
}

export function useStartActivity(productionOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      operationId: ActivityOperationId;
      assignedTo: string;
      issuedQty: number;
      issuedSizes?: SizeBreakdown | null;
      notes?: string;
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("production_activities").insert({
        production_order_id: productionOrderId,
        operation_id: v.operationId,
        assigned_to: v.assignedTo,
        issued_qty: v.issuedQty,
        issued_sizes: v.issuedSizes ?? null,
        notes: v.notes?.trim() || null,
        status: "running",
        started_at: new Date().toISOString(),
        created_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["production-activities", productionOrderId] }),
  });
}

export function useCompleteActivity(productionOrderId: string) {
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
      const start = new Date(v.activity.startedAt);
      const elapsed = elapsedSeconds(start, end);
      const effective = effectiveWorkingSeconds(start, end, DEFAULT_FACTORY_CALENDAR);
      const patch = {
        status: "completed" as const,
        completed_at: end.toISOString(),
        returned_qty: v.returnedQty,
        elapsed_seconds: elapsed,
        effective_seconds: effective,
        ...(v.sizeBreakdown !== undefined ? { size_breakdown: v.sizeBreakdown as SizeBreakdown | null } : {}),
        ...(v.completedSizes !== undefined ? { completed_sizes: v.completedSizes as SizeBreakdown | null } : {}),
        ...(v.varianceReason !== undefined ? { variance_reason: v.varianceReason?.trim() || null } : {}),
      };
      const { error } = await supabase.from("production_activities").update(patch).eq("id", v.activity.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["production-activities", productionOrderId] }),
  });
}

export function useCancelActivity(productionOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase
        .from("production_activities")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", activityId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["production-activities", productionOrderId] }),
  });
}

// Highest operation that has any completed activity → the "current" stage.
export function currentProductionStage(activities: ProductionActivity[] | undefined): {
  operationId: ActivityOperationId | null;
  label: string;
} {
  if (!activities?.length) return { operationId: null, label: "Not started" };
  const running = activities.find((a) => a.status === "running");
  if (running) return { operationId: running.operationId, label: ACTIVITY_OP_NAME[running.operationId] };
  const completed = activities.filter((a) => a.status === "completed");
  if (!completed.length) return { operationId: null, label: "Not started" };
  const seqOf = (id: ActivityOperationId) => ACTIVITY_OPERATIONS.find((o) => o.id === id)?.sequence ?? 0;
  const top = completed.reduce((best, a) => (seqOf(a.operationId) > seqOf(best.operationId) ? a : best));
  return { operationId: top.operationId, label: ACTIVITY_OP_NAME[top.operationId] };
}

/* ---------------- Sequential workflow helpers ---------------- */

// Canonical factory sequence. Embroidery is optional (skippable in UI).
export const PRODUCTION_SEQUENCE: ActivityOperationId[] = [
  "cutting",
  "handwork",
  "embroidery",
  "stitching",
  "qc",
  "packing",
];
export const OPTIONAL_OPERATIONS: Set<ActivityOperationId> = new Set(["embroidery"]);
export const ADDITIONAL_OPERATIONS: ActivityOperationId[] = ACTIVITY_OPERATIONS
  .map((o) => o.id)
  .filter((id) => !PRODUCTION_SEQUENCE.includes(id));

// Next operation the operator should be prompted for. null = sequence done
// OR an activity is still running (must complete/cancel first).
export function nextSequentialOperation(
  activities: ProductionActivity[] | undefined,
  skipped: Set<ActivityOperationId> = new Set(),
): ActivityOperationId | null {
  if (activities?.some((a) => a.status === "running")) return null;
  const doneOps = new Set(
    (activities ?? []).filter((a) => a.status === "completed").map((a) => a.operationId),
  );
  for (const op of PRODUCTION_SEQUENCE) {
    if (doneOps.has(op)) continue;
    if (skipped.has(op)) continue;
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
