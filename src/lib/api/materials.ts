// Inventory Material Master + per-design material selection.
// Materials live in a shared inventory (any authenticated team member can
// read/write). Prices always come from inventory — design selections just
// snapshot the current cost so historical samples don't shift when inventory
// is later re-priced. Data model mirrors ERPNext Item fields (item_code,
// item_name, stock_uom, standard_rate, actual_qty, status) so a future
// ERPNext sync can map 1:1 without a schema change.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MaterialStatus = "active" | "inactive";

export type Material = {
  id: string;
  code: string;
  name: string;
  unit: string;
  availableStock: number;
  costPerUnit: number;
  status: MaterialStatus;
};

export type DesignMaterial = {
  id: string;
  designId: string;
  materialId: string;
  groupName: string;
  quantity: number;
  rate: number; // snapshot of material.cost_per_unit at time of selection
  amount: number; // quantity * rate
  material: Material | null;
};

type DbMaterial = {
  id: string;
  code: string;
  name: string;
  unit: string;
  available_stock: number;
  cost_per_unit: number;
  status: string;
};

function mapMaterial(r: DbMaterial): Material {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    unit: r.unit,
    availableStock: Number(r.available_stock ?? 0),
    costPerUnit: Number(r.cost_per_unit ?? 0),
    status: (r.status as MaterialStatus) ?? "active",
  };
}

/* ----- Inventory Master ----- */

export function useMaterials() {
  return useQuery({
    queryKey: ["materials"],
    queryFn: async (): Promise<Material[]> => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, code, name, unit, available_stock, cost_per_unit, status, rate")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data as unknown as DbMaterial[]).map(mapMaterial);
    },
  });
}

export type MaterialInput = {
  code: string;
  name: string;
  unit: string;
  availableStock: number;
  costPerUnit: number;
  status: MaterialStatus;
};

export function useUpsertMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MaterialInput & { id?: string }) => {
      const payload = {
        code: input.code.trim(),
        name: input.name.trim(),
        unit: input.unit,
        available_stock: input.availableStock,
        cost_per_unit: input.costPerUnit,
        rate: input.costPerUnit, // keep legacy column in sync
        status: input.status,
      };
      if (input.id) {
        const { error } = await supabase.from("materials").update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("materials").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

/* ----- Design ↔ Material selections ----- */

type DbDesignMaterial = {
  id: string;
  design_id: string;
  material_id: string;
  group_name: string;
  quantity: number;
  rate: number;
  materials: DbMaterial | null;
};

function mapDesignMaterial(r: DbDesignMaterial): DesignMaterial {
  const qty = Number(r.quantity ?? 0);
  const rate = Number(r.rate ?? 0);
  return {
    id: r.id,
    designId: r.design_id,
    materialId: r.material_id,
    groupName: r.group_name,
    quantity: qty,
    rate,
    amount: qty * rate,
    material: r.materials ? mapMaterial(r.materials) : null,
  };
}

export function useDesignMaterials(designId: string | undefined) {
  return useQuery({
    queryKey: ["design-materials", designId],
    enabled: !!designId,
    queryFn: async (): Promise<DesignMaterial[]> => {
      const { data, error } = await supabase
        .from("design_materials")
        .select(
          "id, design_id, material_id, group_name, quantity, rate, materials:material_id(id, code, name, unit, available_stock, cost_per_unit, status, rate)",
        )
        .eq("design_id", designId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as DbDesignMaterial[]).map(mapDesignMaterial);
    },
  });
}

// Fetch current stock for a material. Throws if the row is missing.
async function getStock(materialId: string): Promise<number> {
  const { data, error } = await supabase
    .from("materials")
    .select("available_stock")
    .eq("id", materialId)
    .single();
  if (error) throw error;
  return Number((data as { available_stock: number | null }).available_stock ?? 0);
}

// Apply a signed delta to inventory stock. Negative delta = deduction,
// positive delta = restoration. Guards against negative stock.
async function adjustStock(materialId: string, delta: number): Promise<void> {
  if (delta === 0) return;
  const current = await getStock(materialId);
  const next = current + delta;
  if (next < 0) {
    throw new Error(
      `Not enough stock: requested ${Math.abs(delta)} but only ${current} available.`,
    );
  }
  const { error } = await supabase
    .from("materials")
    .update({ available_stock: next })
    .eq("id", materialId);
  if (error) throw error;
}

export function useAddDesignMaterial(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { materialId: string; groupName: string; quantity: number; rate: number }) => {
      // Validate before insert so we never persist a selection we can't fulfil.
      const stock = await getStock(input.materialId);
      if (input.quantity > stock) {
        throw new Error(
          `Not enough stock: requested ${input.quantity} but only ${stock} available.`,
        );
      }
      const { error } = await supabase.from("design_materials").insert({
        design_id: designId,
        material_id: input.materialId,
        group_name: input.groupName,
        quantity: input.quantity,
        rate: input.rate,
      });
      if (error) throw error;
      // Deduct only after the selection saved successfully.
      await adjustStock(input.materialId, -input.quantity);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["design-materials", designId] });
      qc.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

export function useUpdateDesignMaterial(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; quantity: number; rate?: number; materialId?: string }) => {
      // Load the previous row so we know what to restore / re-deduct.
      const { data: prev, error: prevErr } = await supabase
        .from("design_materials")
        .select("material_id, quantity")
        .eq("id", input.id)
        .single();
      if (prevErr) throw prevErr;
      const prevMaterialId = (prev as { material_id: string }).material_id;
      const prevQty = Number((prev as { quantity: number | null }).quantity ?? 0);
      const nextMaterialId = input.materialId ?? prevMaterialId;
      const nextQty = input.quantity;

      // Validate the effective deduction against live stock before writing.
      if (nextMaterialId === prevMaterialId) {
        const delta = nextQty - prevQty; // positive = extra deduction needed
        if (delta > 0) {
          const stock = await getStock(nextMaterialId);
          if (delta > stock) {
            throw new Error(
              `Not enough stock: need ${delta} more but only ${stock} available.`,
            );
          }
        }
      } else {
        // Switching materials: full restoration on old, full deduction on new.
        const stock = await getStock(nextMaterialId);
        if (nextQty > stock) {
          throw new Error(
            `Not enough stock: requested ${nextQty} but only ${stock} available.`,
          );
        }
      }

      const patch: { quantity: number; rate?: number; material_id?: string } = { quantity: nextQty };
      if (typeof input.rate === "number") patch.rate = input.rate;
      if (input.materialId) patch.material_id = input.materialId;
      const { error } = await supabase.from("design_materials").update(patch).eq("id", input.id);
      if (error) throw error;

      // Apply inventory adjustments after the row is saved.
      if (nextMaterialId === prevMaterialId) {
        await adjustStock(nextMaterialId, prevQty - nextQty); // net delta
      } else {
        await adjustStock(prevMaterialId, prevQty); // restore old
        await adjustStock(nextMaterialId, -nextQty); // deduct new
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["design-materials", designId] });
      qc.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

export function useRemoveDesignMaterial(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Read the row first so we know how much to restore.
      const { data: prev, error: prevErr } = await supabase
        .from("design_materials")
        .select("material_id, quantity")
        .eq("id", id)
        .single();
      if (prevErr) throw prevErr;
      const materialId = (prev as { material_id: string }).material_id;
      const qty = Number((prev as { quantity: number | null }).quantity ?? 0);

      const { error } = await supabase.from("design_materials").delete().eq("id", id);
      if (error) throw error;

      // Return the reserved quantity to inventory.
      await adjustStock(materialId, qty);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["design-materials", designId] });
      qc.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}
