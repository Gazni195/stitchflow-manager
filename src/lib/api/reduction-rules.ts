// Consumption Reduction Rules — configured by admins, applied automatically
// when a Production Order is started. Never hardcoded.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReductionRuleStatus = "active" | "inactive";

export type ReductionRule = {
  id: string;
  name: string;
  fabricType: string;
  widthMin: number;
  widthMax: number;
  layerMin: number;
  layerMax: number;
  reductionPct: number;
  status: ReductionRuleStatus;
  createdAt: string;
  updatedAt: string;
};

type Db = {
  id: string;
  name: string;
  fabric_type: string;
  width_min: number;
  width_max: number;
  layer_min: number;
  layer_max: number;
  reduction_pct: number;
  status: string;
  created_at: string;
  updated_at: string;
};

const COLS =
  "id, name, fabric_type, width_min, width_max, layer_min, layer_max, reduction_pct, status, created_at, updated_at";

function map(r: Db): ReductionRule {
  return {
    id: r.id,
    name: r.name,
    fabricType: r.fabric_type,
    widthMin: Number(r.width_min),
    widthMax: Number(r.width_max),
    layerMin: Number(r.layer_min),
    layerMax: Number(r.layer_max),
    reductionPct: Number(r.reduction_pct),
    status: (r.status as ReductionRuleStatus) ?? "active",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function useReductionRules() {
  return useQuery({
    queryKey: ["reduction-rules"],
    queryFn: async (): Promise<ReductionRule[]> => {
      const { data, error } = await supabase
        .from("consumption_reduction_rules")
        .select(COLS)
        .order("fabric_type", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data as unknown as Db[]).map(map);
    },
  });
}

export type ReductionRuleInput = {
  name: string;
  fabricType: string;
  widthMin: number;
  widthMax: number;
  layerMin: number;
  layerMax: number;
  reductionPct: number;
  status: ReductionRuleStatus;
};

function toDb(input: ReductionRuleInput) {
  return {
    name: input.name.trim(),
    fabric_type: input.fabricType.trim(),
    width_min: input.widthMin,
    width_max: input.widthMax,
    layer_min: input.layerMin,
    layer_max: input.layerMax,
    reduction_pct: input.reductionPct,
    status: input.status,
  };
}

export function useCreateReductionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReductionRuleInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("consumption_reduction_rules")
        .insert({ ...toDb(input), created_by: auth.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reduction-rules"] }),
  });
}

export function useUpdateReductionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReductionRuleInput & { id: string }) => {
      const { error } = await supabase
        .from("consumption_reduction_rules")
        .update(toDb(input))
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reduction-rules"] }),
  });
}

export function useDeleteReductionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("consumption_reduction_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reduction-rules"] }),
  });
}

export function useToggleReductionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; status: ReductionRuleStatus }) => {
      const { error } = await supabase
        .from("consumption_reduction_rules")
        .update({ status: v.status })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reduction-rules"] }),
  });
}
