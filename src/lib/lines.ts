// Fixed catalog of production lines. A Production Order is assigned to
// exactly one line at a time; the Line module is a read view onto the
// Production module scoped by this value.
export type ProductionLine = {
  slug: string;
  name: string;
  description: string;
};

export const PRODUCTION_LINES: ProductionLine[] = [
  { slug: "line-a", name: "Line A", description: "General stitching line A" },
  { slug: "line-b", name: "Line B", description: "General stitching line B" },
  { slug: "line-c", name: "Line C", description: "General stitching line C" },
  { slug: "hand-work", name: "Hand Work", description: "Hand embellishment floor" },
  { slug: "embroidery", name: "Embroidery", description: "Machine embroidery floor" },
  { slug: "cutting", name: "Cutting", description: "Cutting floor" },
];

export const LINE_NAMES = PRODUCTION_LINES.map((l) => l.name);

export function lineBySlug(slug: string): ProductionLine | undefined {
  return PRODUCTION_LINES.find((l) => l.slug === slug);
}
export function lineByName(name: string | null | undefined): ProductionLine | undefined {
  if (!name) return undefined;
  return PRODUCTION_LINES.find((l) => l.name.toLowerCase() === name.toLowerCase());
}
export function slugForLine(name: string | null | undefined): string | undefined {
  return lineByName(name)?.slug;
}
