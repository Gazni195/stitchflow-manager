import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
