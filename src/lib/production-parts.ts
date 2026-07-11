// Shared source of truth for the garment parts that flow into every
// production workflow module (Cutting, Hand Work, Stitching, QC, ...).
// Each part carries its own fabric — production operations must always
// use the fabric assigned to the selected part, not a single order-level
// fabric.

export type OrderPart = {
  name: string;
  fabric: string;
};

const ORDER_PARTS: Record<string, OrderPart[]> = {
  MG001: [
    { name: "Front Body", fabric: "Silk Chanderi" },
    { name: "Back Body", fabric: "Silk Chanderi" },
    { name: "Sleeve", fabric: "Silk Chanderi" },
    { name: "Dupatta", fabric: "Organza" },
    { name: "Pant", fabric: "Cotton Lycra" },
  ],
  MG002: [
    { name: "Front Body", fabric: "Cotton Cambric" },
    { name: "Back Body", fabric: "Cotton Cambric" },
    { name: "Sleeve", fabric: "Cotton Cambric" },
    { name: "Collar", fabric: "Poplin" },
  ],
  MG003: [
    { name: "Front Body", fabric: "Banarasi Silk" },
    { name: "Back Body", fabric: "Banarasi Silk" },
    { name: "Sleeve", fabric: "Banarasi Silk" },
    { name: "Dupatta", fabric: "Net" },
  ],
  MG004: [
    { name: "Front Body", fabric: "Georgette" },
    { name: "Back Body", fabric: "Georgette" },
    { name: "Sleeve", fabric: "Georgette" },
    { name: "Yoke", fabric: "Velvet" },
  ],
};

const DEFAULT_PARTS: OrderPart[] = [
  { name: "Front Body", fabric: "—" },
  { name: "Back Body", fabric: "—" },
  { name: "Sleeve", fabric: "—" },
];

export function getOrderParts(code: string): OrderPart[] {
  return ORDER_PARTS[code] ?? DEFAULT_PARTS;
}

export function getPartFabric(code: string, partName: string): string {
  const parts = getOrderParts(code);
  return parts.find((p) => p.name === partName)?.fabric ?? "—";
}
