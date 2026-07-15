// Production Orders + bundle-based Processes.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProcessOperationId = "cutting" | "handwork" | "embroidery" | "stitching" | "qc";
export const PROCESS_OPERATIONS: { id: ProcessOperationId; name: string }[] = [
  { id: "cutting", name: "Cutting" },
  { id: "handwork", name: "Hand Work" },
  { id: "embroidery", name: "Machine Embroidery" },
  { id: "stitching", name: "Stitching" },
  { id: "qc", name: "QC" },
];
export const OP_NAME: Record<ProcessOperationId, string> = Object.fromEntries(
  PROCESS_OPERATIONS.map((o) => [o.id, o.name]),
) as Record<ProcessOperationId, string>;

export type ProcessStatus = "locked" | "pending" | "issued" | "completed";
export type WorkerType = "hand_worker" | "machine_operator" | "vendor";

export type ProductionProcess = {
  id: string;
  productionOrderId: string;
  operationId: ProcessOperationId;
  sequence: number;
  status: ProcessStatus;
  workerType: WorkerType | null;
  assignedTo: string | null;
  issuedQty: number | null;
  returnedQty: number | null;
  notes: string | null;
  issuedAt: string | null;
  completedAt: string | null;
};

export type ProductionOrder = {
  id: string;
  code: string;
  designId: string;
  orderQuantity: number;
  startDate: string;
  supervisor: string | null;
  assignedLine: string | null;
  status: "running" | "completed";
  completedAt: string | null;
  createdAt: string;
  // joined
  designCode?: string;
  designName?: string;
  customer?: string;
  imagePath?: string | null;
  processes?: ProductionProcess[];
};

type DbPO = {
  id: string;
  code: string;
  design_id: string;
  order_quantity: number;
  start_date: string;
  supervisor: string | null;
  assigned_line: string | null;
  status: "running" | "completed";
  completed_at: string | null;
  created_at: string;
  designs?: {
    code: string;
    name: string;
    customer: string;
    image_path: string | null;
  } | null;
};

type DbProc = {
  id: string;
  production_order_id: string;
  operation_id: ProcessOperationId;
  sequence: number;
  status: ProcessStatus;
  worker_type: WorkerType | null;
  assigned_to: string | null;
  issued_qty: number | null;
  returned_qty: number | null;
  notes: string | null;
  issued_at: string | null;
  completed_at: string | null;
};

function mapPO(r: DbPO): ProductionOrder {
  return {
    id: r.id,
    code: r.code,
    designId: r.design_id,
    orderQuantity: r.order_quantity,
    startDate: r.start_date,
    supervisor: r.supervisor,
    status: r.status,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    designCode: r.designs?.code,
    designName: r.designs?.name,
    customer: r.designs?.customer,
    imagePath: r.designs?.image_path ?? null,
  };
}
function mapProc(r: DbProc): ProductionProcess {
  return {
    id: r.id,
    productionOrderId: r.production_order_id,
    operationId: r.operation_id,
    sequence: r.sequence,
    status: r.status,
    workerType: r.worker_type,
    assignedTo: r.assigned_to,
    issuedQty: r.issued_qty,
    returnedQty: r.returned_qty,
    notes: r.notes,
    issuedAt: r.issued_at,
    completedAt: r.completed_at,
  };
}

// ---------- Pending: approved samples with no PO yet ----------
export type PendingDesign = {
  id: string;
  code: string;
  name: string;
  customer: string;
  orderQuantity: number;
  imagePath: string | null;
  approvedAt: string;
};

