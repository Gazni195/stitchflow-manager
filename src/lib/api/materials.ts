// Materials + Design Materials API (Supabase-backed, react-query hooks).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Material = {
  id: string;
  name: string;
  rate: number;
  unit: string;
};

export type DesignMaterial = {
  id: string;
  designId: string;
  materialId: string;
  groupName: string;
  quantity: number;
  rate: number;
  amount: number;
};

type DbMaterial = {
  id: string;
  name: string;
  rate: number | string;
  unit: string;
};

type DbDesignMaterial = {
  id: string;
  design_id: string;
  material_id: string;
  group_name: string;
  quantity: number | string;
  rate: number | string;
};

function mapMaterial(r: DbMaterial): Material {
  return { id: r.id, name: r.name, unit: r.unit, rate: Number(r.rate) };
}

function mapDesignMaterial(r: DbDesignMaterial): DesignMaterial {
  const quantity = Number(r.quantity);
  const rate = Number(r.rate);
  return {
    id: r.id,
    designId: r.design_id,
    materialId: r.material_id,
    groupName: r.group_name,
    quantity,
    rate,
    amount: quantity * rate,
  };
}

export function useMaterials() {
  return useQuery({
    queryKey: ["materials"],
    queryFn: async (): Promise<Material[]> => {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data as DbMaterial[]).map(mapMaterial);
    },
  });
}

export function useAddMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { name: string; rate: number; unit: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const created_by = userRes.user?.id;
      if (!created_by) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("materials")
        .insert({ name: v.name, rate: v.rate, unit: v.unit, created_by })
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials"] }),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials"] }),
  });
}

export function useDesignMaterials(designId: string | undefined) {
  return useQuery({
    queryKey: ["design-materials", designId],
    enabled: !!designId,
    queryFn: async (): Promise<DesignMaterial[]> => {
      const { data, error } = await supabase
        .from("design_materials")
        .select("*")
        .eq("design_id", designId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as DbDesignMaterial[]).map(mapDesignMaterial);
    },
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, designId: string) {
  qc.invalidateQueries({ queryKey: ["design-materials", designId] });
}

export function useAddDesignMaterial(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      materialId: string;
      groupName: string;
      quantity: number;
      rate: number;
    }): Promise<string> => {
      const { data, error } = await supabase
        .from("design_materials")
        .insert({
          design_id: designId,
          material_id: v.materialId,
          group_name: v.groupName,
          quantity: v.quantity,
          rate: v.rate,
        })
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => invalidate(qc, designId),
  });
}

export function useUpdateDesignMaterial(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      id: string;
      patch: Partial<{ materialId: string; groupName: string; quantity: number; rate: number }>;
    }) => {
      const p = v.patch;
      const dbPatch: Record<string, unknown> = {};
      if (p.materialId !== undefined) dbPatch.material_id = p.materialId;
      if (p.groupName !== undefined) dbPatch.group_name = p.groupName;
      if (p.quantity !== undefined) dbPatch.quantity = p.quantity;
      if (p.rate !== undefined) dbPatch.rate = p.rate;
      const { error } = await (
        supabase.from("design_materials") as unknown as {
          update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
        }
      )
        .update(dbPatch)
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc, designId),
  });
}

export function useDeleteDesignMaterial(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("design_materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc, designId),
  });
}
