import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ActivityOperationId } from "@/lib/api/production-activities";

export type WorkstationType = {
  id: string;
  typeKey: string;
  label: string;
  prefix: string;
  count: number;
  sortOrder: number;
};

export function generateWorkstationIds(prefix: string, count: number): string[] {
  const p = (prefix || "").trim();
  const n = Math.max(0, Math.min(200, Math.floor(count || 0)));
  return Array.from({ length: n }, (_, i) => `${p}${i + 1}`);
}

export function useWorkstationTypes() {
  return useQuery({
    queryKey: ["workstation_config"],
    queryFn: async (): Promise<WorkstationType[]> => {
      const { data, error } = await supabase
        .from("workstation_config")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id as string,
        typeKey: r.type_key as string,
        label: r.label as string,
        prefix: r.prefix as string,
        count: r.count as number,
        sortOrder: r.sort_order as number,
      }));
    },
  });
}

export function useUpdateWorkstationType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; prefix: string; count: number }) => {
      const { error } = await supabase
        .from("workstation_config")
        .update({ prefix: v.prefix, count: v.count })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workstation_config"] }),
  });
}

/* ---------------- Live workstation cards (real production data) ---------------- */
//
// A workstation has no row of its own — "T3" is a generated string, not a
// foreign key. A card's live state is the latest production_activities row
// whose workstation_id matches that string, joined to the Production Order
// and Design it belongs to. No mock data: a workstation with no matching
// activity is simply Idle.

// Each workstation type performs exactly one production operation.
export const WORKSTATION_TYPE_OPERATION: Record<string, ActivityOperationId> = {
  cutting: "cutting",
  tailoring: "stitching",
  handwork: "handwork",
  embroidery: "embroidery",
};

export function workstationTypeKeyForOperation(operationId: ActivityOperationId): string | null {
  const entry = Object.entries(WORKSTATION_TYPE_OPERATION).find(([, op]) => op === operationId);
  return entry ? entry[0] : null;
}

export type WorkstationStatus = "idle" | "running" | "completed";

export type WorkstationCard = {
  workstationId: string;
  typeKey: string;
  typeLabel: string;
  status: WorkstationStatus;
  employee: string | null;
  productionOrderId: string | null;
  productionOrderCode: string | null;
  designCode: string | null;
  designName: string | null;
  operationId: ActivityOperationId | null;
  assignedQty: number;
  completedQty: number;
  pendingQty: number;
};

type DbActivityRow = {
  id: string;
  production_order_id: string;
  workstation_id: string | null;
  operation_id: ActivityOperationId;
  assigned_to: string;
  issued_qty: number;
  returned_qty: number | null;
  status: "running" | "completed" | "cancelled";
  started_at: string;
  completed_at: string | null;
};
type DbOrderRow = { id: string; code: string; designs?: { code: string; name: string } | null };

async function resolveOrders(orderIds: string[]): Promise<Map<string, DbOrderRow>> {
  if (!orderIds.length) return new Map();
  const { data, error } = await supabase
    .from("production_orders")
    .select("id, code, designs(code, name)")
    .in("id", orderIds);
  if (error) throw error;
  return new Map((data as unknown as DbOrderRow[]).map((o) => [o.id, o]));
}

function idleCard(workstationId: string, typeKey: string, typeLabel: string): WorkstationCard {
  return {
    workstationId,
    typeKey,
    typeLabel,
    status: "idle",
    employee: null,
    productionOrderId: null,
    productionOrderCode: null,
    designCode: null,
    designName: null,
    operationId: null,
    assignedQty: 0,
    completedQty: 0,
    pendingQty: 0,
  };
}

