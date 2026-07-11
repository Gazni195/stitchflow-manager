// Rolls up a design's sample cost from real data: BOM (materials), per-step
// labor cost stamped at "Complete Work" time, and a flat other-charges field
// on the sample workflow. Shared by the Sample Details hub, Cost Summary and
// Sample Approval screens so they always agree on the same number.
import type { BomItem } from "@/lib/api/sample-bom";
import type { DesignWorkflow } from "@/lib/api/workflows";
import type { CatalogOperation } from "@/lib/api/operations";

export type CostLine = { label: string; amount: number };

export type SampleCost = {
  materialCost: number;
  departmentLines: CostLine[];
  otherCharges: number;
  total: number;
};

export function getSampleCost(
  bomItems: BomItem[],
  sampleWorkflow: DesignWorkflow | undefined,
  catalog: CatalogOperation[],
): SampleCost {
  const materialCost = bomItems.reduce((s, b) => s + b.consumption * b.rate, 0);

  const catalogById = new Map(catalog.map((o) => [o.id, o]));
  const byDept = new Map<string, number>();
  for (const step of sampleWorkflow?.steps ?? []) {
    if (step.costPerPiece == null) continue;
    const dept = catalogById.get(step.operationId)?.department || "Other";
    byDept.set(dept, (byDept.get(dept) ?? 0) + step.costPerPiece);
  }
  const departmentLines: CostLine[] = Array.from(byDept.entries()).map(([label, amount]) => ({
    label,
    amount,
  }));

  const otherCharges = sampleWorkflow?.otherCharges ?? 0;
  const total =
    materialCost + departmentLines.reduce((s, l) => s + l.amount, 0) + otherCharges;

  return { materialCost, departmentLines, otherCharges, total };
}

/** Estimated margin vs. a target cost per piece; 0 when no target is set. */
export function estMarginPct(targetCostPerPiece: number, actualCostPerPiece: number): number {
  if (targetCostPerPiece <= 0) return 0;
  return Math.round(((targetCostPerPiece - actualCostPerPiece) / targetCostPerPiece) * 100);
}
