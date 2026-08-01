// Production calculation — every material carries one assigned Consumption
// Rule (set in Inventory). Production never re-matches a rule by width or
// layer length; it always uses the rule already assigned to the material.
// Nothing here is hardcoded — the reduction percentage always comes from
// that assigned rule.

/** Sample (Per Piece) consumption reduced by the material's assigned rule. */
export function calcProductionPerPiece(samplePerPiece: number, reductionPct: number): number {
  return Number((samplePerPiece * (1 - reductionPct / 100)).toFixed(2));
}

/** How many complete sets can be cut from the fabric currently allocated to a shared set consumption. */
export function calcSetsPossible(effectiveAvailable: number, productionPerPiece: number): number {
  return productionPerPiece > 0 ? Math.floor(effectiveAvailable / productionPerPiece) : 0;
}
