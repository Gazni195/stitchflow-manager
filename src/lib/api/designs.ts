// Supabase-backed CRUD for designs, with react-query hooks.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Design, DesignPart, DesignStatus } from "@/lib/designs";

type DbDesign = {
  id: string;
  code: string;
  name: string;
  customer: string;
  category: string;
  product_type: string;
  parts: unknown;
  color: string;
  order_quantity: number;
  image_path: string | null;
  notes: string | null;
  status: DesignStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function normalizeParts(v: unknown): DesignPart[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((p, i) => {
      if (p && typeof p === "object" && "name" in (p as object)) {
        const obj = p as {
          id?: unknown;
          name?: unknown;
          fabric?: unknown;
          color?: unknown;
          quantity?: unknown;
        };
        return {
          id: typeof obj.id === "string" ? obj.id : `p-${i}`,
          name: String(obj.name ?? ""),
          fabric: typeof obj.fabric === "string" ? obj.fabric : "",
          color: typeof obj.color === "string" ? obj.color : "",
          quantity: typeof obj.quantity === "number" ? obj.quantity : 0,
        };
      }
      if (typeof p === "string")
        return { id: `p-${i}`, name: p, fabric: "", color: "", quantity: 0 };
      return null;
    })
    .filter((x): x is DesignPart => !!x && !!x.name.trim());
}

function mapDesign(r: DbDesign): Design {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    customer: r.customer,
    category: r.category,
    productType: r.product_type,
    parts: normalizeParts(r.parts),
    color: r.color,
    orderQuantity: r.order_quantity,
    imagePath: r.image_path,
    notes: r.notes ?? "",
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
  productType: string;
  parts: DesignPart[];
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
          product_type: input.productType,
          parts: input.parts.map((p) => ({
            id: p.id,
            name: p.name,
            fabric: p.fabric,
            color: p.color,
            quantity: p.quantity,
          })),
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

export type UpdateDesignInput = {
  id: string;
  code: string;
  name: string;
  customer: string;
  category: string;
  productType: string;
  parts: DesignPart[];
  color: string;
  orderQuantity: number;
};

export function useUpdateDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateDesignInput): Promise<Design> => {
      const { data, error } = await supabase
        .from("designs")
        .update({
          code: input.code,
          name: input.name,
          customer: input.customer,
          category: input.category,
          product_type: input.productType,
          parts: input.parts.map((p) => ({
            id: p.id,
            name: p.name,
            fabric: p.fabric,
            color: p.color,
            quantity: p.quantity,
          })),
          color: input.color,
          order_quantity: input.orderQuantity,
        })
        .eq("id", input.id)
        .select("*")
        .single();
      if (error) throw error;
      return mapDesign(data as DbDesign);
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["designs"] });
      qc.invalidateQueries({ queryKey: ["design", "by-code", d.code] });
    },
  });
}

export function useDeleteDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (design: Pick<Design, "id" | "status" | "imagePath">): Promise<void> => {
      if (design.status !== "draft") {
        throw new Error("Only draft designs can be deleted.");
      }
      const { error } = await supabase.from("designs").delete().eq("id", design.id);
      if (error) throw error;
      if (design.imagePath) {
        await supabase.storage.from("design-images").remove([design.imagePath]);
      }
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
