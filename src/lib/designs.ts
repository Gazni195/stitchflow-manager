// Types + status styling for the designs domain.
// All data lives in Supabase (see src/lib/api/designs.ts).

export type DesignStatus = "draft" | "sampling" | "sample_approved" | "in_production" | "completed" | "design_rejected";

export type DesignPart = {
  id: string;
  name: string;
  fabric: string;
  color: string;
};

export type Design = {
  id: string;
  code: string;
  name: string;
  customer: string;
  category: string;
  productType: string;
  parts: DesignPart[];
  color: string;
  orderQuantity: number;
  imagePath: string | null;
  notes: string;
  status: DesignStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export const STATUS_LABEL: Record<DesignStatus, string> = {
  draft: "Draft",
  sampling: "Sampling",
  sample_approved: "Sample Approved",
  in_production: "In Production",
  completed: "Completed",
  design_rejected: "Design Rejected",
};

export const STATUS_TONE: Record<DesignStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sampling: "bg-accent text-accent-foreground",
  sample_approved: "bg-primary-soft text-primary",
  in_production: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
  design_rejected: "bg-destructive/15 text-destructive",
};