export function useWorkstationCards() {
  return useQuery({
    queryKey: ["workstation-cards"],
    queryFn: async (): Promise<WorkstationCard[]> => {
      const { data: typeRows, error: typeErr } = await supabase
        .from("workstation_config")
        .select("*")
        .order("sort_order", { ascending: true });
      if (typeErr) throw typeErr;

      const types = (typeRows ?? []).map((r) => ({
        typeKey: r.type_key as string,
        label: r.label as string,
        prefix: r.prefix as string,
        count: r.count as number,
      }));

      const stations = types.flatMap((t) =>
        generateWorkstationIds(t.prefix, t.count).map((workstationId) => ({
          workstationId,
          typeKey: t.typeKey,
          typeLabel: t.label,
        })),
      );
      if (!stations.length) return [];

      const ids = stations.map((s) => s.workstationId);
      const { data: actData, error: actErr } = await supabase
        .from("production_activities")
        .select("*")
        .in("workstation_id", ids)
        .order("started_at", { ascending: false });
      if (actErr) throw actErr;
      const activities = (actData as DbActivityRow[]) ?? [];

      // Activities are already newest-first, so the first one seen per
      // workstation is its current job.
      const latestByStation = new Map<string, DbActivityRow>();
      for (const a of activities) {
        if (a.workstation_id && !latestByStation.has(a.workstation_id)) {
          latestByStation.set(a.workstation_id, a);
        }
      }

      const ordersById = await resolveOrders(
        Array.from(new Set(Array.from(latestByStation.values()).map((a) => a.production_order_id))),
      );

      return stations.map((s) => {
        const a = latestByStation.get(s.workstationId);
        if (!a) return idleCard(s.workstationId, s.typeKey, s.typeLabel);

        const order = ordersById.get(a.production_order_id);
        const status: WorkstationStatus =
          a.status === "running" ? "running" : a.status === "completed" ? "completed" : "idle";
        const assignedQty = a.issued_qty;
        const completedQty = status === "completed" ? (a.returned_qty ?? a.issued_qty) : 0;
        const pendingQty = Math.max(0, assignedQty - completedQty);

        return {
          workstationId: s.workstationId,
          typeKey: s.typeKey,
          typeLabel: s.typeLabel,
          status,
          employee: a.assigned_to,
          productionOrderId: a.production_order_id,
          productionOrderCode: order?.code ?? null,
          designCode: order?.designs?.code ?? null,
          designName: order?.designs?.name ?? null,
          operationId: a.operation_id,
          assignedQty,
          completedQty,
          pendingQty,
        };
      });
    },
  });
}

// Idle stations of a given operation type — the only ones an operator can
// pick when starting new work, so a station can never be double-booked.
// Derives from the same useWorkstationCards() data rather than a second
// query, so there is exactly one source of truth for "what's idle."
export function useIdleWorkstationIds(typeKey: string | null): { data: string[]; isLoading: boolean } {
  const cards = useWorkstationCards();
  const data = typeKey
    ? (cards.data ?? []).filter((c) => c.typeKey === typeKey && c.status === "idle").map((c) => c.workstationId)
    : [];
  return { data, isLoading: cards.isLoading };
}

export function useWorkstationHistory(workstationId: string | undefined) {
  return useQuery({
    queryKey: ["workstation-history", workstationId],
    enabled: !!workstationId,
    queryFn: async (): Promise<
      (DbActivityRow & { productionOrderCode: string | null; designCode: string | null; designName: string | null })[]
    > => {
      const { data: actData, error: actErr } = await supabase
        .from("production_activities")
        .select("*")
        .eq("workstation_id", workstationId!)
        .order("started_at", { ascending: false });
      if (actErr) throw actErr;
      const activities = (actData as DbActivityRow[]) ?? [];

      const ordersById = await resolveOrders(Array.from(new Set(activities.map((a) => a.production_order_id))));

      return activities.map((a) => {
        const order = ordersById.get(a.production_order_id);
        return {
          ...a,
          productionOrderCode: order?.code ?? null,
          designCode: order?.designs?.code ?? null,
          designName: order?.designs?.name ?? null,
        };
      });
    },
  });
}
