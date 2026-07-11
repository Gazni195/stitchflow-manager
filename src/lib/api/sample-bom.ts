// Supabase-backed BOM (bill of materials) for a design's sample — garment
// parts get a consumption/rate row, plus free-form accessory rows.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BomItemKind = "part" | "accessory";

export type BomItem = {
  id: string;
  designId: string;
  kind: BomItemKind;
  partId: string | null;
  name: string;
  color: string;
  consumption: number;
  unit: string;
  rate: number;
  sequence: number;
};

type DbBomItem = {
  id: string;
  design_id: string;
  kind: BomItemKind;
  part_id: string | null;
  name: string;
  color: string;
  consumption: number;
  unit: string;
  rate: number;
  sequence: number;
};

function mapBomItem(r: DbBomItem): BomItem {
  return {
    id: r.id,
    designId: r.design_id,
    kind: r.kind,
    partId: r.part_id,
    name: r.name,
    color: r.color,
    consumption: r.consumption,
    unit: r.unit,
    rate: r.rate,
    sequence: r.sequence,
  };
}

export function useBomItems(designId: string | undefined) {
  return useQuery({
    queryKey: ["sample-bom", designId],
    enabled: !!designId,
    queryFn: async (): Promise<BomItem[]> => {
      const { data, error } = await supabase
        .from("sample_bom_items")
        .select("*")
        .eq("design_id", designId!)
        .order("sequence", { ascending: true });
      if (error) throw error;
      return (data as DbBomItem[]).map(mapBomItem);
    },
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, designId: string) {
  qc.invalidateQueries({ queryKey: ["sample-bom", designId] });
}

/** Insert (no `id`) or update (with `id`) a single BOM row. */
export function useUpsertBomItem(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Omit<BomItem, "designId" | "id"> & { id?: string }) => {
      if (item.id) {
        const { error } = await supabase
          .from("sample_bom_items")
          .update({
            name: item.name,
            color: item.color,
            consumption: item.consumption,
            unit: item.unit,
            rate: item.rate,
            sequence: item.sequence,
          })
          .eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sample_bom_items").insert({
          design_id: designId,
          kind: item.kind,
          part_id: item.partId,
          name: item.name,
          color: item.color,
          consumption: item.consumption,
          unit: item.unit,
          rate: item.rate,
          sequence: item.sequence,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidate(qc, designId),
  });
}

export function useDeleteBomItem(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sample_bom_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc, designId),
  });
}