export function usePendingProduction() {
  return useQuery({
    queryKey: ["production", "pending"],
    queryFn: async (): Promise<PendingDesign[]> => {
      // Approved designs
      const { data: designs, error } = await supabase
        .from("designs")
        .select("id, code, name, customer, order_quantity, image_path, updated_at, status")
        .eq("status", "sample_approved")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const ids = (designs ?? []).map((d) => d.id as string);
      if (!ids.length) return [];
      // Exclude ones that already have a production order
      const { data: existing } = await supabase
        .from("production_orders")
        .select("design_id")
        .in("design_id", ids);
      const taken = new Set((existing ?? []).map((p) => p.design_id as string));
      return (designs ?? [])
        .filter((d) => !taken.has(d.id as string))
        .map((d) => ({
          id: d.id as string,
          code: d.code as string,
          name: d.name as string,
          customer: d.customer as string,
          orderQuantity: d.order_quantity as number,
          imagePath: (d.image_path as string | null) ?? null,
          approvedAt: (d.updated_at as string) ?? "",
        }));
    },
  });
}

export function useProductionOrders(status: "running" | "completed") {
  return useQuery({
    queryKey: ["production", "orders", status],
    queryFn: async (): Promise<ProductionOrder[]> => {
      const { data, error } = await supabase
        .from("production_orders")
        .select("*, designs(code, name, customer, image_path)")
        .eq("status", status)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const orders = (data as unknown as DbPO[]).map(mapPO);
      const ids = orders.map((o) => o.id);
      if (!ids.length) return orders;
      const { data: procs } = await supabase
        .from("production_processes")
        .select("*")
        .in("production_order_id", ids)
        .order("sequence", { ascending: true });
      const list = (procs as unknown as DbProc[] ?? []).map(mapProc);
      return orders.map((o) => ({ ...o, processes: list.filter((p) => p.productionOrderId === o.id) }));
    },
  });
}

export function useProductionOrder(code: string | undefined) {
  return useQuery({
    queryKey: ["production", "order", code],
    enabled: !!code,
    queryFn: async (): Promise<ProductionOrder | null> => {
      const { data, error } = await supabase
        .from("production_orders")
        .select("*, designs(code, name, customer, image_path)")
        .eq("code", code!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const po = mapPO(data as unknown as DbPO);
      const { data: procs } = await supabase
        .from("production_processes")
        .select("*")
        .eq("production_order_id", po.id)
        .order("sequence", { ascending: true });
      po.processes = (procs as unknown as DbProc[] ?? []).map(mapProc);
      return po;
    },
  });
}

// ---------- Mutations ----------
export function useStartProduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      designId: string;
      orderQuantity: number;
      startDate: string;
      supervisor: string;
    }) => {
      const { data, error } = await supabase.rpc("start_production", {
        _design_id: v.designId,
        _order_quantity: v.orderQuantity,
        _start_date: v.startDate,
        _supervisor: v.supervisor,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production"] });
      qc.invalidateQueries({ queryKey: ["designs"] });
    },
  });
}

export function useIssueBundle(poCode: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      processId: string;
      workerType: WorkerType;
      assignedTo: string;
      issuedQty: number;
      notes: string;
    }) => {
      const { error } = await supabase.rpc("issue_bundle", {
        _process_id: v.processId,
        _worker_type: v.workerType,
        _assigned_to: v.assignedTo,
        _issued_qty: v.issuedQty,
        _notes: v.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production", "order", poCode] });
      qc.invalidateQueries({ queryKey: ["production", "orders", "running"] });
    },
  });
}

export function useCompleteProcess(poCode: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { processId: string; returnedQty: number }) => {
      const { error } = await supabase.rpc("complete_process", {
        _process_id: v.processId,
        _returned_qty: v.returnedQty,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production"] });
    },
  });
}

export function computeProgress(processes: ProductionProcess[] | undefined): number {
  if (!processes?.length) return 0;
  const done = processes.filter((p) => p.status === "completed").length;
  return Math.round((done / processes.length) * 100);
}

export function currentStage(processes: ProductionProcess[] | undefined): string {
  if (!processes?.length) return "—";
  const active = processes.find((p) => p.status === "pending" || p.status === "issued");
  if (active) return OP_NAME[active.operationId];
  return "Completed";
}
