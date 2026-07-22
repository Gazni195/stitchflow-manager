// Ready Stock data.
// Source of truth = completed production orders. There is no separate
// warehouse/stock-movement schema yet, so "finished quantity" is derived
// from the QC operation's returned_qty (falls back to order_quantity when
// the QC step didn't record a return count).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StockRecord = {
  productionOrderId: string;
  code: string;
  designId: string;
  designCode: string;
  designName: string;
  customer: string;
  imagePath: string | null;
  orderQuantity: number;
  finishedQuantity: number;
  completedAt: string | null;
};

export function useReadyStock() {
  return useQuery({
    queryKey: ["stock", "ready"],
    queryFn: async (): Promise<StockRecord[]> => {
      const { data: orders, error } = await supabase
        .from("production_orders")
        .select(
          "id, code, design_id, order_quantity, completed_at, designs(code, name, customer, image_path)",
        )
        .eq("status", "completed")
        .order("completed_at", { ascending: false });
      if (error) throw error;
      const list = (orders ?? []) as Array<{
        id: string;
        code: string;
        design_id: string;
        order_quantity: number;
        completed_at: string | null;
        designs: {
          code: string;
          name: string;
          customer: string;
          image_path: string | null;
        } | null;
      }>;
      if (!list.length) return [];

      const ids = list.map((o) => o.id);
      const { data: qcRows } = await supabase
        .from("production_processes")
        .select("production_order_id, returned_qty")
        .in("production_order_id", ids)
        .eq("operation_id", "qc");
      const qcMap = new Map<string, number>();
      for (const r of (qcRows ?? []) as Array<{
        production_order_id: string;
        returned_qty: number | null;
      }>) {
        if (r.returned_qty != null) qcMap.set(r.production_order_id, r.returned_qty);
      }

      return list.map((o) => ({
        productionOrderId: o.id,
        code: o.code,
        designId: o.design_id,
        designCode: o.designs?.code ?? "",
        designName: o.designs?.name ?? "",
        customer: o.designs?.customer ?? "",
        imagePath: o.designs?.image_path ?? null,
        orderQuantity: o.order_quantity,
        finishedQuantity: qcMap.get(o.id) ?? o.order_quantity,
        completedAt: o.completed_at,
      }));
    },
  });
}
