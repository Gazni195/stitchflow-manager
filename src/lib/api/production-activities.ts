// Bulk Production Activities — multi-activity log per Production Order.
// Each activity captures Start Time, End Time, Elapsed Time, Effective
// Working Time (via the Factory Working Clock), assigned worker/team/line,
// issued qty and returned qty. Kept separate from the older
// `production_processes` model so the new operator-focused workflow can
// evolve independently.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_FACTORY_CALENDAR,
  effectiveWorkingSeconds,
  elapsedSeconds,
} from "@/lib/factory-clock";

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
  };
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
      notes?: string;
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("production_activities").insert({
        production_order_id: productionOrderId,
        operation_id: v.operationId,
        assigned_to: v.assignedTo,
        issued_qty: v.issuedQty,
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
    mutationFn: async (v: { activity: ProductionActivity; returnedQty: number }) => {
      const end = new Date();
      const start = new Date(v.activity.startedAt);
      const elapsed = elapsedSeconds(start, end);
      const effective = effectiveWorkingSeconds(start, end, DEFAULT_FACTORY_CALENDAR);
      const { error } = await supabase
        .from("production_activities")
        .update({
          status: "completed",
          completed_at: end.toISOString(),
          returned_qty: v.returnedQty,
          elapsed_seconds: elapsed,
          effective_seconds: effective,
        })
        .eq("id", v.activity.id);
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
