import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Package, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  useMaterials,
  useUpsertMaterial,
  useDeleteMaterial,
  type Material,
  type MaterialStatus,
} from "@/lib/api/materials";

const UNIT_OPTIONS = ["Meter", "Pcs", "Yard", "Kg", "Set", "Roll"];

export const Route = createFileRoute("/inventory")({ component: InventoryPage });

function InventoryPage() {
  const { data: materials = [], isLoading } = useMaterials();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Material | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter(
      (m) => m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
    );
  }, [materials, query]);

  return (
    <AppShell
      title="Inventory"
      subtitle="Material Master · shared price list"
      action={
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New material
        </button>
      }
    >
      <div className="grid gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by code or name"
            className="w-full rounded-2xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>

        {isLoading ? (
          <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Package className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-bold">No materials yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create your first inventory item to start selecting materials in samples.
              </p>
            </div>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Add material
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3 text-left font-semibold">Code</th>
                  <th className="p-3 text-left font-semibold">Name</th>
                  <th className="p-3 text-left font-semibold">Unit</th>
                  <th className="p-3 text-right font-semibold">Stock</th>
                  <th className="p-3 text-right font-semibold">Cost / Unit</th>
                  <th className="p-3 text-left font-semibold">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="p-3 font-mono text-xs font-bold">{m.code}</td>
                    <td className="p-3 font-semibold">{m.name}</td>
                    <td className="p-3 text-muted-foreground">{m.unit}</td>
                    <td className="p-3 text-right tabular-nums">{m.availableStock}</td>
                    <td className="p-3 text-right tabular-nums">₹{m.costPerUnit.toFixed(2)}</td>
                    <td className="p-3">
                      <span
                        className={
                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold " +
                          (m.status === "active"
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground")
                        }
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setEditing(m)}
                        aria-label="Edit"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(creating || editing) && (
        <MaterialDialog
          material={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </AppShell>
  );
}

function MaterialDialog({ material, onClose }: { material: Material | null; onClose: () => void }) {
  const upsert = useUpsertMaterial();
  const del = useDeleteMaterial();
  const [form, setForm] = useState({
    code: material?.code ?? "",
    name: material?.name ?? "",
    unit: material?.unit ?? "Meter",
    availableStock: material?.availableStock ?? 0,
    costPerUnit: material?.costPerUnit ?? 0,
    status: (material?.status ?? "active") as MaterialStatus,
  });

  const valid = form.code.trim() !== "" && form.name.trim() !== "";

  async function save() {
    if (!valid) return;
    await upsert.mutateAsync({ ...form, id: material?.id });
    onClose();
  }
  async function remove() {
    if (!material) return;
    if (!confirm(`Delete ${material.name}? This cannot be undone.`)) return;
    await del.mutateAsync(material.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-foreground/40 p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{material ? "Edit material" : "New material"}</h2>
          <button onClick={onClose} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>
        <div className="grid gap-3">
          <Field label="Barcode / Material Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder="MAT-1001" />
          <Field label="Material Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Silk Chanderi" />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Unit</span>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as MaterialStatus })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Available Stock"
              value={form.availableStock}
              onChange={(v) => setForm({ ...form, availableStock: v })}
            />
            <NumberField
              label="Cost per Unit (₹)"
              value={form.costPerUnit}
              onChange={(v) => setForm({ ...form, costPerUnit: v })}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          {material && (
            <button
              onClick={remove}
              disabled={del.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-xs font-bold text-destructive hover:bg-destructive/5 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
          <button
            onClick={save}
            disabled={!valid || upsert.isPending}
            className="ml-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {material ? "Save changes" : "Create material"}
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
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
      />
    </label>
  );
}

function NumberField({
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
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        type="number"
        min={0}
        step={0.01}
        inputMode="decimal"
        value={value || ""}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        placeholder="0"
        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
      />
    </label>
  );
}
