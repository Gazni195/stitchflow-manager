export type SampleStatus =
  | "Requested"
  | "In Development"
  | "Ready for Review"
  | "Approved"
  | "Rejected";

export type MaterialKind = "Fabric" | "Trim" | "Lining" | "Embellishment";

export type SampleMaterial = {
  id: string;
  kind: MaterialKind;
  name: string;
  supplier: string;
  unit: string;
  qty: number;
  rate: number; // per unit
  selected: boolean;
};

export type CostLine = {
  id: string;
  label: string;
  category: "Material" | "Labor" | "Overhead" | "Other";
  amount: number;
};

export type Approval = {
  id: string;
  role: "Designer" | "Merchandiser" | "Production Head" | "Customer";
  name: string;
  status: "Pending" | "Approved" | "Rejected";
  note?: string;
  date?: string;
};

export type Sample = {
  code: string;
  designCode: string;
  name: string;
  customer: string;
  status: SampleStatus;
  requestedOn: string;
  targetDate: string;
  image: string;
  notes: string;
  materials: SampleMaterial[];
  costs: CostLine[];
  approvals: Approval[];
};

export const SAMPLES: Sample[] = [
  {
    code: "SMP-0142",
    designCode: "FL-2414",
    name: "Rose Bridal Lehenga",
    customer: "Studio Verve",
    status: "In Development",
    requestedOn: "2026-07-02",
    targetDate: "2026-07-20",
    image:
      "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&q=80&auto=format&fit=crop",
    notes:
      "Client requested a fuller flare and antique gold zari. Confirm dupatta length before cutting.",
    materials: [
      { id: "m1", kind: "Fabric", name: "Raw Silk — Rose Pink", supplier: "Anmol Textiles", unit: "m", qty: 6, rate: 780, selected: true },
      { id: "m2", kind: "Lining", name: "Cotton Cambric", supplier: "Anmol Textiles", unit: "m", qty: 4, rate: 220, selected: true },
      { id: "m3", kind: "Embellishment", name: "Antique Gold Zari", supplier: "Kalakriti Works", unit: "roll", qty: 2, rate: 1450, selected: true },
      { id: "m4", kind: "Trim", name: "Pearl Beading", supplier: "Kalakriti Works", unit: "m", qty: 5, rate: 340, selected: false },
    ],
    costs: [
      { id: "c1", label: "Fabric & Lining", category: "Material", amount: 5560 },
      { id: "c2", label: "Embroidery Work", category: "Labor", amount: 4200 },
      { id: "c3", label: "Stitching", category: "Labor", amount: 1800 },
      { id: "c4", label: "Finishing & Packing", category: "Overhead", amount: 650 },
    ],
    approvals: [
      { id: "a1", role: "Designer", name: "Neha K.", status: "Approved", date: "2026-07-05" },
      { id: "a2", role: "Merchandiser", name: "Arjun P.", status: "Approved", date: "2026-07-06" },
      { id: "a3", role: "Production Head", name: "Vikas R.", status: "Pending" },
      { id: "a4", role: "Customer", name: "Studio Verve", status: "Pending" },
    ],
  },
  {
    code: "SMP-0141",
    designCode: "FL-2412",
    name: "Lavender Kurta Set",
    customer: "House of Meher",
    status: "Ready for Review",
    requestedOn: "2026-06-22",
    targetDate: "2026-07-12",
    image:
      "https://images.unsplash.com/photo-1596993100471-c3905dafa78e?w=800&q=80&auto=format&fit=crop",
    notes: "Two colorways to be reviewed together.",
    materials: [
      { id: "m1", kind: "Fabric", name: "Cotton Cambric — Lavender", supplier: "Weaves & Co.", unit: "m", qty: 3.2, rate: 210, selected: true },
      { id: "m2", kind: "Trim", name: "Wooden Buttons", supplier: "Trim Bazaar", unit: "pc", qty: 12, rate: 18, selected: true },
    ],
    costs: [
      { id: "c1", label: "Fabric", category: "Material", amount: 672 },
      { id: "c2", label: "Stitching", category: "Labor", amount: 480 },
      { id: "c3", label: "Overheads", category: "Overhead", amount: 120 },
    ],
    approvals: [
      { id: "a1", role: "Designer", name: "Neha K.", status: "Approved", date: "2026-06-28" },
      { id: "a2", role: "Merchandiser", name: "Arjun P.", status: "Pending" },
      { id: "a3", role: "Customer", name: "House of Meher", status: "Pending" },
    ],
  },
  {
    code: "SMP-0140",
    designCode: "FL-2411",
    name: "Ivory Anarkali Gown",
    customer: "Aanya Couture",
    status: "Approved",
    requestedOn: "2026-06-14",
    targetDate: "2026-07-01",
    image:
      "https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=800&q=80&auto=format&fit=crop",
    notes: "Approved for bulk. Confirm final GSM before cutting.",
    materials: [
      { id: "m1", kind: "Fabric", name: "Silk Chanderi — Ivory", supplier: "Anmol Textiles", unit: "m", qty: 4.5, rate: 640, selected: true },
    ],
    costs: [
      { id: "c1", label: "Fabric", category: "Material", amount: 2880 },
      { id: "c2", label: "Stitching", category: "Labor", amount: 900 },
    ],
    approvals: [
      { id: "a1", role: "Designer", name: "Neha K.", status: "Approved", date: "2026-06-20" },
      { id: "a2", role: "Merchandiser", name: "Arjun P.", status: "Approved", date: "2026-06-22" },
      { id: "a3", role: "Production Head", name: "Vikas R.", status: "Approved", date: "2026-06-24" },
      { id: "a4", role: "Customer", name: "Aanya Couture", status: "Approved", date: "2026-06-28" },
    ],
  },
  {
    code: "SMP-0139",
    designCode: "FL-2418",
    name: "Coral Party Gown",
    customer: "Studio Verve",
    status: "Requested",
    requestedOn: "2026-07-08",
    targetDate: "2026-07-28",
    image:
      "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&q=80&auto=format&fit=crop",
    notes: "Awaiting fabric swatches from supplier.",
    materials: [],
    costs: [],
    approvals: [
      { id: "a1", role: "Designer", name: "Neha K.", status: "Pending" },
    ],
  },
];

export const SAMPLE_STATUS_TONE: Record<SampleStatus, string> = {
  Requested: "bg-muted text-muted-foreground",
  "In Development": "bg-primary/15 text-primary",
  "Ready for Review": "bg-warning/20 text-warning-foreground",
  Approved: "bg-success/15 text-success",
  Rejected: "bg-destructive/15 text-destructive",
};

export const APPROVAL_TONE: Record<Approval["status"], string> = {
  Pending: "bg-muted text-muted-foreground",
  Approved: "bg-success/15 text-success",
  Rejected: "bg-destructive/15 text-destructive",
};

export function sampleTotal(s: Sample) {
  return s.costs.reduce((sum, c) => sum + c.amount, 0);
}

export function selectedMaterialTotal(s: Sample) {
  return s.materials
    .filter((m) => m.selected)
    .reduce((sum, m) => sum + m.qty * m.rate, 0);
}
