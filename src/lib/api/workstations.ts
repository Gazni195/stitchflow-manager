import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  mapActivityRow,
  ACTIVITY_COLUMNS,
  type ActivityOperationId,
  type DbActivityRow,
  type ProductionActivity,
} from "@/lib/api/production-activities";

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

// idle    = no job at all right now
// pending = one or more jobs queued, none started yet
// running / paused = the featured job's own state (only one can ever be
//                     running/paused per workstation, enforced by the
//                     Workstation Queue UI, not the database)
export type WorkstationStatus = "idle" | "pending" | "running" | "paused";

export type WorkstationJobRef = ProductionActivity & {
  productionOrderCode: string | null;
  designCode: string | null;
  designName: string | null;
};

export type WorkstationCard = {
  workstationId: string;
  typeKey: string;
  typeLabel: string;
  status: WorkstationStatus;
  /** The running/paused job, if any — this is "today's featured job" for the card. */
  current: WorkstationJobRef | null;
  pendingCount: number;
  completedTodayCount: number;
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

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

function withOrderRefs(a: ProductionActivity, ordersById: Map<string, DbOrderRow>): WorkstationJobRef {
  const order = ordersById.get(a.productionOrderId);
  return {
    ...a,
    productionOrderCode: order?.code ?? null,
    designCode: order?.designs?.code ?? null,
    designName: order?.designs?.name ?? null,
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
        .select(ACTIVITY_COLUMNS)
        .in("workstation_id", ids)
        .order("assigned_at", { ascending: false });
      if (actErr) throw actErr;
      const activities = ((actData as unknown as DbActivityRow[]) ?? []).map(mapActivityRow);

      const byStation = new Map<string, ProductionActivity[]>();
      for (const a of activities) {
        if (!a.workstationId) continue;
        byStation.set(a.workstationId, [...(byStation.get(a.workstationId) ?? []), a]);
      }

      const ordersById = await resolveOrders(Array.from(new Set(activities.map((a) => a.productionOrderId))));

      return stations.map((s) => {
        const jobs = byStation.get(s.workstationId) ?? [];
        const active = jobs.find((a) => a.status === "running" || a.status === "paused") ?? null;
        const pendingCount = jobs.filter((a) => a.status === "pending").length;
        const completedTodayCount = jobs.filter((a) => a.status === "completed" && isToday(a.completedAt)).length;
        const status: WorkstationStatus = active
          ? (active.status as "running" | "paused")
          : pendingCount > 0
            ? "pending"
            : "idle";

        return {
          workstationId: s.workstationId,
          typeKey: s.typeKey,
          typeLabel: s.typeLabel,
          status,
          current: active ? withOrderRefs(active, ordersById) : null,
          pendingCount,
          completedTodayCount,
        };
      });
    },
  });
}

// All stations of a given operation type, with their current queue depth —
// used by the "Assign" dialog's workstation picker. Unlike the old
// idle-only picker, any workstation can take a new assignment: it just
// queues behind whatever's already pending/running there.
export function useWorkstationOptions(
  typeKey: string | null,
): { data: { workstationId: string; running: boolean; pendingCount: number }[]; isLoading: boolean } {
  const cards = useWorkstationCards();
  const data = typeKey
    ? (cards.data ?? [])
        .filter((c) => c.typeKey === typeKey)
        .map((c) => ({
          workstationId: c.workstationId,
          running: c.status === "running" || c.status === "paused",
          pendingCount: c.pendingCount,
        }))
    : [];
  return { data, isLoading: cards.isLoading };
}

export function useWorkstationHistory(workstationId: string | undefined) {
  return useQuery({
    queryKey: ["workstation-history", workstationId],
    enabled: !!workstationId,
    queryFn: async (): Promise<WorkstationJobRef[]> => {
      const { data: actData, error: actErr } = await supabase
        .from("production_activities")
        .select(ACTIVITY_COLUMNS)
        .eq("workstation_id", workstationId!)
        .order("assigned_at", { ascending: false });
      if (actErr) throw actErr;
      const activities = ((actData as unknown as DbActivityRow[]) ?? []).map(mapActivityRow);

      const ordersById = await resolveOrders(Array.from(new Set(activities.map((a) => a.productionOrderId))));

      return activities.map((a) => withOrderRefs(a, ordersById));
    },
  });
}
