// Permission keys are no longer a fixed, enumerable set in source -- they're
// whatever rows exist in the `permissions` catalog table, which an admin can
// grow from Admin -> Roles & Permissions without a code change. `string` is
// the correct type for that: it's open-ended by design, not a gap.
export type PermissionKey = string;

// The one piece of this system that *is* a small, fixed taxonomy -- every
// permission node is exactly one of these nine levels. This never grows when
// a new module ships; only the catalog *data* does. Order here is display
// order (shallowest first), used by the Admin tree to indent/sort levels.
export const NODE_TYPES = [
  "MODULE",
  "PAGE",
  "SECTION",
  "TAB",
  "CARD",
  "POPUP",
  "FEATURE",
  "BUTTON",
  "BACKEND_ACTION",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  MODULE: "Module",
  PAGE: "Page",
  SECTION: "Section",
  TAB: "Tab",
  CARD: "Card",
  POPUP: "Popup",
  FEATURE: "Feature",
  BUTTON: "Button",
  BACKEND_ACTION: "Backend Action",
};

export function nodeTypeDepth(type: NodeType): number {
  return NODE_TYPES.indexOf(type);
}
