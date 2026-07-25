// Inventory Material Master + Bundles + per-design material selection.
// Materials are shared inventory (any signed-in team member can read). Only
// inventory managers / admins can mutate. Each material's Available Stock is
// trigger-maintained from the sum of usable-minus-consumed across its bundles.
// Design selections snapshot the current cost so historical samples don't
// shift when inventory is later re-priced.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MaterialStatus = "active" | "inactive";

export type Material = {
  id: string;
  code: string;
  name: string;
  color: string | null;
  unit: string;
  availableStock: number;
  costPerUnit: number;
  status: MaterialStatus;
  bundleCount?: number;
};

export type MaterialBundle = {
  id: string;
  materialId: string;
  bundleNumber: number;
  rollNumber: string | null;
  fabricWidth: string;
  purchasedLength: number;
  usableLength: number;
  consumedLength: number;
  remainingLength: number;
};

export type DesignMaterial = {
  id: string;
  designId: string;
  materialId: string;
  groupName: string;
  quantity: number;
  rate: number;
  amount: number;
  material: Material | null;
};

type DbMaterial = {
  id: string;
  code: string;
  name: string;
  color: string | null;
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
    color: r.color ?? null,
    unit: r.unit,
    availableStock: Number(r.available_stock ?? 0),
    costPerUnit: Number(r.cost_per_unit ?? 0),
    status: (r.status as MaterialStatus) ?? "active",
  };
}

/* ----- Material Code Settings ----- */

export type MaterialCodeSettings = { prefix: string; nextNumber: number };

export function useMaterialCodeSettings() {
  return useQuery({
    queryKey: ["material-code-settings"],
    queryFn: async (): Promise<MaterialCodeSettings> => {
      const { data, error } = await supabase
        .from("material_code_settings")
        .select("prefix, next_number")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return {
        prefix: data?.prefix ?? "FAB",
        nextNumber: Number(data?.next_number ?? 1),
      };
    },
  });
}

export function useUpdateMaterialCodeSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MaterialCodeSettings) => {
      const { error } = await supabase
        .from("material_code_settings")
        .upsert({ id: true, prefix: input.prefix.trim(), next_number: input.nextNumber });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["material-code-settings"] }),
  });
}

/* ----- Inventory Master ----- */

export function useMaterials() {
  return useQuery({
    queryKey: ["materials"],
    queryFn: async (): Promise<Material[]> => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, code, name, color, unit, available_stock, cost_per_unit, status, inventory_bundles(id)")
        .order("code", { ascending: true });
      if (error) throw error;
      return (data as unknown as (DbMaterial & { inventory_bundles: { id: string }[] })[]).map((r) => ({
        ...mapMaterial(r),
        bundleCount: r.inventory_bundles?.length ?? 0,
      }));
    },
  });
}

export type MaterialCreateInput = {
  name: string;
  color: string | null;
  unit: string;
  costPerUnit: number;
  status: MaterialStatus;
};

export function useCreateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MaterialCreateInput) => {
      const { data: codeData, error: codeErr } = await supabase.rpc("next_material_code");
      if (codeErr) throw codeErr;
      const code = codeData as unknown as string;
      const { data, error } = await supabase
        .from("materials")
        .insert({
          code,
          name: input.name.trim(),
          color: input.color?.trim() || null,
          unit: input.unit,
          cost_per_unit: input.costPerUnit,
          rate: input.costPerUnit,
          status: input.status,
          available_stock: 0,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      qc.invalidateQueries({ queryKey: ["material-code-settings"] });
    },
  });
}

export type MaterialUpdateInput = {
  id: string;
  name: string;
  color: string | null;
  unit: string;
  costPerUnit: number;
  status: MaterialStatus;
};

