import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  ShieldAlert,
  ChevronRight,
  ChevronDown,
  Search,
  Plus,
  MoreHorizontal,
  Copy,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCan,
  usePermissionTree,
  useRolePermissions,
  useToggleRolePermission,
  useBulkSetRolePermissions,
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useCloneRole,
  type RoleRow,
  type PermissionNode,
} from "@/lib/rbac/use-rbac";
import { NODE_TYPE_LABELS, type NodeType } from "@/lib/rbac/roles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/roles")({
  component: RolesPage,
});

/* ---------------- tree helpers (pure, no React) ---------------- */

function buildChildrenMap(nodes: PermissionNode[]): Map<string | null, PermissionNode[]> {
  const map = new Map<string | null, PermissionNode[]>();
  for (const n of nodes) {
    const arr = map.get(n.parentId) ?? [];
    arr.push(n);
    map.set(n.parentId, arr);
  }
  for (const arr of map.values()) arr.sort((a, b) => a.displayOrder - b.displayOrder);
  return map;
}

/** This node's id plus every id beneath it, at every level (every node is its own grantable permission). */
function collectSubtreeIds(nodeId: string, childrenMap: Map<string | null, PermissionNode[]>): string[] {
  const out: string[] = [nodeId];
  for (const child of childrenMap.get(nodeId) ?? []) {
    out.push(...collectSubtreeIds(child.id, childrenMap));
  }
  return out;
}

function collectAllIds(childrenMap: Map<string | null, PermissionNode[]>): string[] {
  const out: string[] = [];
  for (const arr of childrenMap.values()) for (const n of arr) out.push(n.id);
  return out;
}

type TriState = "checked" | "unchecked" | "indeterminate";

function subtreeGrantCounts(
  nodeId: string,
  childrenMap: Map<string | null, PermissionNode[]>,
  granted: Set<string>,
): { grantedCount: number; total: number } {
  const ids = collectSubtreeIds(nodeId, childrenMap);
  return { grantedCount: ids.filter((id) => granted.has(id)).length, total: ids.length };
}

function triState(grantedCount: number, total: number): TriState {
  if (grantedCount === 0) return "unchecked";
  if (grantedCount === total) return "checked";
  return "indeterminate";
}

function matchesFilter(node: PermissionNode, term: string, category: string): boolean {
  if (category !== "all" && node.category !== category) return false;
  if (!term) return true;
  const haystack = `${node.label} ${node.key} ${node.description ?? ""}`.toLowerCase();
  return haystack.includes(term);
}

function ancestorChain(nodeId: string, byId: Map<string, PermissionNode>): string[] {
  const out: string[] = [];
  let cur = byId.get(nodeId)?.parentId ?? null;
  while (cur) {
    out.push(cur);
    cur = byId.get(cur)?.parentId ?? null;
  }
  return out;
}

/* ---------------- page ---------------- */

