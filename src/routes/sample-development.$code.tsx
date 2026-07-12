import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  FileCheck2,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { DesignImage } from "@/components/DesignImage";
import { useRequireAuth } from "@/hooks/use-auth";
import { useDesignByCode } from "@/lib/api/designs";
import { useWorkflows } from "@/lib/api/workflows";
import { supabase } from "@/integrations/supabase/client";
import type { Design } from "@/lib/designs";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/designs";

export const Route = createFileRoute("/sample-development/$code")({
  head: ({ params }) => ({
    meta: [{ title: `Sample · ${params.code} — Fawri Lifestyle` }],
  }),
  component: DesignSamplePage,
});

type TabId = "status" | "materials" | "costing" | "approval";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "status", label: "Sample Status", icon: Sparkles },
  { id: "materials", label: "Material Selection", icon: Layers },
  { id: "costing", label: "Costing", icon: Coins },
  { id: "approval", label: "Approval", icon: FileCheck2 },
];

function DesignSamplePage() {
  useRequireAuth();
  const { code } = Route.useParams();
  const { data: design, isLoading } = useDesignByCode(code);

  if (isLoading) {
    return (
      <AppShell title="Sample Development">
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!design) {
    return (
      <AppShell title="Design not found" subtitle={code}>
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No design with code <span className="font-semibold">{code}</span>.
          </p>
          <Link
            to="/designs"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to designs
          </Link>
        </div>
      </AppShell>
    );
  }

  // Remount the whole subtree per design so each panel's local state
  // (materials rows, costing, approvals, active tab) starts fresh instead
  // of carrying over stale data keyed by the previous design's part ids.
  return <DesignSample key={design.id} design={design} />;
}

function DesignSample({ design }: { design: Design }) {
  const [tab, setTab] = useState<TabId>("status");
  const { data: workflows, isLoading: wfLoading } = useWorkflows(design.id);
  const sample = workflows?.find((w) => w.kind === "sample");
  const bulk = workflows?.find((w) => w.kind === "bulk");
  const qc = useQueryClient();
  const creatingRef = useRef(false);

  // Auto-create a sample workflow when the design has none yet.
  useEffect(() => {
    if (wfLoading || !workflows) return;
    if (sample || bulk) return;
    if (creatingRef.current) return;
    creatingRef.current = true;
    (async () => {
      const { error } = await supabase
        .from("design_workflows")
        .insert({ design_id: design.id, kind: "sample", locked: false });
      if (!error) {
        qc.invalidateQueries({ queryKey: ["workflows", design.id] });
      }
      creatingRef.current = false;
    })();
  }, [wfLoading, workflows, sample, bulk, design.id, qc]);

  const stage: "In Development" | "Ready for Review" | "Approved" = bulk
    ? "Approved"
    : sample && sample.steps.length > 0 && sample.steps.every((s) => s.status === "completed" || s.status === "skipped")
      ? "Ready for Review"
      : "In Development";

  return (
    <AppShell
      title={`Sample · ${design.name}`}
      subtitle={`${design.code} · ${design.customer}`}
      action={
        <Link
          to="/designs/$code"
          params={{ code: design.code }}
          aria-label="Back to design"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2.5 sm:text-sm sm:font-semibold sm:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Design</span>
        </Link>
      }
    >
      <div className="grid gap-5">
        <Link
          to="/sample-development"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All samples
        </Link>

        {/* Mockup-style summary: image hero + facts + workflow progress dots */}
        <SampleHeader design={design} stage={stage} />

        {/* Tabs */}
        <section>
          <div className="flex gap-2 overflow-x-auto border-b border-border">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={
                    "inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition " +
                    (isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground")
                  }
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="pt-5">
            {tab === "status" && <StatusPanel design={design} stage={stage} />}
            {tab === "materials" && <MaterialsPanel />}
            {tab === "costing" && <CostingPanel design={design} />}
            {tab === "approval" && <ApprovalPanel design={design} />}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/* ---------- Status ---------- */

function StatusPanel({ design, stage }: { design: Design; stage: "In Development" | "Ready for Review" | "Approved" }) {
  const steps: { id: string; label: string; icon: LucideIcon }[] = [
    { id: "Requested", label: "Requested", icon: Sparkles },
    { id: "In Development", label: "In Development", icon: Clock },
    { id: "Ready for Review", label: "Ready for Review", icon: FileCheck2 },
    { id: "Approved", label: "Approved", icon: CheckCircle2 },
  ];
  const currentIdx = steps.findIndex((s) => s.id === stage);
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">Sample lifecycle</h3>
        <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">{stage}</span>
      </div>
      <ol className="mt-5 space-y-4">
        {steps.map((step, i) => {
          const done = i < currentIdx || stage === "Approved";
          const current = i === currentIdx && stage !== "Approved";
          const Icon = step.icon;
          return (
            <li key={step.id} className="flex items-start gap-3">
              <div
                className={
                  "grid h-9 w-9 shrink-0 place-items-center rounded-xl " +
                  (done
                    ? "bg-primary text-primary-foreground"
                    : current
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground")
                }
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{step.label}</p>
                <p className="text-xs text-muted-foreground">
                  {done ? "Completed" : current ? "In progress" : "Pending"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {design.notes && (
        <div className="mt-5 rounded-2xl border border-border bg-background p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Notes</p>
          <p className="mt-1 text-sm">{design.notes}</p>
        </div>
      )}
    </div>
  );
}

/* ---------- Materials (Phase 1: flexible Material Groups, manual entry) ---------- */
//
// Material Groups are independent of the design's garment parts — a design
// isn't limited to Top/Pant/Shawl, and a group isn't limited to matching a
// part name. Every row's fields (code/name/quantity/unit) mirror what an
// ERPNext stock item search would eventually return, and `source` is ready
// to flip from "manual" to "erpnext" per row — so a later inventory
// integration can autofill these same fields instead of manual typing,
// without changing this UI. No stock/lot lookup is implemented yet.

type MaterialSource = "manual" | "erpnext";

type MaterialRowState = {
  id: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  unit: string;
  source: MaterialSource;
  editing: boolean;
};

type MaterialGroupState = {
  id: string;
  name: string;
  expanded: boolean;
  rows: MaterialRowState[];
};

const DEFAULT_GROUP_NAMES = ["Top", "Pant", "Shawl"];
const SUGGESTED_GROUP_NAMES = ["Lining", "Lace", "Accessories"];
const UNIT_OPTIONS = ["Meter", "Pcs", "Yard", "Kg", "Set", "Roll"];

function newGroup(name: string, expanded = false): MaterialGroupState {
  return { id: crypto.randomUUID(), name, expanded, rows: [] };
}

function newRow(): MaterialRowState {
  return {
    id: crypto.randomUUID(),
    materialCode: "",
    materialName: "",
    quantity: 0,
    unit: "Meter",
    source: "manual",
    editing: true,
  };
}

function MaterialsPanel() {
  const [groups, setGroups] = useState<MaterialGroupState[]>(() =>
    DEFAULT_GROUP_NAMES.map((name, i) => newGroup(name, i === 0)),
  );
  const [customName, setCustomName] = useState("");

  function updateGroup(id: string, patch: Partial<MaterialGroupState>) {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }
  function removeGroup(id: string) {
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }
  function addGroup(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setGroups((prev) => {
      if (prev.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [...prev, newGroup(trimmed, true)];
    });
  }
  function addRow(groupId: string) {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, expanded: true, rows: [...g.rows, newRow()] } : g)),
    );
  }
  function updateRow(groupId: string, rowId: string, patch: Partial<MaterialRowState>) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, rows: g.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) } : g,
      ),
    );
  }
  function removeRow(groupId: string, rowId: string) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, rows: g.rows.filter((r) => r.id !== rowId) } : g)));
  }

  const existingNames = new Set(groups.map((g) => g.name.toLowerCase()));
  const suggestions = SUGGESTED_GROUP_NAMES.filter((n) => !existingNames.has(n.toLowerCase()));

  return (
    <div className="grid gap-2.5">
      {groups.map((group) => (
        <MaterialGroupCard
          key={group.id}
          group={group}
          onToggle={() => updateGroup(group.id, { expanded: !group.expanded })}
          onRemove={() => removeGroup(group.id)}
          onAddRow={() => addRow(group.id)}
          onUpdateRow={(rowId, patch) => updateRow(group.id, rowId, patch)}
          onRemoveRow={(rowId) => removeRow(group.id, rowId)}
        />
      ))}

      <div className="rounded-2xl border border-dashed border-border bg-card p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">+ Add Material Group</p>

        {suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((name) => (
              <button
                key={name}
                onClick={() => addGroup(name)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/40 hover:text-primary"
              >
                + {name}
              </button>
            ))}
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addGroup(customName);
                setCustomName("");
              }
            }}
            placeholder="Custom group e.g. Interlining, Embroidery, Dupatta Border"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => {
              addGroup(customName);
              setCustomName("");
            }}
            disabled={!customName.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>
    </div>
  );
}

