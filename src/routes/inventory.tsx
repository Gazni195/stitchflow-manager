import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Package,
  Loader2,
  Settings,
  Layers,
  X,
  Image as ImageIcon,
  Camera,
  Upload,
  ArrowLeft,
  Check,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  useMaterials,
  useCreateMaterial,
  useUpdateMaterial,
  useDeleteMaterial,
  useMaterialCodeSettings,
  useUpdateMaterialCodeSettings,
  useMaterialBundles,
  useUpsertBundle,
  useDeleteBundle,
  useMaterialImageUrl,
  uploadMaterialImage,
  type Material,
  type MaterialBundle,
  type MaterialStatus,
} from "@/lib/api/materials";
import { useReductionRules } from "@/lib/api/reduction-rules";

const UNIT_OPTIONS = ["Meter", "Yard", "Kg", "Pcs", "Set", "Roll"];
const COLOR_OPTIONS = ["Black", "White", "Ivory", "Beige", "Red", "Blue", "Green", "Yellow", "Pink", "Grey", "Multi"];

export const Route = createFileRoute("/inventory")({ component: InventoryPage });

function pad(n: number) {
  return String(n).padStart(4, "0");
}

function InventoryPage() {
  const { data: materials = [], isLoading } = useMaterials();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Material | null>(null);
  const [creating, setCreating] = useState(false);
  const [bundlesFor, setBundlesFor] = useState<Material | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter(
      (m) =>
        m.code.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        (m.color ?? "").toLowerCase().includes(q),
    );
  }, [materials, query]);

  return (
    <AppShell
      title="Inventory"
      subtitle="Fabric rolls · bundle-based stock"
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
            placeholder="Search by code, name, or color"
            className="w-full rounded-2xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>

        {isLoading ? (
          <div className="grid place-items-center rounded-2xl border border-border bg-card p-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Package className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-bold">No materials available</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create your first material, then add fabric rolls (bundles) to build up stock.
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
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3 text-left font-semibold">Fabric</th>
                  <th className="p-3 text-left font-semibold">Code</th>
                  <th className="p-3 text-left font-semibold">Name</th>
                  <th className="p-3 text-left font-semibold">Color</th>
                  <th className="p-3 text-right font-semibold">Bundles</th>
                  <th className="p-3 text-right font-semibold">Purchased</th>
                  <th className="p-3 text-right font-semibold">Available</th>
                  <th className="p-3 text-left font-semibold">Unit</th>
                  <th className="p-3 text-right font-semibold">Cost</th>
                  <th className="p-3 text-left font-semibold">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => setBundlesFor(m)}
                    className="cursor-pointer border-t border-border hover:bg-accent/40"
                  >
                    <td className="p-3">
                      <MaterialThumb path={m.imagePath} className="h-10 w-10" />
                    </td>
                    <td className="p-3 font-mono text-xs font-bold">{m.code}</td>
                    <td className="p-3 font-semibold">{m.name}</td>
                    <td className="p-3 text-muted-foreground">{m.color ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{m.bundleCount ?? 0}</td>
                    <td className="p-3 text-right tabular-nums">{m.totalPurchased ?? 0}</td>
                    <td className="p-3 text-right tabular-nums font-semibold">{m.availableStock}</td>
                    <td className="p-3 text-muted-foreground">{m.unit}</td>
                    <td className="p-3 text-right tabular-nums">₹{m.costPerUnit.toFixed(2)}</td>

                    <td className="p-3">
                      <span
                        className={
                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold " +
                          (m.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")
                        }
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(m);
                        }}
                        aria-label="Edit material"
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

      {creating && <NewMaterialWizard onClose={() => setCreating(false)} />}
      {editing && <EditMaterialDialog material={editing} onClose={() => setEditing(null)} />}
      {bundlesFor && <BundlesDialog material={bundlesFor} onClose={() => setBundlesFor(null)} />}
    </AppShell>
  );
}

/* ---------- New Material Wizard (Step 1 → Step 2) ---------- */

type DraftBundle = {
  key: string;
  fabricWidth: string;
  purchasedLength: number;
  layerLength: number;
};

function newDraftBundle(): DraftBundle {
  return { key: crypto.randomUUID(), fabricWidth: "", purchasedLength: 0, layerLength: 0 };
}

