export type ProductionStatus =
  | "Sampling"
  | "Approved"
  | "Cutting"
  | "Stitching"
  | "QC"
  | "Packing"
  | "Ready";

export type Design = {
  code: string;
  name: string;
  customer: string;
  quantity: number;
  status: ProductionStatus;
  progress: number; // 0–100
  image: string;
  fabric: string;
  color: string;
  dueDate: string;
  createdAt: string;
};

// Curated Unsplash covers (garment / fashion / textile)
export const DESIGNS: Design[] = [
  {
    code: "FL-2411",
    name: "Ivory Anarkali Gown",
    customer: "Aanya Couture",
    quantity: 240,
    status: "Stitching",
    progress: 62,
    image: "https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=800&q=80&auto=format&fit=crop",
    fabric: "Silk Chanderi",
    color: "Ivory",
    dueDate: "2026-08-02",
    createdAt: "2026-06-14",
  },
  {
    code: "FL-2412",
    name: "Lavender Kurta Set",
    customer: "House of Meher",
    quantity: 500,
    status: "Cutting",
    progress: 28,
    image: "https://images.unsplash.com/photo-1596993100471-c3905dafa78e?w=800&q=80&auto=format&fit=crop",
    fabric: "Cotton Cambric",
    color: "Lavender",
    dueDate: "2026-08-18",
    createdAt: "2026-06-22",
  },
  {
    code: "FL-2413",
    name: "Emerald Silk Saree",
    customer: "Riya Boutique",
    quantity: 120,
    status: "QC",
    progress: 88,
    image: "https://images.unsplash.com/photo-1610030469668-8e450b4d0a3f?w=800&q=80&auto=format&fit=crop",
    fabric: "Banarasi Silk",
    color: "Emerald",
    dueDate: "2026-07-25",
    createdAt: "2026-06-01",
  },
  {
    code: "FL-2414",
    name: "Rose Bridal Lehenga",
    customer: "Studio Verve",
    quantity: 60,
    status: "Sampling",
    progress: 10,
    image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&q=80&auto=format&fit=crop",
    fabric: "Raw Silk",
    color: "Rose Pink",
    dueDate: "2026-09-10",
    createdAt: "2026-07-02",
  },
  {
    code: "FL-2415",
    name: "Midnight Sherwani",
    customer: "Rajwada Menswear",
    quantity: 180,
    status: "Approved",
    progress: 18,
    image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80&auto=format&fit=crop",
    fabric: "Velvet",
    color: "Midnight Blue",
    dueDate: "2026-08-28",
    createdAt: "2026-06-28",
  },
  {
    code: "FL-2416",
    name: "Blush Co-ord Set",
    customer: "Nova Label",
    quantity: 320,
    status: "Packing",
    progress: 94,
    image: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&q=80&auto=format&fit=crop",
    fabric: "Linen Blend",
    color: "Blush",
    dueDate: "2026-07-18",
    createdAt: "2026-05-20",
  },
  {
    code: "FL-2417",
    name: "Sage Palazzo Suit",
    customer: "Aanya Couture",
    quantity: 220,
    status: "Ready",
    progress: 100,
    image: "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=800&q=80&auto=format&fit=crop",
    fabric: "Muslin",
    color: "Sage Green",
    dueDate: "2026-07-10",
    createdAt: "2026-05-05",
  },
  {
    code: "FL-2418",
    name: "Coral Party Gown",
    customer: "Studio Verve",
    quantity: 90,
    status: "Stitching",
    progress: 48,
    image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&q=80&auto=format&fit=crop",
    fabric: "Georgette",
    color: "Coral",
    dueDate: "2026-08-22",
    createdAt: "2026-06-18",
  },
];

export function getDesign(code: string): Design | undefined {
  return DESIGNS.find((d) => d.code.toLowerCase() === code.toLowerCase());
}

export const STATUS_TONE: Record<ProductionStatus, string> = {
  Sampling: "bg-accent text-accent-foreground",
  Approved: "bg-primary-soft text-accent-foreground",
  Cutting: "bg-warning/15 text-warning-foreground",
  Stitching: "bg-primary/15 text-primary",
  QC: "bg-warning/20 text-warning-foreground",
  Packing: "bg-primary/20 text-primary",
  Ready: "bg-success/15 text-success",
};
