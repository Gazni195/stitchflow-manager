// Supabase-backed CRUD for materials master and per-design materials.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Material = {
  id: string;
  name: string;
  unit: string;
  rate: number;
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

type DbMaterial = { id: string; name: string; unit: string; rate: number | string };
type DbDesignMaterial = {
  id: string;
  design_id: string;
  material_id: string;
  group_name: string;
  quantity: number | string;
  rate: number | string;
};

const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v));

function mapMaterial(r: DbMaterial): Material {
  return { id: r.id, name: r.name, unit: r.unit, rate: num(r.rate) };
}

function mapDesignMaterial(r: DbDesignMaterial): DesignMaterial {
  const quantity = num(r.quantity);
  const rate = num(r.rate);
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
        .select("id,name,unit,rate")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data as DbMaterial[]).map(mapMaterial);
    },
  });
}

export function useAddMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { name: string; unit: string; rate: number }): Promise<string> => {
      const { data, error } = await supabase
        .from("materials")
        .insert({ name: v.name, unit: v.unit, rate: v.rate })
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials"] }),
  });
}

export function useUpdateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; patch: Partial<Omit<Material, "id">> }) => {
      const { error } = await supabase.from("materials").update(v.patch).eq("id", v.id);
      if (error) throw error;
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
    queryKey: ["design_materials", designId],
    enabled: !!designId,
    queryFn: async (): Promise<DesignMaterial[]> => {
      const { data, error } = await supabase
        .from("design_materials")
        .select("id,design_id,material_id,group_name,quantity,rate")
        .eq("design_id", designId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as DbDesignMaterial[]).map(mapDesignMaterial);
    },
  });
}

function invalidateDesignMaterials(qc: ReturnType<typeof useQueryClient>, designId: string) {
  qc.invalidateQueries({ queryKey: ["design_materials", designId] });
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
    onSuccess: () => invalidateDesignMaterials(qc, designId),
  });
}

export function useUpdateDesignMaterial(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      id: string;
      patch: Partial<{ materialId: string; groupName: string; quantity: number; rate: number }>;
    }) => {
      const dbPatch: Record<string, unknown> = {};
      if (v.patch.materialId !== undefined) dbPatch.material_id = v.patch.materialId;
      if (v.patch.groupName !== undefined) dbPatch.group_name = v.patch.groupName;
      if (v.patch.quantity !== undefined) dbPatch.quantity = v.patch.quantity;
      if (v.patch.rate !== undefined) dbPatch.rate = v.patch.rate;
      const { error } = await (supabase.from("design_materials") as unknown as {
        update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
      })
        .update(dbPatch)
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateDesignMaterials(qc, designId),
  });
}

export function useDeleteDesignMaterial(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("design_materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateDesignMaterials(qc, designId),
  });
}