function RolesPage() {
  const canManage = useCan("roles.edit");
  const rolesQ = useRoles();
  const treeQ = usePermissionTree();
  const rolePerms = useRolePermissions();
  const toggle = useToggleRolePermission();
  const bulkSet = useBulkSetRolePermissions();

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleSearch, setRoleSearch] = useState("");
  const [permSearch, setPermSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleRow | null>(null);
  const [cloneRole, setCloneRoleFor] = useState<RoleRow | null>(null);
  const [deleteRole, setDeleteRoleFor] = useState<RoleRow | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const roles = rolesQ.data ?? [];
  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) setSelectedRoleId(roles[0].id);
  }, [roles, selectedRoleId]);

  const filteredRoles = useMemo(() => {
    const term = roleSearch.trim().toLowerCase();
    if (!term) return roles;
    return roles.filter(
      (r) => r.label.toLowerCase().includes(term) || r.key.toLowerCase().includes(term) || (r.description ?? "").toLowerCase().includes(term),
    );
  }, [roles, roleSearch]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;

  const nodes = treeQ.data ?? [];
  const childrenMap = useMemo(() => buildChildrenMap(nodes), [nodes]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const rootNodes = childrenMap.get(null) ?? [];
  const categories = useMemo(
    () => Array.from(new Set(nodes.map((n) => n.category).filter((c): c is string => !!c))).sort(),
    [nodes],
  );

  const granted = (selectedRole && rolePerms.data?.[selectedRole.id]) || new Set<string>();
  const isGrantsAll = !!selectedRole?.grantsAll;

  const term = permSearch.trim().toLowerCase();
  const searchActive = !!term || categoryFilter !== "all";
  const visibleIds = useMemo(() => {
    if (!searchActive) return null;
    const matched = nodes.filter((n) => matchesFilter(n, term, categoryFilter));
    const set = new Set<string>();
    for (const m of matched) {
      set.add(m.id);
      for (const a of ancestorChain(m.id, byId)) set.add(a);
      for (const d of collectSubtreeIds(m.id, childrenMap)) set.add(d);
    }
    return set;
  }, [searchActive, nodes, term, categoryFilter, byId, childrenMap]);

  const allIds = useMemo(() => collectAllIds(childrenMap), [childrenMap]);
  const overallGrantedCount = allIds.filter((id) => granted.has(id)).length;

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleNode(node: PermissionNode) {
    if (!canManage.allowed || isGrantsAll) return;
    const ids = collectSubtreeIds(node.id, childrenMap);
    const { grantedCount, total } = subtreeGrantCounts(node.id, childrenMap, granted);
    const nextEnabled = !(grantedCount === total);
    if (!selectedRole) return;
    if (ids.length === 1) {
      toggle.mutate(
        { roleId: selectedRole.id, permissionId: node.id, enabled: nextEnabled },
        { onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") },
      );
    } else {
      bulkSet.mutate(
        { roleId: selectedRole.id, permissionIds: ids, enabled: nextEnabled },
        { onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") },
      );
    }
  }

  function selectAll() {
    if (!selectedRole || !canManage.allowed) return;
    bulkSet.mutate(
      { roleId: selectedRole.id, permissionIds: allIds, enabled: true },
      { onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") },
    );
  }
  function deselectAll() {
    if (!selectedRole || !canManage.allowed) return;
    bulkSet.mutate(
      { roleId: selectedRole.id, permissionIds: allIds, enabled: false },
      { onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") },
    );
  }
  function expandAll() {
    setExpanded(new Set(nodes.filter((n) => (childrenMap.get(n.id) ?? []).length > 0).map((n) => n.id)));
  }
  function collapseAll() {
    setExpanded(new Set());
  }

  if (rolesQ.isLoading || treeQ.isLoading || rolePerms.isLoading) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      {/* -------- Role management -------- */}
      <aside className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={roleSearch}
              onChange={(e) => setRoleSearch(e.target.value)}
              placeholder="Search roles"
              className="h-9 w-full rounded-lg border border-input bg-card pl-8 pr-2 text-xs outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
          </div>
          {canManage.allowed && (
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
              aria-label="New Role"
            >
              <Plus className="h-3.5 w-3.5" /> New Role
            </button>
          )}
        </div>

        <div className="space-y-1">
          {filteredRoles.map((r) => (
            <div key={r.id} className="relative">
              <button
                onClick={() => setSelectedRoleId(r.id)}
                className={cn(
                  "w-full rounded-xl px-3 py-2.5 text-left transition",
                  r.id === selectedRoleId ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-accent",
                  !r.isActive && "opacity-50",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{r.label}</span>
                  {canManage.allowed && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === r.id ? null : r.id);
                      }}
                      className={cn(
                        "shrink-0 rounded-md p-1",
                        r.id === selectedRoleId ? "hover:bg-primary-foreground/20" : "hover:bg-accent",
                      )}
                      aria-label="Role actions"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    "mt-1 flex items-center gap-2 text-[10px]",
                    r.id === selectedRoleId ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  <span>{r.userCount} user{r.userCount === 1 ? "" : "s"}</span>
                  <span>&middot;</span>
                  <span>{r.grantsAll ? "All permissions" : `${r.permissionCount} permission${r.permissionCount === 1 ? "" : "s"}`}</span>
                  {!r.isActive && (
                    <>
                      <span>&middot;</span>
                      <span className="font-bold uppercase">Inactive</span>
                    </>
                  )}
                </div>
              </button>
              {openMenuId === r.id && (
                <div className="absolute right-2 top-full z-10 mt-1 w-40 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                  <button
                    onClick={() => {
                      setEditRole(r);
                      setOpenMenuId(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-accent"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => {
                      setCloneRoleFor(r);
                      setOpenMenuId(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-accent"
                  >
                    <Copy className="h-3.5 w-3.5" /> Clone
                  </button>
                  <button
                    onClick={() => {
                      setDeleteRoleFor(r);
                      setOpenMenuId(null);
                    }}
                    disabled={r.isSystem}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
          {filteredRoles.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">No roles match your search.</p>
          )}
        </div>
      </aside>

      {/* -------- Permission tree -------- */}
      <section>
        {!selectedRole ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Select a role to view its permissions.
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-bold">{selectedRole.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{selectedRole.description || "No description."}</p>
              {isGrantsAll && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary-soft/40 p-3 text-xs text-accent-foreground">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  This role grants every permission automatically &mdash; the tree below is informational.
                </div>
              )}
              {!canManage.allowed && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Read-only. You need <code>roles.edit</code> to change assignments.
                </p>
              )}
              <p className="mt-3 text-xs font-semibold text-muted-foreground">
                {isGrantsAll ? allIds.length : overallGrantedCount} of {allIds.length} permissions granted
              </p>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
              <div className="relative min-w-[180px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  placeholder="Search permissions"
                  className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-2 text-xs outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-primary"
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center gap-1.5">
                <button onClick={expandAll} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-bold hover:bg-accent">
                  Expand All
                </button>
                <button onClick={collapseAll} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-bold hover:bg-accent">
                  Collapse All
                </button>
                {canManage.allowed && !isGrantsAll && (
                  <>
                    <button onClick={selectAll} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-bold hover:bg-accent">
                      Select All
                    </button>
                    <button onClick={deselectAll} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-bold hover:bg-accent">
                      Deselect All
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-2">
              {rootNodes
                .filter((n) => !visibleIds || visibleIds.has(n.id))
                .map((n) => (
                  <TreeRow
                    key={n.id}
                    node={n}
                    depth={0}
                    childrenMap={childrenMap}
                    granted={granted}
                    expanded={expanded}
                    onToggleExpand={toggleExpand}
                    onToggleGrant={toggleNode}
                    canManage={canManage.allowed && !isGrantsAll}
                    visibleIds={visibleIds}
                    searchActive={searchActive}
                  />
                ))}
              {rootNodes.filter((n) => !visibleIds || visibleIds.has(n.id)).length === 0 && (
                <p className="p-6 text-center text-xs text-muted-foreground">No permissions match your search/filter.</p>
              )}
            </div>
          </>
        )}
      </section>

      {createOpen && <CreateRoleDialog onClose={() => setCreateOpen(false)} />}
      {editRole && <EditRoleDialog role={editRole} onClose={() => setEditRole(null)} />}
      {cloneRole && <CloneRoleDialog role={cloneRole} onClose={() => setCloneRoleFor(null)} />}
      {deleteRole && (
        <DeleteRoleDialog
          role={deleteRole}
          onClose={() => setDeleteRoleFor(null)}
          onDeleted={() => {
            if (selectedRoleId === deleteRole.id) setSelectedRoleId(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- tree row (recursive) ---------------- */

function TreeRow({
  node,
  depth,
  childrenMap,
  granted,
  expanded,
  onToggleExpand,
  onToggleGrant,
  canManage,
  visibleIds,
  searchActive,
}: {
  node: PermissionNode;
  depth: number;
  childrenMap: Map<string | null, PermissionNode[]>;
  granted: Set<string>;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleGrant: (node: PermissionNode) => void;
  canManage: boolean;
  visibleIds: Set<string> | null;
  searchActive: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const kids = (childrenMap.get(node.id) ?? []).filter((k) => !visibleIds || visibleIds.has(k.id));
  const hasKids = kids.length > 0;
  const isOpen = searchActive ? true : expanded.has(node.id);
  const { grantedCount, total } = subtreeGrantCounts(node.id, childrenMap, granted);
  const state = triState(grantedCount, total);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = state === "indeterminate";
  }, [state]);

  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/60"
        style={{ paddingLeft: depth * 20 + 8 }}
        title={node.description ?? undefined}
      >
        {hasKids ? (
          <button
            onClick={() => onToggleExpand(node.id)}
            className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent"
            aria-label={isOpen ? "Collapse" : "Expand"}
          >
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        <input
          ref={inputRef}
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-primary"
          checked={state === "checked"}
          disabled={!canManage}
          onChange={() => onToggleGrant(node)}
        />

        <span
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
            node.nodeType === "MODULE" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {NODE_TYPE_LABELS[node.nodeType as NodeType]}
        </span>

        <span className="min-w-0 flex-1 truncate text-sm font-medium">{node.label}</span>

        {hasKids && (
          <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
            {grantedCount}/{total}
          </span>
        )}
      </div>

      {hasKids && isOpen && (
        <div>
          {kids.map((k) => (
            <TreeRow
              key={k.id}
              node={k}
              depth={depth + 1}
              childrenMap={childrenMap}
              granted={granted}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onToggleGrant={onToggleGrant}
              canManage={canManage}
              visibleIds={visibleIds}
              searchActive={searchActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- shared dialog chrome ---------------- */

function DialogShell({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-base font-bold">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function DialogFooter({ onCancel, children }: { onCancel: () => void; children: React.ReactNode }) {
  return (
    <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
      <button onClick={onCancel} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-accent">
        Cancel
      </button>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
const inputCls =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15";

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/* ---------------- role dialogs ---------------- */

function CreateRoleDialog({ onClose }: { onClose: () => void }) {
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState("");
  const create = useCreateRole();

  const valid = label.trim() !== "" && key.trim() !== "";

  return (
    <DialogShell title="New Role" subtitle="Roles start with zero permissions granted." onClose={onClose}>
      <div className="grid gap-4 p-5">
        <Field label="Role Name">
          <input
            className={inputCls}
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              if (!keyTouched) setKey(slugify(e.target.value));
            }}
            placeholder="e.g. Warehouse Lead"
          />
        </Field>
        <Field label="Role Key">
          <input
            className={cn(inputCls, "font-mono")}
            value={key}
            onChange={(e) => {
              setKey(slugify(e.target.value));
              setKeyTouched(true);
            }}
            placeholder="e.g. warehouse_lead"
          />
        </Field>
        <Field label="Description">
          <textarea
            className={cn(inputCls, "h-20 py-2")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this role do?"
          />
        </Field>
        {create.isError && (
          <p className="text-xs text-destructive">{create.error instanceof Error ? create.error.message : "Failed to create role."}</p>
        )}
      </div>
      <DialogFooter onCancel={onClose}>
        <button
          onClick={() =>
            create.mutate(
              { key, label, description },
              { onSuccess: onClose, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") },
            )
          }
          disabled={!valid || create.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60"
        >
          {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create Role
        </button>
      </DialogFooter>
    </DialogShell>
  );
}

function EditRoleDialog({ role, onClose }: { role: RoleRow; onClose: () => void }) {
  const [label, setLabel] = useState(role.label);
  const [description, setDescription] = useState(role.description ?? "");
  const [isActive, setIsActive] = useState(role.isActive);
  const update = useUpdateRole();

  return (
    <DialogShell title="Edit Role" subtitle={role.key} onClose={onClose}>
      <div className="grid gap-4 p-5">
        <Field label="Role Name">
          <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="Description">
          <textarea className={cn(inputCls, "h-20 py-2")} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
          <span className="text-sm font-semibold">Role Status</span>
          <span className="flex items-center gap-2 text-xs font-bold">
            {isActive ? "Active" : "Inactive"}
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          </span>
        </label>
        {update.isError && (
          <p className="text-xs text-destructive">{update.error instanceof Error ? update.error.message : "Failed to update role."}</p>
        )}
      </div>
      <DialogFooter onCancel={onClose}>
        <button
          onClick={() =>
            update.mutate(
              { id: role.id, label, description, isActive },
              { onSuccess: onClose, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") },
            )
          }
          disabled={label.trim() === "" || update.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60"
        >
          {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Changes
        </button>
      </DialogFooter>
    </DialogShell>
  );
}

function CloneRoleDialog({ role, onClose }: { role: RoleRow; onClose: () => void }) {
  const [label, setLabel] = useState(`${role.label} Copy`);
  const [key, setKey] = useState(`${role.key}_copy`);
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState(role.description ?? "");
  const clone = useCloneRole();

  const valid = label.trim() !== "" && key.trim() !== "";

  return (
    <DialogShell title="Clone Role" subtitle={`Copies every permission from “${role.label}”`} onClose={onClose}>
      <div className="grid gap-4 p-5">
        <Field label="New Role Name">
          <input
            className={inputCls}
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              if (!keyTouched) setKey(slugify(e.target.value));
            }}
          />
        </Field>
        <Field label="New Role Key">
          <input
            className={cn(inputCls, "font-mono")}
            value={key}
            onChange={(e) => {
              setKey(slugify(e.target.value));
              setKeyTouched(true);
            }}
          />
        </Field>
        <Field label="Description">
          <textarea className={cn(inputCls, "h-20 py-2")} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {clone.isError && (
          <p className="text-xs text-destructive">{clone.error instanceof Error ? clone.error.message : "Failed to clone role."}</p>
        )}
      </div>
      <DialogFooter onCancel={onClose}>
        <button
          onClick={() =>
            clone.mutate(
              { sourceRoleId: role.id, key, label, description },
              { onSuccess: onClose, onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") },
            )
          }
          disabled={!valid || clone.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60"
        >
          {clone.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Clone Role
        </button>
      </DialogFooter>
    </DialogShell>
  );
}

function DeleteRoleDialog({ role, onClose, onDeleted }: { role: RoleRow; onClose: () => void; onDeleted: () => void }) {
  const del = useDeleteRole();
  return (
    <DialogShell title="Delete this role?" onClose={onClose}>
      <div className="px-5 py-4 text-sm text-muted-foreground">
        “{role.label}” will be permanently removed. This can't be undone.
        {role.userCount > 0 && (
          <p className="mt-2 font-semibold text-destructive">
            {role.userCount} user{role.userCount === 1 ? " is" : "s are"} still assigned to this role &mdash; deletion will be blocked until they're reassigned.
          </p>
        )}
      </div>
      <DialogFooter onCancel={onClose}>
        <button
          onClick={() =>
            del.mutate(role.id, {
              onSuccess: () => {
                onDeleted();
                onClose();
              },
              onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to delete role."),
            })
          }
          disabled={del.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground hover:opacity-90 disabled:opacity-60"
        >
          {del.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Delete
        </button>
      </DialogFooter>
    </DialogShell>
  );
}