function NewMaterialWizard({ onClose }: { onClose: () => void }) {
  const create = useCreateMaterial();
  const qc = useQueryClient();
  const { data: settings } = useMaterialCodeSettings();
  const { data: rules = [] } = useReductionRules();
  const [step, setStep] = useState<1 | 2>(1);
  const [showSettings, setShowSettings] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    color: "",
    customColor: "",
    consumptionRuleId: "",
    unit: "Meter",
    costPerUnit: 0,
    status: "active" as MaterialStatus,
  });

  const [bundles, setBundles] = useState<DraftBundle[]>(() => [newDraftBundle()]);

  const previewCode = settings ? `${settings.prefix}-${pad(settings.nextNumber)}` : "…";
  const color = form.color === "__custom__" ? form.customColor : form.color;
  const step1Valid = form.name.trim() !== "";
  const bundlesValid = bundles.every((b) => b.fabricWidth.trim() !== "" && b.purchasedLength > 0 && b.layerLength > 0);

  function updateBundle(key: string, patch: Partial<DraftBundle>) {
    setBundles((list) => list.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  }
  function removeBundle(key: string) {
    setBundles((list) => (list.length <= 1 ? list : list.filter((b) => b.key !== key)));
  }

  async function saveAll() {
    if (!step1Valid || !bundlesValid) return;
    setBusy(true);
    setError(null);
    try {
      const imagePath = file ? await uploadMaterialImage(file) : null;
      const created = await create.mutateAsync({
        name: form.name,
        color: color || null,
        consumptionRuleId: form.consumptionRuleId || null,
        unit: form.unit,
        costPerUnit: form.costPerUnit,
        status: form.status,
        imagePath,
      });

      const rows = bundles.map((b) => ({
        material_id: created.id,
        bundle_number: 0,
        fabric_width: b.fabricWidth.trim(),
        purchased_length: b.purchasedLength,
        layer_length: b.layerLength,
      }));
      const { error: insErr } = await supabase.from("inventory_bundles").insert(rows);
      if (insErr) throw insErr;
      await qc.invalidateQueries({ queryKey: ["materials"] });
      await qc.invalidateQueries({ queryKey: ["material-bundles", created.id] });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogShell
      title={
        <div className="flex items-center gap-3">
          <span>New material</span>
          <StepIndicator step={step} />
        </div>
      }
      onClose={onClose}
      widthClass="max-w-lg"
    >
      {step === 1 ? (
        <div className="grid gap-3">
          <ImageField path={null} file={file} onFile={setFile} />

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Material Code (auto)
            </span>
            <div className="mt-1 flex items-center gap-2">
              <input
                readOnly
                value={previewCode}
                className="flex-1 rounded-xl border border-border bg-muted/60 px-3 py-2 font-mono text-sm font-bold text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                aria-label="Code settings"
                className="rounded-xl border border-border bg-background p-2 text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </label>
          <Field
            label="Material Name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            placeholder="Silk Chanderi"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Color</span>
              <select
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              >
                <option value="">—</option>
                {COLOR_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__custom__">Custom…</option>
              </select>
            </label>
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
          </div>
          {form.color === "__custom__" && (
            <Field
              label="Custom color"
              value={form.customColor}
              onChange={(v) => setForm({ ...form, customColor: v })}
              placeholder="e.g. Emerald"
            />
          )}
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Consumption Rule
            </span>
            <select
              value={form.consumptionRuleId}
              onChange={(e) => setForm({ ...form, consumptionRuleId: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            >
              <option value="">— None —</option>
              {rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.reductionPct}%)
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Applied automatically during Production. Manage rules in Settings → Production → Reduction Rules.
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Cost per Unit (₹)"
              value={form.costPerUnit}
              onChange={(v) => setForm({ ...form, costPerUnit: v })}
            />
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
          <p className="text-[11px] text-muted-foreground">
            Next: enter fabric bundles. Nothing is saved until you tap “Save material”.
          </p>

          <div className="sticky bottom-0 -mx-5 mt-2 flex items-center justify-between gap-2 border-t border-border bg-card/95 px-5 pb-1 pt-3 backdrop-blur">
            <button
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              onClick={() => step1Valid && setStep(2)}
              disabled={!step1Valid}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              Continue to bundles
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs">
            <div className="font-mono font-bold text-foreground">{previewCode}</div>
            <div className="mt-0.5 text-muted-foreground">
              {form.name || "Untitled"} {color ? `· ${color}` : ""} · {form.unit}
            </div>
          </div>

          <div className="grid gap-2">
            {bundles.map((b, idx) => (
              <div key={b.key} className="rounded-xl border border-border bg-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-bold">Bundle {idx + 1}</span>
                  </div>
                  {bundles.length > 1 && (
                    <button
                      onClick={() => removeBundle(b.key)}
                      aria-label="Remove bundle"
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label={`Purchased (${form.unit})`}
                    value={b.purchasedLength}
                    onChange={(v) => updateBundle(b.key, { purchasedLength: v })}
                  />
                  <NumberField
                    label="Layer Length (cm)"
                    value={b.layerLength}
                    onChange={(v) => updateBundle(b.key, { layerLength: v })}
                  />
                </div>
                <div className="mt-2">
                  <Field
                    label="Fabric Width"
                    value={b.fabricWidth}
                    onChange={(v) => updateBundle(b.key, { fabricWidth: v })}
                    placeholder="e.g. 44 inch"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setBundles((l) => [...l, newDraftBundle()])}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> Add bundle
          </button>

          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-2 text-xs font-semibold text-destructive">
              {error}
            </p>
          )}

          <div className="sticky bottom-0 -mx-5 mt-2 flex items-center justify-between gap-2 border-t border-border bg-card/95 px-5 pb-1 pt-3 backdrop-blur">
            <button
              onClick={() => setStep(1)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-accent disabled:opacity-60"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              onClick={saveAll}
              disabled={!step1Valid || !bundlesValid || busy}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save material
            </button>
          </div>
        </div>
      )}

      {showSettings && <CodeSettingsDialog onClose={() => setShowSettings(false)} />}
    </DialogShell>
  );
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide">
      <span
        className={
          "flex items-center gap-1 rounded-full px-2 py-0.5 " +
          (step === 1 ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary")
        }
      >
        {step > 1 ? <Check className="h-3 w-3" /> : <span>1</span>} Material
      </span>
      <span className="h-px w-4 bg-border" />
      <span
        className={
          "rounded-full px-2 py-0.5 " +
          (step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")
        }
      >
        2 Bundles
      </span>
    </div>
  );
}

/* ---------- Edit Material ---------- */

function EditMaterialDialog({ material, onClose }: { material: Material; onClose: () => void }) {
  const update = useUpdateMaterial();
  const del = useDeleteMaterial();
  const { data: rules = [] } = useReductionRules();
  const inPreset = material.color && COLOR_OPTIONS.includes(material.color);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: material.name,
    color: inPreset ? (material.color as string) : material.color ? "__custom__" : "",
    customColor: inPreset ? "" : (material.color ?? ""),
    consumptionRuleId: material.consumptionRuleId ?? "",
    unit: material.unit,
    costPerUnit: material.costPerUnit,
    status: material.status,
  });
  const color = form.color === "__custom__" ? form.customColor : form.color;
  const valid = form.name.trim() !== "";

  async function save() {
    if (!valid) return;
    setBusy(true);
    try {
      const imagePath = file ? await uploadMaterialImage(file) : undefined;
      await update.mutateAsync({
        id: material.id,
        name: form.name,
        color: color || null,
        consumptionRuleId: form.consumptionRuleId || null,
        unit: form.unit,
        costPerUnit: form.costPerUnit,
        status: form.status,
        imagePath,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm(`Delete ${material.name}? All bundles will be removed. This cannot be undone.`)) return;
    await del.mutateAsync(material.id);
    onClose();
  }

  return (
    <DialogShell title="Edit material" onClose={onClose}>
      <div className="grid gap-3">
        <ImageField path={material.imagePath} file={file} onFile={setFile} />

        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Material Code</span>
          <input
            readOnly
            value={material.code}
            className="mt-1 w-full rounded-xl border border-border bg-muted/60 px-3 py-2 font-mono text-sm font-bold text-muted-foreground"
          />
        </label>
        <Field label="Material Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Color</span>
            <select
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            >
              <option value="">—</option>
              {COLOR_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="__custom__">Custom…</option>
            </select>
          </label>
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
        </div>
        {form.color === "__custom__" && (
          <Field label="Custom color" value={form.customColor} onChange={(v) => setForm({ ...form, customColor: v })} />
        )}
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Consumption Rule</span>
          <select
            value={form.consumptionRuleId}
            onChange={(e) => setForm({ ...form, consumptionRuleId: e.target.value })}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
          >
            <option value="">— None —</option>
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.reductionPct}%)
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Applied automatically during Production. Manage rules in Settings → Production → Reduction Rules.
          </span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Cost per Unit (₹)"
            value={form.costPerUnit}
            onChange={(v) => setForm({ ...form, costPerUnit: v })}
          />
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
      </div>

      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={remove}
          disabled={del.isPending}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-xs font-bold text-destructive hover:bg-destructive/5 disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
        <button
          onClick={save}
          disabled={!valid || update.isPending}
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60"
        >
          {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </button>
      </div>
    </DialogShell>
  );
}

/* ---------- Code Settings ---------- */

function CodeSettingsDialog({ onClose }: { onClose: () => void }) {
  const { data: settings } = useMaterialCodeSettings();
  const save = useUpdateMaterialCodeSettings();
  const [prefix, setPrefix] = useState(settings?.prefix ?? "FAB");
  const [nextNumber, setNextNumber] = useState(settings?.nextNumber ?? 1);

  const previews = [0, 1, 2].map((i) => `${prefix}-${pad(nextNumber + i)}`);

  async function submit() {
    await save.mutateAsync({ prefix: prefix.trim() || "FAB", nextNumber: Math.max(0, Math.floor(nextNumber)) });
    onClose();
  }

  return (
    <DialogShell title="Material Code Settings" onClose={onClose} widthClass="max-w-sm">
      <div className="grid gap-3">
        <Field label="Prefix" value={prefix} onChange={setPrefix} placeholder="FAB" />
        <NumberField label="Next Number" value={nextNumber} onChange={(v) => setNextNumber(Math.floor(v))} />
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Live preview</p>
          <div className="grid gap-0.5 font-mono text-sm font-bold">
            {previews.map((p) => (
              <div key={p}>{p}</div>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Existing material codes are never changed. This only affects the next code created.
        </p>
      </div>
      <div className="mt-5 flex justify-end">
        <button
          onClick={submit}
          disabled={save.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60"
        >
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </button>
      </div>
    </DialogShell>
  );
}

/* ---------- Bundles ---------- */

function BundlesDialog({ material, onClose }: { material: Material; onClose: () => void }) {
  const { data: bundles = [], isLoading } = useMaterialBundles(material.id);
  const [editing, setEditing] = useState<{ bundle: MaterialBundle; index: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const del = useDeleteBundle(material.id);

  const totalPurchased = bundles.reduce((s, b) => s + b.purchasedLength, 0);

  async function remove(b: MaterialBundle, idx: number) {
    if (!confirm(`Delete Bundle ${idx + 1}? This cannot be undone.`)) return;
    await del.mutateAsync(b.id);
  }

  return (
    <DialogShell
      title={
        <span className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm font-bold">{material.code}</span>
          <span className="text-sm font-semibold text-muted-foreground">· {material.name}</span>
        </span>
      }
      onClose={onClose}
      widthClass="max-w-2xl"
    >
      <div className="mb-3 grid grid-cols-2 gap-2 text-center">
        <Stat label="Total Bundles" value={String(bundles.length)} />
        <Stat label="Total Purchased" value={`${totalPurchased} ${material.unit}`} />
      </div>

      <div className="mb-3 flex justify-end">
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add bundle
        </button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center rounded-xl border border-border bg-card p-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : bundles.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Layers className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">No bundles yet. Add the first fabric roll.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="bg-muted/60 uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-2 text-left font-semibold">Bundle</th>
                <th className="p-2 text-right font-semibold">Purchased</th>
                <th className="p-2 text-right font-semibold">Layer (cm)</th>
                <th className="p-2 text-left font-semibold">Width</th>
                <th className="p-2 text-left font-semibold">Status</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {bundles.map((b, idx) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="p-2 font-bold">Bundle {idx + 1}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{b.purchasedLength}</td>
                  <td className="p-2 text-right tabular-nums">{b.layerLength}</td>
                  <td className="p-2">{b.fabricWidth}</td>
                  <td className="p-2">
                    <BundleStatusBadge status={b.status} />
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing({ bundle: b, index: idx })}
                        aria-label="Edit"
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-primary"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => remove(b, idx)}
                        aria-label="Delete"
                        disabled={b.allocatedLength > 0}
                        title={b.allocatedLength > 0 ? "Bundle is reserved or consumed" : "Delete"}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <BundleFormDialog
          materialId={material.id}
          unit={material.unit}
          bundle={editing?.bundle ?? null}
          displayIndex={editing ? editing.index : bundles.length}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </DialogShell>
  );
}

function BundleFormDialog({
  materialId,
  unit,
  bundle,
  displayIndex,
  onClose,
}: {
  materialId: string;
  unit: string;
  bundle: MaterialBundle | null;
  displayIndex: number;
  onClose: () => void;
}) {
  const save = useUpsertBundle(materialId);
  const [form, setForm] = useState({
    fabricWidth: bundle?.fabricWidth ?? "",
    purchasedLength: bundle?.purchasedLength ?? 0,
    layerLength: bundle?.layerLength ?? 0,
  });

  const valid = form.fabricWidth.trim() !== "" && form.purchasedLength > 0 && form.layerLength > 0;

  async function submit() {
    if (!valid) return;
    await save.mutateAsync({
      id: bundle?.id,
      fabricWidth: form.fabricWidth,
      purchasedLength: form.purchasedLength,
      layerLength: form.layerLength,
    });
    onClose();
  }

  const label = `Bundle ${displayIndex + 1}`;

  return (
    <DialogShell title={bundle ? `Edit ${label}` : `Add ${label}`} onClose={onClose} widthClass="max-w-sm">
      <div className="grid gap-3">
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Bundle</span>
          <input
            readOnly
            value={label}
            className="mt-1 w-full rounded-xl border border-border bg-muted/60 px-3 py-2 text-sm font-bold text-muted-foreground"
          />
        </label>
        <NumberField
          label={`Purchased Quantity (${unit})`}
          value={form.purchasedLength}
          onChange={(v) => setForm({ ...form, purchasedLength: v })}
        />
        <NumberField
          label="Layer Length (cm)"
          value={form.layerLength}
          onChange={(v) => setForm({ ...form, layerLength: v })}
        />
        <Field
          label="Fabric Width"
          value={form.fabricWidth}
          onChange={(v) => setForm({ ...form, fabricWidth: v })}
          placeholder="e.g. 44 inch"
        />
        {bundle && (
          <p className="text-[11px] text-muted-foreground">
            Status is set automatically ({bundle.status}) as production reserves and consumes this bundle.
          </p>
        )}
      </div>
      <div className="mt-5 flex justify-end">
        <button
          onClick={submit}
          disabled={!valid || save.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60"
        >
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {bundle ? "Save" : "Add bundle"}
        </button>
      </div>
    </DialogShell>
  );
}

const BUNDLE_STATUS_STYLE: Record<string, string> = {
  available: "bg-success/15 text-success",
  reserved: "bg-warning/15 text-warning",
  consumed: "bg-muted text-muted-foreground",
};

function BundleStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
        (BUNDLE_STATUS_STYLE[status] ?? "bg-muted text-muted-foreground")
      }
    >
      {status}
    </span>
  );
}

/* ---------- Fabric image ---------- */

function MaterialThumb({ path, className = "" }: { path: string | null; className?: string }) {
  const { data: url } = useMaterialImageUrl(path);
  if (!path || !url) {
    return (
      <div className={`grid place-items-center rounded-lg bg-muted text-muted-foreground ${className}`}>
        <ImageIcon className="h-4 w-4" />
      </div>
    );
  }
  return <img src={url} alt="Fabric" loading="lazy" className={`rounded-lg object-cover ${className}`} />;
}

function ImageField({
  path,
  file,
  onFile,
}: {
  path: string | null;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const preview = file ? URL.createObjectURL(file) : null;
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Fabric Image</span>
      <div className="mt-1 flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-dashed border-border bg-muted/40 hover:border-primary"
          aria-label="Choose fabric image"
        >
          {preview ? (
            <img src={preview} alt="Fabric preview" className="h-full w-full object-cover" />
          ) : path ? (
            <MaterialThumb path={path} className="h-full w-full" />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
        </button>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-bold hover:border-primary hover:text-primary"
          >
            <Upload className="h-3.5 w-3.5" /> Choose from files
          </button>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-bold hover:border-primary hover:text-primary"
          >
            <Camera className="h-3.5 w-3.5" /> Take photo
          </button>
          {file && (
            <button
              type="button"
              onClick={() => onFile(null)}
              className="w-fit text-[11px] font-bold text-muted-foreground hover:text-destructive"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

/* ---------- Shared shell / atoms ---------- */

function DialogShell({
  title,
  onClose,
  children,
  widthClass = "max-w-md",
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/40 p-0 sm:place-items-center sm:p-4">
      <div
        className={`w-full ${widthClass} max-h-[92vh] overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:rounded-3xl`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-bold tabular-nums">{value}</div>
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

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
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
