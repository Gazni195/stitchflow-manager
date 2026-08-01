import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { SettingsCard, SettingsGate } from "@/components/settings/shared";
import {
  useCreateReductionRule,
  useDeleteReductionRule,
  useReductionRules,
  useUpdateReductionRule,
  type ReductionRule,
  type ReductionRuleInput,
  type ReductionRuleStatus,
} from "@/lib/api/reduction-rules";

export const Route = createFileRoute("/settings/production/reduction-rules")({
  head: () => ({ meta: [{ title: "Consumption Reduction Rules — Fawri Lifestyle" }] }),
  component: () => (
    <SettingsGate permission="settings.edit">
      <RulesPage />
    </SettingsGate>
  ),
});

function RulesPage() {
  const { data: rules = [], isLoading, isFetching, refetch } = useReductionRules();
  const [editing, setEditing] = useState<ReductionRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [fabricFilter, setFabricFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"" | ReductionRuleStatus>("");
  const del = useDeleteReductionRule();
  const [confirmDelete, setConfirmDelete] = useState<ReductionRule | null>(null);

  const fabricOptions = useMemo(
    () => Array.from(new Set(rules.map((r) => r.fabricType))).sort(),
    [rules],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules
      .filter((r) => {
        if (fabricFilter && r.fabricType !== fabricFilter) return false;
        if (statusFilter && r.status !== statusFilter) return false;
        if (q && !r.name.toLowerCase().includes(q) && !r.fabricType.toLowerCase().includes(q))
          return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rules, search, fabricFilter, statusFilter]);

  return (
    <div className="grid gap-5">
      <SettingsCard title="">
        <div className="-mt-5">
          <Link
            to="/settings/production"
            className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>

          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Consumption Reduction Rules</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage rules used to calculate fabric consumption reduction during production.
              </p>
            </div>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> New Rule
            </button>
          </div>

          {/* Toolbar */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <label className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search rules..."
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm"
              />
            </label>
            <select
              value={fabricFilter}
              onChange={(e) => setFabricFilter(e.target.value)}
              className="min-w-[170px] rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold"
            >
              <option value="">All Fabric Types</option>
              {fabricOptions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | ReductionRuleStatus)}
              className="min-w-[140px] rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              onClick={() => refetch()}
              title="Refresh"
              className="rounded-xl border border-border bg-background p-2.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <RefreshCw className={"h-4 w-4 " + (isFetching ? "animate-spin" : "")} />
            </button>
          </div>

          {/* Table */}
          <div className="mt-5">
            {isLoading ? (
              <div className="grid place-items-center rounded-xl border border-border bg-card p-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : rules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
                <p className="text-sm font-semibold">No Consumption Reduction Rules found.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create your first rule to enable automatic production calculations.
                </p>
                <button
                  onClick={() => setCreating(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
                >
                  <Plus className="h-4 w-4" /> Create Rule
                </button>
              </div>
            ) : visible.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No rules match the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[800px] text-sm">
                  <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Rule Name</th>
                      <th className="px-4 py-3 text-left">Fabric Type</th>
                      <th className="px-4 py-3 text-left">Width Range</th>
                      <th className="px-4 py-3 text-left">Layer Length Range</th>
                      <th className="px-4 py-3 text-left">Reduction %</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visible.map((r) => (
                      <tr key={r.id} className="hover:bg-accent/30">
                        <td className="px-4 py-4 font-semibold">{r.name}</td>
                        <td className="px-4 py-4">{r.fabricType}</td>
                        <td className="px-4 py-4">
                          {fmt(r.widthMin)} - {fmt(r.widthMax)} cm
                        </td>
                        <td className="px-4 py-4">
                          {fmt(r.layerMin)} - {fmt(r.layerMax)} cm
                        </td>
                        <td className="px-4 py-4 font-semibold">{fmt(r.reductionPct)} %</td>
                        <td className="px-4 py-4">
                          <span
                            className={
                              "rounded-md px-2.5 py-1 text-xs font-semibold " +
                              (r.status === "active"
                                ? "bg-success/15 text-success"
                                : "bg-muted text-muted-foreground")
                            }
                          >
                            {r.status === "active" ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setEditing(r)}
                              title="Edit"
                              className="text-muted-foreground hover:text-primary"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(r)}
                              title="Delete"
                              className="text-destructive hover:opacity-70"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                  Showing {visible.length} of {rules.length} rules
                </div>
              </div>
            )}
          </div>
        </div>
      </SettingsCard>

      {(creating || editing) && (
        <RuleDialog
          rule={editing}
          allRules={rules}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this Consumption Reduction Rule?"
          message={`"${confirmDelete.name}" will be permanently removed.`}
          confirmLabel="Delete"
          busy={del.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            await del.mutateAsync(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      )}
    </div>
  );
}

/** Clean numeric display — no trailing decimals, no unit conversion. */
function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-bold">{title}</h3>
        </div>
        <div className="px-5 py-4 text-sm text-muted-foreground">{message}</div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function RuleDialog({
  rule,
  allRules,
  onClose,
}: {
  rule: ReductionRule | null;
  allRules: ReductionRule[];
  onClose: () => void;
}) {
  const create = useCreateReductionRule();
  const update = useUpdateReductionRule();
  const [form, setForm] = useState<ReductionRuleInput>({
    name: rule?.name ?? "",
    fabricType: rule?.fabricType ?? "",
    widthMin: rule?.widthMin ?? 0,
    widthMax: rule?.widthMax ?? 0,
    layerMin: rule?.layerMin ?? 0,
    layerMax: rule?.layerMax ?? 0,
    reductionPct: rule?.reductionPct ?? 0,
    status: rule?.status ?? "active",
  });
  const [error, setError] = useState<string | null>(null);

  const fabricOptions = useMemo(() => {
    const set = new Set(allRules.map((r) => r.fabricType).filter(Boolean));
    if (form.fabricType) set.add(form.fabricType);
    return Array.from(set).sort();
  }, [allRules, form.fabricType]);

  const valid =
    form.name.trim() !== "" &&
    form.fabricType.trim() !== "" &&
    form.widthMax >= form.widthMin &&
    form.widthMin > 0 &&
    form.layerMax >= form.layerMin &&
    form.layerMin > 0 &&
    form.reductionPct >= 0 &&
    form.reductionPct <= 100;

  // Overlap warning — inclusive range intersection on active rules of same fabric type.
  const overlap = useMemo(() => {
    const ft = form.fabricType.trim().toLowerCase();
    if (!ft) return null;
    return (
      allRules.find(
        (r) =>
          r.id !== rule?.id &&
          r.status === "active" &&
          r.fabricType.trim().toLowerCase() === ft &&
          form.widthMin <= r.widthMax &&
          form.widthMax >= r.widthMin &&
          form.layerMin <= r.layerMax &&
          form.layerMax >= r.layerMin,
      ) ?? null
    );
  }, [allRules, form, rule?.id]);

  async function submit() {
    setError(null);
    if (!valid) {
      setError("Please fix the highlighted fields.");
      return;
    }
    try {
      if (rule) await update.mutateAsync({ ...form, id: rule.id });
      else await create.mutateAsync(form);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save rule.");
    }
  }

  const busy = create.isPending || update.isPending;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/40 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6">
          <h3 className="text-lg font-bold">Add / Edit Rule</h3>
          <button
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-5 px-6 py-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Rule Name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="e.g. Muslin 95-100 / 110-120"
            />
            <label className="block">
              <span className="text-sm font-medium text-muted-foreground">Fabric Type</span>
              <input
                list="fabric-type-options"
                value={form.fabricType}
                onChange={(e) => setForm({ ...form, fabricType: e.target.value })}
                placeholder="e.g. Cotton, Muslin, Linen"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
              />
              <datalist id="fabric-type-options">
                {fabricOptions.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="grid gap-5 divide-border sm:grid-cols-3 sm:divide-x">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Width Range (cm)</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <NumField
                  label="Min Width"
                  value={form.widthMin}
                  onChange={(v) => setForm({ ...form, widthMin: v })}
                />
                <NumField
                  label="Max Width"
                  value={form.widthMax}
                  onChange={(v) => setForm({ ...form, widthMax: v })}
                />
              </div>
            </div>
            <div className="sm:pl-5">
              <p className="text-sm font-medium text-muted-foreground">Layer Length Range (cm)</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <NumField
                  label="Min Length"
                  value={form.layerMin}
                  onChange={(v) => setForm({ ...form, layerMin: v })}
                />
                <NumField
                  label="Max Length"
                  value={form.layerMax}
                  onChange={(v) => setForm({ ...form, layerMax: v })}
                />
              </div>
            </div>
            <div className="sm:pl-5">
              <p className="text-sm font-medium text-muted-foreground">Reduction Percentage (%)</p>
              <div className="mt-3">
                <NumField
                  label=""
                  value={form.reductionPct}
                  onChange={(v) => setForm({ ...form, reductionPct: v })}
                />
              </div>
            </div>
          </div>

          <label className="block sm:max-w-[240px]">
            <span className="text-sm font-medium text-muted-foreground">Status</span>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ReductionRuleStatus })}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          {overlap && (
            <p className="rounded-xl border border-warning/30 bg-warning/10 p-2.5 text-xs font-semibold text-warning-foreground">
              Overlaps with active rule "{overlap.name}" ({overlap.fabricType}, width{" "}
              {fmt(overlap.widthMin)}–{fmt(overlap.widthMax)} cm, layer {fmt(overlap.layerMin)}–
              {fmt(overlap.layerMax)} cm). Adjust the ranges to avoid conflicts.
            </p>
          )}

          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-2.5 text-xs font-semibold text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save Rule
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
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
    <label className="block">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
      />
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={
          "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm " +
          (label ? "mt-1.5" : "")
        }
      />
    </label>
  );
}