function MaterialGroupCard({
  group,
  onToggle,
  onRemove,
  onAddRow,
  onUpdateRow,
  onRemoveRow,
}: {
  group: MaterialGroupState;
  onToggle: () => void;
  onRemove: () => void;
  onAddRow: () => void;
  onUpdateRow: (rowId: string, patch: Partial<MaterialRowState>) => void;
  onRemoveRow: (rowId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-1 pr-2">
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 p-3 text-left">
          <ChevronRight
            className={
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform " + (group.expanded ? "rotate-90" : "")
            }
          />
          <span className="truncate text-sm font-bold">{group.name}</span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {group.rows.length}
          </span>
        </button>
        <button
          onClick={onRemove}
          aria-label={`Remove ${group.name} group`}
          className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {group.expanded && (
        <div className="grid gap-2 border-t border-border p-3">
          {group.rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
              No materials added yet.
            </p>
          ) : (
            group.rows.map((row) => (
              <MaterialRowItem
                key={row.id}
                row={row}
                onChange={(patch) => onUpdateRow(row.id, patch)}
                onDelete={() => onRemoveRow(row.id)}
              />
            ))
          )}
          <button
            onClick={onAddRow}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-background py-2 text-xs font-semibold text-primary hover:bg-primary-soft/40"
          >
            <Plus className="h-3.5 w-3.5" /> Add Material Row
          </button>
        </div>
      )}
    </div>
  );
}

