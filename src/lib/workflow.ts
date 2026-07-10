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

export type WorkflowStage = {
  id: string;
  step: number;
  title: string;
  short: string;
  description: string;
  to: string;
  icon: LucideIcon;
  phase: "Sample" | "Bulk" | "Finishing";
};

export const WORKFLOW: WorkflowStage[] = [
  { id: "sample-creation", step: 1, title: "Sample Creation", short: "Samples", description: "Create new sample requests and specs.", to: "/samples", icon: Sparkles, phase: "Sample" },
  { id: "material-selection", step: 2, title: "Material Selection", short: "Materials", description: "Choose fabrics and trims for the sample.", to: "/materials", icon: Layers, phase: "Sample" },
  { id: "sample-making", step: 3, title: "Sample Making", short: "Sampling", description: "Track sample stitching progress.", to: "/sample-making", icon: Scissors, phase: "Sample" },
  { id: "costing", step: 4, title: "Costing", short: "Costing", description: "Estimate per-piece production cost.", to: "/costing", icon: Calculator, phase: "Sample" },
  { id: "sample-approval", step: 5, title: "Sample Approval", short: "Approval", description: "Client and internal sample sign-off.", to: "/approvals", icon: CheckCircle2, phase: "Sample" },
  { id: "bulk-cutting", step: 6, title: "Bulk Cutting", short: "Cutting", description: "Manage bulk fabric cutting orders.", to: "/cutting", icon: Ruler, phase: "Bulk" },
  { id: "bulk-handwork", step: 7, title: "Bulk Hand Work", short: "Hand Work", description: "Track embroidery and hand embellishment.", to: "/handwork", icon: Hand, phase: "Bulk" },
  { id: "bulk-stitching", step: 8, title: "Bulk Stitching", short: "Stitching", description: "Production line stitching progress.", to: "/stitching", icon: Shirt, phase: "Bulk" },
  { id: "quality-check", step: 9, title: "Quality Check", short: "QC", description: "Inspect and mark pass / rework / reject.", to: "/qc", icon: ShieldCheck, phase: "Finishing" },
  { id: "packing", step: 10, title: "Packing", short: "Packing", description: "Fold, tag and pack finished pieces.", to: "/packing", icon: Package, phase: "Finishing" },
  { id: "barcode", step: 11, title: "Barcode", short: "Barcode", description: "Generate and scan piece barcodes.", to: "/barcode", icon: QrCode, phase: "Finishing" },
  { id: "ready-stock", step: 12, title: "Ready Stock", short: "Stock", description: "Finished goods ready for dispatch.", to: "/stock", icon: Warehouse, phase: "Finishing" },
];
