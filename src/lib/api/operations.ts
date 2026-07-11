import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  OPERATIONS_BY_ID as ICONS,
  type Operation as OpMeta,
  type OperationId,
} from "@/lib/operations";
import { Wrench, Printer, Droplets, MoreHorizontal, type LucideIcon } from "lucide-react";

export type CatalogOperation = {
  id: string;
  name: string;
  short: string;
  category: "Sample" | "Bulk" | "Finishing";
  repeatable: boolean;
  sort: number;
  department: string;
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
  "sample-approval": "/designs",
  "sample-cutting": "/designs",
  "sample-stitching": "/designs",
  "sample-handwork": "/designs",
  "sample-qc": "/designs",
  "fabric-selection": "/materials",
  "machine-embroidery": "/handwork",
  "bulk-embroidery": "/handwork",
  printing: "/designs",
  "wash-dye": "/designs",
  "other-process": "/designs",
};

// Ops not covered by the legacy src/lib/operations.ts icon map (printing/wash-dye/other-process
// only exist in the live operations_catalog table, added for the sample flow).
const EXTRA_ICONS: Record<string, LucideIcon> = {
  printing: Printer,
  "wash-dye": Droplets,
  "other-process": MoreHorizontal,
};

export function decorate(id: string, name: string, short: string, category: CatalogOperation["category"], repeatable: boolean, sort: number, department: string): CatalogOperation {
  const meta = ICONS[id as OperationId];
  return {
    id,
    name,
    short,
    category,
    repeatable,
    sort,
    department,
    icon: meta?.icon ?? EXTRA_ICONS[id] ?? Wrench,
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
      return (data as Array<{ id: string; name: string; short: string; category: CatalogOperation["category"]; repeatable: boolean; sort: number; department: string }>).map(
        (r) => decorate(r.id, r.name, r.short, r.category, r.repeatable, r.sort, r.department),
      );
    },
  });
}
