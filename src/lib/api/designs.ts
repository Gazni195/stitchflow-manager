// Supabase-backed CRUD for designs, with react-query hooks.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Design, DesignStatus } from "@/lib/designs";

type DbDesign = {
  id: string;
  code: string;
  name: string;
  customer: string;
  category: string;
  fabric: string;
  color: string;
  order_quantity: number;
  image_path: string | null;
  status: DesignStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function mapDesign(r: DbDesign): Design {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    customer: r.customer,
    category: r.category,
    fabric: r.fabric,
    color: r.color,
    orderQuantity: r.order_quantity,
    imagePath: r.image_path,
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function useDesigns() {
  return useQuery({
    queryKey: ["designs"],
    queryFn: async (): Promise<Design[]> => {
      const { data, error } = await supabase
        .from("designs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as DbDesign[]).map(mapDesign);
    },
  });
}

export function useDesignByCode(code: string) {
  return useQuery({
    queryKey: ["design", "by-code", code],
    queryFn: async (): Promise<Design | null> => {
      const { data, error } = await supabase
        .from("designs")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (error) throw error;
      return data ? mapDesign(data as DbDesign) : null;
    },
    enabled: !!code,
  });
}

export type CreateDesignInput = {
  code: string;
  name: string;
  customer: string;
  category: string;
  fabric: string;
  color: string;
  orderQuantity: number;
  imageFile?: File | null;
};

export function useCreateDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDesignInput): Promise<Design> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");

      let image_path: string | null = null;
      if (input.imageFile) {
        const ext = input.imageFile.name.split(".").pop() ?? "jpg";
        const path = `${uid}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("design-images")
          .upload(path, input.imageFile, { upsert: false });
        if (upErr) throw upErr;
        image_path = path;
      }

      const { data, error } = await supabase
        .from("designs")
        .insert({
          code: input.code,
          name: input.name,
          customer: input.customer,
          category: input.category,
          fabric: input.fabric,
          color: input.color,
          order_quantity: input.orderQuantity,
          image_path,
          status: "draft" as DesignStatus,
          created_by: uid,
        })
        .select("*")
        .single();
      if (error) throw error;

      // Auto-provision a default sample workflow (empty — user configures it).
      const design = mapDesign(data as DbDesign);
      const { error: wfErr } = await supabase
        .from("design_workflows")
        .insert({ design_id: design.id, kind: "sample", locked: false });
      if (wfErr) throw wfErr;

      return design;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["designs"] }),
  });
}

export function useDesignImageUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["design-image", path],
    enabled: !!path,
    staleTime: 55 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from("design-images")
        .createSignedUrl(path, 60 * 60);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
  });
}
