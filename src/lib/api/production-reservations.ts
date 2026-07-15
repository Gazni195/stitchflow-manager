// Reservations of inventory materials against a specific production order.
// The Bulk Production requirement is derived from the approved sample BOM
// (per-piece × order quantity, merged by material). Reservations record
// which physical rolls/lots/barcodes are earmarked for the run.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProductionReservation = {
  id: string;
  productionOrderId: string;
  materialId: string;
  quantity: number;
  lotCode: string | null;
  notes: string | null;
  createdAt: string;
};

type Db = {
  id: string;
  production_order_id: string;
  material_id: string;
  quantity: number;
  lot_code: string | null;
  notes: string | null;
  created_at: string;
};

function map(r: Db): ProductionReservation {
  return {
    id: r.id,
    productionOrderId: r.production_order_id,
    materialId: r.material_id,
    quantity: Number(r.quantity ?? 0),
    lotCode: r.lot_code,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

export function useProductionReservations(productionOrderId: string | undefined) {
  return useQuery({
    queryKey: ["production-reservations", productionOrderId],
    enabled: !!productionOrderId,
    queryFn: async (): Promise<ProductionReservation[]> => {
      const { data, error } = await supabase
        .from("production_reservations")
        .select("id, production_order_id, material_id, quantity, lot_code, notes, created_at")
        .eq("production_order_id", productionOrderId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as Db[]).map(map);
    },
  });
}

export function useAddReservation(productionOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { materialId: string; quantity: number; lotCode: string; notes: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("production_reservations").insert({
        production_order_id: productionOrderId,
        material_id: v.materialId,
        quantity: v.quantity,
        lot_code: v.lotCode || null,
        notes: v.notes || null,
        created_by: auth.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-reservations", productionOrderId] });
    },
  });
}

export function useRemoveReservation(productionOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("production_reservations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-reservations", productionOrderId] });
    },
  });
}
