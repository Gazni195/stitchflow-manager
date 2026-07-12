import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  OPERATIONS_BY_ID as ICONS,
  type Operation as OpMeta,
  type OperationId,
} from "@/lib/operations";
import { Wrench } from "lucide-react";

export type CatalogOperation = {
  id: string;
  name: string;
  short: string;
  category: "Sample" | "Bulk" | "Finishing";
  repeatable: boolean;
  sort: number;
  icon: OpMeta["icon"];
  route: string;
};

const FALLBACK_ROUTE: Record<string, string> = {
  cutting: "/cutting",
  handwork: "/handwork",
  stitching: "/stitching",
  qc: "/qc",
  packing: "/packing",
  barcode: "/barcode",
  "ready-stock": "/stock",
  "sample-approval": "/sample-development",
  "sample-cutting": "/sample-development",
  "sample-stitching": "/sample-development",
  "sample-handwork": "/sample-development",
  "sample-qc": "/sample-development",
  "fabric-selection": "/materials",
  "machine-embroidery": "/handwork",
  "bulk-embroidery": "/handwork",
};

export function decorate(id: string, name: string, short: string, category: CatalogOperation["category"], repeatable: boolean, sort: number): CatalogOperation {
  const meta = ICONS[id as OperationId];
  return {
    id,
    name,
    short,
    category,
    repeatable,
    sort,
    icon: meta?.icon ?? Wrench,
    route: meta?.route ?? FALLBACK_ROUTE[id] ?? "/",
  };
}

export function useOperationCatalog() {
  return useQuery({
    queryKey: ["operations-catalog"],
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<CatalogOperation[]> => {
      const { data, error } = await supabase
        .from("operations_catalog")
        .select("*")
        .order("sort", { ascending: true });
      if (error) throw error;
      return (data as Array<{ id: string; name: string; short: string; category: CatalogOperation["category"]; repeatable: boolean; sort: number }>).map(
        (r) => decorate(r.id, r.name, r.short, r.category, r.repeatable, r.sort),
      );
    },
  });
}

export function useAddOperation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { name: string; category?: CatalogOperation["category"]; short?: string; repeatable?: boolean }): Promise<string> => {
      const category = v.category ?? "Sample";
      const short = v.short ?? v.name;
      const slug = v.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "op";
      const id = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
      const { data: maxRow } = await supabase
        .from("operations_catalog")
        .select("sort")
        .order("sort", { ascending: false })
        .limit(1)
        .maybeSingle();
      const sort = ((maxRow as { sort?: number } | null)?.sort ?? 0) + 1;
      const { error } = await supabase.from("operations_catalog").insert({
        id,
        name: v.name,
        short,
        category,
        repeatable: v.repeatable ?? false,
        sort,
      });
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operations-catalog"] });
    },
  });
}