function MaterialRowItem({
  row,
  onChange,
  onDelete,
}: {
  row: MaterialRowState;
  onChange: (patch: Partial<MaterialRowState>) => void;
  onDelete: () => void;
}) {
  const valid = row.materialCode.trim() !== "" && row.materialName.trim() !== "" && row.quantity > 0;

  if (!row.editing) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{row.materialName}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {row.materialCode} · {row.quantity} {row.unit}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onChange({ editing: true })}
            aria-label="Edit material"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            aria-label="Delete material"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary-soft/30 p-2.5">
      <div className="grid grid-cols-2 gap-2">
        <CompactField
          label="Material Code"
          value={row.materialCode}
          placeholder="MAT-1001"
          onChange={(v) => onChange({ materialCode: v })}
        />
        <CompactField
          label="Material Name"
          value={row.materialName}
          placeholder="Silk Chanderi"
          onChange={(v) => onChange({ materialName: v })}
        />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Quantity</span>
          <input
            type="number"
            min={0}
            step={0.25}
            inputMode="decimal"
            value={row.quantity || ""}
            onChange={(e) => onChange({ quantity: Math.max(0, Number(e.target.value) || 0) })}
            placeholder="0.00"
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
          />
        </label>
        <label className="block min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Unit</span>
          <select
            value={row.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => onChange({ editing: false })}
          disabled={!valid}
          className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete material"
          className="shrink-0 rounded-xl border border-border bg-background px-3 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CompactField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
      />
    </label>
  );
}

/* ---------- Costing ---------- */

