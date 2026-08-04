import type { NodeType } from "./roles";
import { PERMISSION_REGISTRY, type PermissionSpec } from "./permission-registry";

/**
 * Pure (no React, no network) flattening + diffing of the permission registry.
 * Shared by the server function that performs the sync and by the Admin UI
 * that previews it, so both agree on exactly what a sync would do.
 */

export interface FlatPermission {
  key: string;
  parentKey: string | null;
  nodeType: NodeType;
  module: string;
  page: string | null;
  section: string | null;
  tab: string | null;
  card: string | null;
  popup: string | null;
  feature: string | null;
  button: string | null;
  label: string;
  description: string | null;
  displayOrder: number;
  category: string | null;
  requiresBackend: boolean;
  linkedBackendRef: string | null;
  /** Depth in the tree — insert order guarantees parents exist first. */
  depth: number;
}

type Coords = Pick<FlatPermission, "page" | "section" | "tab" | "card" | "popup" | "feature" | "button">;

const EMPTY_COORDS: Coords = {
  page: null,
  section: null,
  tab: null,
  card: null,
  popup: null,
  feature: null,
  button: null,
};

function resolveKey(spec: PermissionSpec, parentKey: string | null): string {
  if (spec.key) return spec.key;
  if (!spec.segment) {
    throw new Error(`Permission spec "${spec.label}" needs either a segment or an absolute key.`);
  }
  return parentKey ? `${parentKey}.${spec.segment}` : spec.segment;
}

/**
 * Turns the nested registry into the flat row shape the `permissions` table
 * stores. Keys are derived from nesting; UI coordinates (page/tab/card/...)
 * cascade down from ancestors unless a node overrides them.
 */
export function flattenRegistry(registry: PermissionSpec[] = PERMISSION_REGISTRY): FlatPermission[] {
  const out: FlatPermission[] = [];

  const walk = (
    specs: PermissionSpec[],
    parentKey: string | null,
    moduleKey: string | null,
    inherited: Coords,
    depth: number,
  ) => {
    specs.forEach((spec, index) => {
      const key = resolveKey(spec, parentKey);
      const module = moduleKey ?? key;
      const coords: Coords = {
        page: spec.page ?? inherited.page,
        section: spec.section ?? inherited.section,
        tab: spec.tab ?? inherited.tab,
        card: spec.card ?? inherited.card,
        popup: spec.popup ?? inherited.popup,
        feature: spec.feature ?? inherited.feature,
        button: spec.button ?? inherited.button,
      };

      out.push({
        key,
        parentKey,
        nodeType: spec.type,
        module,
        ...coords,
        label: spec.label,
        description: spec.description ?? null,
        displayOrder: spec.order ?? index + 1,
        category: spec.category ?? null,
        requiresBackend: spec.requiresBackend ?? false,
        linkedBackendRef: spec.backendRef ?? null,
        depth,
      });

      if (spec.children?.length) {
        walk(spec.children, key, module, coords, depth + 1);
      }
    });
  };

  walk(registry, null, null, EMPTY_COORDS, 0);

  const seen = new Set<string>();
  for (const row of out) {
    if (seen.has(row.key)) throw new Error(`Duplicate permission key in registry: "${row.key}"`);
    seen.add(row.key);
  }
  return out;
}

/** Row shape as it comes back from the database (snake_case columns). */
export interface ExistingPermissionRow {
  id: string;
  key: string;
  parent_id: string | null;
  node_type: string;
  module: string;
  page: string | null;
  section: string | null;
  tab: string | null;
  card: string | null;
  popup: string | null;
  feature: string | null;
  button: string | null;
  label: string;
  description: string | null;
  display_order: number;
  category: string | null;
  requires_backend: boolean;
  linked_backend_ref: string | null;
  is_active: boolean;
}

export interface SyncPlan {
  /** Registry nodes with no row in the table yet. */
  missing: FlatPermission[];
  /** Registry nodes whose stored metadata no longer matches the declaration. */
  drifted: { key: string; changes: string[] }[];
  /** Rows in the table that the registry no longer declares (never deleted). */
  orphans: string[];
  unchanged: number;
}

const COMPARED: { column: keyof ExistingPermissionRow; field: keyof FlatPermission }[] = [
  { column: "node_type", field: "nodeType" },
  { column: "module", field: "module" },
  { column: "page", field: "page" },
  { column: "section", field: "section" },
  { column: "tab", field: "tab" },
  { column: "card", field: "card" },
  { column: "popup", field: "popup" },
  { column: "feature", field: "feature" },
  { column: "button", field: "button" },
  { column: "label", field: "label" },
  { column: "description", field: "description" },
  { column: "display_order", field: "displayOrder" },
  { column: "category", field: "category" },
  { column: "requires_backend", field: "requiresBackend" },
  { column: "linked_backend_ref", field: "linkedBackendRef" },
];

/** Compares the flattened registry with the current table contents. */
export function buildSyncPlan(desired: FlatPermission[], existing: ExistingPermissionRow[]): SyncPlan {
  const byKey = new Map(existing.map((row) => [row.key, row]));
  const declared = new Set(desired.map((d) => d.key));

  const missing: FlatPermission[] = [];
  const drifted: { key: string; changes: string[] }[] = [];
  let unchanged = 0;

  for (const node of desired) {
    const row = byKey.get(node.key);
    if (!row) {
      missing.push(node);
      continue;
    }
    const changes: string[] = [];
    for (const { column, field } of COMPARED) {
      const current = row[column] ?? null;
      const next = (node[field] as unknown) ?? null;
      if (current !== next) changes.push(column);
    }
    if (!row.is_active) changes.push("is_active");
    if (changes.length) drifted.push({ key: node.key, changes });
    else unchanged += 1;
  }

  const orphans = existing.filter((row) => !declared.has(row.key)).map((row) => row.key);

  return { missing, drifted, orphans, unchanged };
}

export interface SyncResult {
  inserted: string[];
  updated: string[];
  unchanged: number;
  orphans: string[];
}