export function useUpdateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MaterialUpdateInput) => {
      const { error } = await supabase
        .from("materials")
        .update({
          name: input.name.trim(),
          color: input.color?.trim() || null,
          unit: input.unit,
          cost_per_unit: input.costPerUnit,
          rate: input.costPerUnit,
          status: input.status,
        })
        .eq("id", input.id);
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

/* ----- Bundles ----- */

type DbBundle = {
  id: string;
  material_id: string;
  bundle_number: number;
  roll_number: string | null;
  fabric_width: string;
  purchased_length: number;
  usable_length: number;
  consumed_length: number;
  remaining_length: number;
};

function mapBundle(r: DbBundle): MaterialBundle {
  return {
    id: r.id,
    materialId: r.material_id,
    bundleNumber: r.bundle_number,
    rollNumber: r.roll_number,
    fabricWidth: r.fabric_width,
    purchasedLength: Number(r.purchased_length ?? 0),
    usableLength: Number(r.usable_length ?? 0),
    consumedLength: Number(r.consumed_length ?? 0),
    remainingLength: Number(r.remaining_length ?? 0),
  };
}

export function useMaterialBundles(materialId: string | undefined) {
  return useQuery({
    queryKey: ["material-bundles", materialId],
    enabled: !!materialId,
    queryFn: async (): Promise<MaterialBundle[]> => {
      const { data, error } = await supabase
        .from("inventory_bundles")
        .select("id, material_id, bundle_number, roll_number, fabric_width, purchased_length, usable_length, consumed_length, remaining_length")
        .eq("material_id", materialId!)
        .order("bundle_number", { ascending: true });
      if (error) throw error;
      return (data as unknown as DbBundle[]).map(mapBundle);
    },
  });
}

export type BundleInput = {
  rollNumber: string | null;
  fabricWidth: string;
  purchasedLength: number;
  usableLength: number;
};

export function useUpsertBundle(materialId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BundleInput & { id?: string }) => {
      if (input.usableLength > input.purchasedLength) {
        throw new Error("Usable length cannot exceed purchased length.");
      }
      const payload = {
        roll_number: input.rollNumber?.trim() || null,
        fabric_width: input.fabricWidth.trim(),
        purchased_length: input.purchasedLength,
        usable_length: input.usableLength,
      };
      if (input.id) {
        const { error } = await supabase.from("inventory_bundles").update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("inventory_bundles")
          // bundle_number is auto-assigned by trigger; 0 acts as sentinel.
          .insert({ ...payload, material_id: materialId, bundle_number: 0 });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material-bundles", materialId] });
      qc.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

export function useDeleteBundle(materialId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_bundles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material-bundles", materialId] });
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
          "id, design_id, material_id, group_name, quantity, rate, materials:material_id(id, code, name, color, unit, available_stock, cost_per_unit, status)",
        )
        .eq("design_id", designId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as DbDesignMaterial[]).map(mapDesignMaterial);
    },
  });
}

// Fetch current stock for a material.
async function getStock(materialId: string): Promise<number> {
  const { data, error } = await supabase
    .from("materials")
    .select("available_stock")
    .eq("id", materialId)
    .single();
  if (error) throw error;
  return Number((data as { available_stock: number | null }).available_stock ?? 0);
}

// Deduct against the first bundle(s) with remaining length (FIFO). Restore
// symmetrically. This keeps materials.available_stock in sync via trigger and
// preserves bundle-level accounting for future per-bundle production picks.
async function consumeFromBundles(materialId: string, delta: number): Promise<void> {
  if (delta === 0) return;
  if (delta > 0) {
    // deduct
    const stock = await getStock(materialId);
    if (delta > stock) {
      throw new Error(`Not enough stock: requested ${delta} but only ${stock} available.`);
    }
    let remaining = delta;
    const { data, error } = await supabase
      .from("inventory_bundles")
      .select("id, usable_length, consumed_length")
      .eq("material_id", materialId)
      .order("bundle_number", { ascending: true });
    if (error) throw error;
    for (const b of (data ?? []) as { id: string; usable_length: number; consumed_length: number }[]) {
      if (remaining <= 0) break;
      const free = Number(b.usable_length) - Number(b.consumed_length);
      if (free <= 0) continue;
      const take = Math.min(free, remaining);
      const { error: uErr } = await supabase
        .from("inventory_bundles")
        .update({ consumed_length: Number(b.consumed_length) + take })
        .eq("id", b.id);
      if (uErr) throw uErr;
      remaining -= take;
    }
    if (remaining > 0) throw new Error("Not enough bundle capacity to fulfil deduction.");
  } else {
    // restore: refund in reverse bundle order
    let remaining = -delta;
    const { data, error } = await supabase
      .from("inventory_bundles")
      .select("id, consumed_length")
      .eq("material_id", materialId)
      .order("bundle_number", { ascending: false });
    if (error) throw error;
    for (const b of (data ?? []) as { id: string; consumed_length: number }[]) {
      if (remaining <= 0) break;
      const consumed = Number(b.consumed_length);
      if (consumed <= 0) continue;
      const give = Math.min(consumed, remaining);
      const { error: uErr } = await supabase
        .from("inventory_bundles")
        .update({ consumed_length: consumed - give })
        .eq("id", b.id);
      if (uErr) throw uErr;
      remaining -= give;
    }
  }
}

export function useAddDesignMaterial(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { materialId: string; groupName: string; quantity: number; rate: number }) => {
      const stock = await getStock(input.materialId);
      if (input.quantity > stock) {
        throw new Error(`Not enough stock: requested ${input.quantity} but only ${stock} available.`);
      }
      const { error } = await supabase.from("design_materials").insert({
        design_id: designId,
        material_id: input.materialId,
        group_name: input.groupName,
        quantity: input.quantity,
        rate: input.rate,
      });
      if (error) throw error;
      await consumeFromBundles(input.materialId, input.quantity);
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

      const patch: { quantity: number; rate?: number; material_id?: string } = { quantity: nextQty };
      if (typeof input.rate === "number") patch.rate = input.rate;
      if (input.materialId) patch.material_id = input.materialId;
      const { error } = await supabase.from("design_materials").update(patch).eq("id", input.id);
      if (error) throw error;

      if (nextMaterialId === prevMaterialId) {
        await consumeFromBundles(nextMaterialId, nextQty - prevQty);
      } else {
        await consumeFromBundles(prevMaterialId, -prevQty);
        await consumeFromBundles(nextMaterialId, nextQty);
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

      await consumeFromBundles(materialId, -qty);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["design-materials", designId] });
      qc.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}