function CostingPanel({ design }: { design: Design }) {
  const [costs, setCosts] = useState<
    { id: string; label: string; category: "Material" | "Labor" | "Overhead" | "Other"; amount: number }[]
  >(() => [
    { id: "c1", label: "Material (est.)", category: "Material", amount: 0 },
    { id: "c2", label: "Stitching", category: "Labor", amount: 0 },
    { id: "c3", label: "Overheads", category: "Overhead", amount: 0 },
  ]);

  const perPiece = costs.reduce((s, c) => s + c.amount, 0);
  const orderTotal = perPiece * design.orderQuantity;
  const byCategory = costs.reduce<Record<string, number>>((acc, c) => {
    acc[c.category] = (acc[c.category] ?? 0) + c.amount;
    return acc;
  }, {});

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3 text-left font-semibold">Cost Item</th>
              <th className="p-3 text-left font-semibold">Category</th>
              <th className="p-3 text-right font-semibold">Amount (₹/pc)</th>
            </tr>
          </thead>
          <tbody>
            {costs.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3 font-semibold">{c.label}</td>
                <td className="p-3 text-muted-foreground">{c.category}</td>
                <td className="p-3 text-right">
                  <input
                    type="number"
                    min={0}
                    value={c.amount || ""}
                    onChange={(e) =>
                      setCosts((prev) =>
                        prev.map((x) =>
                          x.id === c.id ? { ...x, amount: Math.max(0, Number(e.target.value) || 0) } : x,
                        ),
                      )
                    }
                    className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-sm outline-none focus:border-primary"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-primary-soft">
              <td className="p-3 font-bold" colSpan={2}>
                Total per piece
              </td>
              <td className="p-3 text-right text-lg font-extrabold text-primary">₹{perPiece.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid gap-3">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary to-primary-glow p-5 text-primary-foreground shadow-md">
          <p className="text-[11px] font-bold uppercase tracking-widest opacity-85">Order total</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">₹{orderTotal.toLocaleString()}</p>
          <p className="mt-1 text-xs opacity-85">
            {design.orderQuantity} pcs × ₹{perPiece.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Breakdown</p>
          <ul className="mt-2 space-y-2 text-sm">
            {Object.entries(byCategory).map(([cat, amt]) => {
              const pct = perPiece > 0 ? Math.round((amt / perPiece) * 100) : 0;
              return (
                <li key={cat}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{cat}</span>
                    <span className="text-muted-foreground">
                      ₹{amt.toLocaleString()} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------- Approval ---------- */

type ApprovalRow = {
  id: string;
  role: string;
  name: string;
  status: "Pending" | "Approved" | "Rejected";
};

const APPROVAL_TONE: Record<ApprovalRow["status"], string> = {
  Pending: "bg-muted text-muted-foreground",
  Approved: "bg-success/15 text-success",
  Rejected: "bg-destructive/15 text-destructive",
};

function ApprovalPanel({ design }: { design: Design }) {
  const [approvals, setApprovals] = useState<ApprovalRow[]>(() => [
    { id: "a1", role: "Designer", name: "—", status: "Pending" },
    { id: "a2", role: "Merchandiser", name: "—", status: "Pending" },
    { id: "a3", role: "Production Head", name: "—", status: "Pending" },
    { id: "a4", role: "Customer", name: design.customer || "—", status: "Pending" },
  ]);

  const approved = approvals.filter((a) => a.status === "Approved").length;
  const total = approvals.length;
  const pct = Math.round((approved / total) * 100);

  function setStatus(id: string, status: ApprovalRow["status"]) {
    setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary-soft to-background p-5">
        <div className="flex items-center justify-between text-sm">
          <div>
            <p className="font-bold">Approval progress</p>
            <p className="text-xs text-muted-foreground">
              {approved} of {total} approvers signed off
            </p>
          </div>
          <p className="text-2xl font-extrabold text-primary">{pct}%</p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {approvals.map((a) => {
          const Icon = a.status === "Approved" ? CheckCircle2 : a.status === "Rejected" ? XCircle : Clock;
          return (
            <li key={a.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{a.role}</p>
                  <p className="mt-0.5 truncate text-base font-bold">{a.name}</p>
                </div>
                <span
                  className={
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold " +
                    APPROVAL_TONE[a.status]
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {a.status}
                </span>
              </div>
              {a.status === "Pending" && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setStatus(a.id, "Approved")}
                    className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setStatus(a.id, "Rejected")}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:border-destructive/40 hover:text-destructive"
                  >
                    Reject
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Shared ---------- */

function SampleHeader({
  design,
  stage,
}: {
  design: Design;
  stage: "In Development" | "Ready for Review" | "Approved";
}) {
  // Mock financial + designer facts for UI-first pass.
  const targetCostPerPc = 1250;
  const estMargin = "25%";
  const designer = "Rifa";
  const createdOn = new Date(design.createdAt).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // 7-step workflow dots (per mockup). Mark step 3 as current when In Development.
  const total = 7;
  const currentIdx = stage === "Approved" ? total : stage === "Ready for Review" ? 5 : 3;

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[16/10] w-full bg-primary-soft">
        <DesignImage path={design.imagePath} alt={design.name} />
        <span
          className={
            "absolute right-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold shadow-sm " +
            STATUS_TONE[design.status]
          }
        >
          {STATUS_LABEL[design.status]}
        </span>
      </div>

      <div className="grid gap-4 p-3 sm:p-5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold tracking-widest text-muted-foreground">{design.code}</p>
          <h2 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{design.name}</h2>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Fact label="Order Qty (Planned)" value={`${design.orderQuantity.toLocaleString()} Pcs`} />
          <Fact label="Category" value={design.category || "—"} />
          <Fact label="Target Cost (Per Pc)" value={`₹${targetCostPerPc.toLocaleString()}`} />
          <Fact label="Est. Margin" value={estMargin} />
          <Fact label="Created On" value={createdOn} />
          <Fact label="Designer" value={designer} />
        </div>

        <div className="min-w-0 rounded-2xl border border-border bg-background p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-bold">Workflow Progress</p>
            <p className="shrink-0 text-[11px] font-semibold text-muted-foreground">
              Step {Math.min(currentIdx, total)} of {total}
            </p>
          </div>
          <ol className="mt-3 flex items-center gap-1 sm:gap-1.5">
            {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
              const done = n < currentIdx;
              const current = n === currentIdx;
              return (
                <li key={n} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5">
                  <span
                    className={
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-bold transition sm:h-8 sm:w-8 sm:text-[11px] " +
                      (done
                        ? "bg-primary text-primary-foreground"
                        : current
                          ? "bg-primary text-primary-foreground ring-2 ring-primary/20 sm:ring-4"
                          : "bg-muted text-muted-foreground")
                    }
                  >
                    {done ? "✓" : n}
                  </span>
                  {n < total && (
                    <span
                      className={"h-0.5 min-w-0 flex-1 rounded-full " + (n < currentIdx ? "bg-primary" : "bg-muted")}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <Link
          to="/designs/$code/workflow"
          params={{ code: design.code }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
        >
          View Workflow
        </Link>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}
