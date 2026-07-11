import {
  Sparkles,
  Layers,
  Scissors,
  Calculator,
  CheckCircle2,
  Ruler,
  Hand,
  Shirt,
  ShieldCheck,
  Package,
  QrCode,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export type OperationId =
  | "sample-creation"
  | "material-selection"
  | "sample-making"
  | "costing"
  | "sample-approval"
  | "cutting"
  | "handwork"
  | "stitching"
  | "qc"
  | "packing"
  | "barcode"
  | "ready-stock";

export type OperationCategory = "Sample" | "Bulk" | "Finishing";

export type Operation = {
  id: OperationId;
  name: string;
  short: string;
  description: string;
  icon: LucideIcon;
  route: string;
  category: OperationCategory;
  repeatable: boolean;
};

export const OPERATIONS: Operation[] = [
  { id: "sample-creation",   name: "Sample Creation",   short: "Samples",   description: "Create new sample requests and specs.",          icon: Sparkles,      route: "/samples",         category: "Sample",    repeatable: false },
  { id: "material-selection",name: "Material Selection",short: "Materials", description: "Choose fabrics and trims for the sample.",       icon: Layers,        route: "/materials",       category: "Sample",    repeatable: false },
  { id: "sample-making",     name: "Sample Making",     short: "Sampling",  description: "Track sample stitching progress.",               icon: Scissors,      route: "/sample-making",   category: "Sample",    repeatable: true  },
  { id: "costing",           name: "Costing",           short: "Costing",   description: "Estimate per-piece production cost.",            icon: Calculator,    route: "/costing",         category: "Sample",    repeatable: false },
  { id: "sample-approval",   name: "Sample Approval",   short: "Approval",  description: "Client and internal sample sign-off.",           icon: CheckCircle2,  route: "/approvals",       category: "Sample",    repeatable: true  },
  { id: "cutting",           name: "Bulk Cutting",      short: "Cutting",   description: "Manage bulk fabric cutting orders.",             icon: Ruler,         route: "/cutting",         category: "Bulk",      repeatable: true  },
  { id: "handwork",          name: "Bulk Hand Work",    short: "Hand Work", description: "Track embroidery and hand embellishment.",       icon: Hand,          route: "/handwork",        category: "Bulk",      repeatable: true  },
  { id: "stitching",         name: "Bulk Stitching",    short: "Stitching", description: "Production line stitching progress.",            icon: Shirt,         route: "/stitching",       category: "Bulk",      repeatable: true  },
  { id: "qc",                name: "Quality Check",     short: "QC",        description: "Inspect and mark pass / rework / reject.",       icon: ShieldCheck,   route: "/qc",              category: "Finishing", repeatable: true  },
  { id: "packing",           name: "Packing",           short: "Packing",   description: "Fold, tag and pack finished pieces.",            icon: Package,       route: "/packing",         category: "Finishing", repeatable: false },
  { id: "barcode",           name: "Barcode",           short: "Barcode",   description: "Generate and scan piece barcodes.",              icon: QrCode,        route: "/barcode",         category: "Finishing", repeatable: false },
  { id: "ready-stock",       name: "Ready Stock",       short: "Stock",     description: "Finished goods ready for dispatch.",             icon: Warehouse,     route: "/stock",           category: "Finishing", repeatable: false },
];

export const OPERATIONS_BY_ID: Record<OperationId, Operation> = Object.fromEntries(
  OPERATIONS.map((o) => [o.id, o]),
) as Record<OperationId, Operation>;

export function getOperation(id: OperationId): Operation {
  return OPERATIONS_BY_ID[id];
}

export function getOperationByRoute(route: string): Operation | undefined {
  return OPERATIONS.find((o) => o.route === route);
}
