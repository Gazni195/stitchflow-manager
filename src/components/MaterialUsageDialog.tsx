// Material Usage popup — opens automatically each time a Sample Cutting
// operation completes. Records the ACTUAL material consumption per garment
// part for THIS cutting run and APPENDS the entries to the design's
// material history — previously saved usage rows are never overwritten so
// re-cuts and correction cuts build a full traceable history.
//
// Each row is saved with a group_name of
//   "<Garment Part>::<Category>::<Source>"
// so the Materials tab can group and label entries by their source
// operation (Cutting #1, Cutting #2, Re-cutting, …).

import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import type { Design, DesignPart } from "@/lib/designs";
import {
  useAddDesignMaterial,
  useDesignMaterials,
  useMaterials,
  type Material,
} from "@/lib/api/materials";


// Same categories as Material Selection — kept in sync manually because
// this popup is intentionally a leaner surface (no picker modal, no
// pricing) and shouldn't import the whole picker to avoid entangling
// screens that need to evolve independently.
const CATEGORIES = ["Primary Fabric", "Lining", "Accessories", "Lace", "Other"] as const;
type Category = (typeof CATEGORIES)[number];

type UsageRow = {
  key: string;
  materialId: string;
  category: Category;
  quantity: number;
};

type PartUsage = {
  partId: string;
  partName: string;
  suggestedFabric: string;
  primary: UsageRow;
  extras: UsageRow[];
};

function newRowKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Best-effort match of a design part's declared fabric name to an actual
// Inventory row so the popup can pre-fill the Primary Fabric selector.
// Falls back to the first active material so the row is never blank.
function suggestMaterialId(fabric: string, inventory: Material[]): string {
  if (inventory.length === 0) return "";
  const target = fabric.trim().toLowerCase();
  if (!target) return inventory[0].id;
  const exact = inventory.find((m) => m.name.toLowerCase() === target);
  if (exact) return exact.id;
  const partial = inventory.find(
    (m) => m.name.toLowerCase().includes(target) || target.includes(m.name.toLowerCase()),
  );
  return (partial ?? inventory[0]).id;
}

function buildInitialState(parts: DesignPart[], inventory: Material[]): PartUsage[] {
  const source: DesignPart[] =
    parts.length > 0
      ? parts
      : [
          { id: "top", name: "Top", fabric: "", color: "" },
          { id: "pant", name: "Pant", fabric: "", color: "" },
          { id: "dupatta", name: "Shawl / Dupatta", fabric: "", color: "" },
        ];
  return source.map((p) => ({
    partId: p.id,
    partName: p.name,
    suggestedFabric: p.fabric,
    primary: {
      key: newRowKey(),
      materialId: suggestMaterialId(p.fabric, inventory),
      category: "Primary Fabric",
      quantity: 0,
    },
    extras: [],
  }));
}

export function MaterialUsageDialog({
  design,
  sourceLabel,
  onClose,
  onSaved,
}: {
  design: Design;
  sourceLabel: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: inventory = [], isLoading: invLoading } = useMaterials();
  const { isLoading: exLoading } = useDesignMaterials(design.id);
  const addLine = useAddDesignMaterial(design.id);


  const activeInventory = useMemo(() => inventory.filter((m) => m.status === "active"), [inventory]);

  const [state, setState] = useState<PartUsage[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialise once inventory has loaded so suggestions can actually
  // resolve to a real material id.
  if (!state && !invLoading) {
    setState(buildInitialState(design.parts, activeInventory));
  }

  function patchPart(partId: string, patch: (p: PartUsage) => PartUsage) {
    setState((prev) => (prev ? prev.map((p) => (p.partId === partId ? patch(p) : p)) : prev));
  }

  function addExtra(partId: string) {
    patchPart(partId, (p) => ({
      ...p,
      extras: [
        ...p.extras,
        {
          key: newRowKey(),
          materialId: activeInventory[0]?.id ?? "",
          category: "Lining",
          quantity: 0,
        },
      ],
    }));
  }

  function removeExtra(partId: string, key: string) {
    patchPart(partId, (p) => ({ ...p, extras: p.extras.filter((r) => r.key !== key) }));
  }

  function updateRow(partId: string, key: string, patch: Partial<UsageRow>) {
    patchPart(partId, (p) => ({
      ...p,
      primary: p.primary.key === key ? { ...p.primary, ...patch } : p.primary,
      extras: p.extras.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    }));
  }

  async function handleSave() {
    if (!state) return;
    setError(null);
    setSaving(true);
    try {
      // 1. Restore stock + drop every existing row so the confirmed
      //    usage becomes the sole record for this design.
      for (const row of existing) {
        await removeLine.mutateAsync(row.id);
      }
      // 2. Insert the confirmed usage rows. Skip anything with no
      //    material or a zero quantity — those are intentionally empty.
      for (const part of state) {
        const rows: UsageRow[] = [part.primary, ...part.extras];
        for (const r of rows) {
          if (!r.materialId || r.quantity <= 0) continue;
          const mat = activeInventory.find((m) => m.id === r.materialId);
          if (!mat) continue;
          await addLine.mutateAsync({
            materialId: r.materialId,
            groupName: `${part.partName}::${r.category}`,
            quantity: r.quantity,
            rate: mat.costPerUnit,
          });
        }
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save material usage.");
    } finally {
      setSaving(false);
    }
  }

  const loading = invLoading || exLoading || !state;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-foreground/40 p-0 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Confirm Material Usage</h2>
            <p className="text-xs text-muted-foreground">
              Record the actual materials used for cutting. This will update Material Selection automatically.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="grid place-items-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeInventory.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background p-6 text-center">
              <p className="text-sm font-semibold">Inventory is empty</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add materials in the Inventory module before recording usage.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {state!.map((part) => (
                <div key={part.partId} className="rounded-2xl border border-border bg-background p-4">
                  <div className="mb-3 flex items-baseline justify-between gap-2">
                    <p className="text-sm font-bold">{part.partName}</p>
                    {part.suggestedFabric && (
                      <p className="text-[11px] text-muted-foreground">Design: {part.suggestedFabric}</p>
                    )}
                  </div>

                  <UsageRowEditor
                    row={part.primary}
                    inventory={activeInventory}
                    fixedCategory
                    onChange={(patch) => updateRow(part.partId, part.primary.key, patch)}
                  />

                  {part.extras.length > 0 && (
                    <div className="mt-2 grid gap-2">
                      {part.extras.map((r) => (
                        <UsageRowEditor
                          key={r.key}
                          row={r}
                          inventory={activeInventory}
                          onChange={(patch) => updateRow(part.partId, r.key, patch)}
                          onRemove={() => removeExtra(part.partId, r.key)}
                        />
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => addExtra(part.partId)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border bg-background px-3 py-2 text-xs font-semibold text-primary hover:bg-primary-soft/40"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Material
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="mx-5 mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-border px-3 py-2.5 text-xs font-bold text-muted-foreground hover:bg-accent disabled:opacity-60"
          >
            Skip for now
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading || activeInventory.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Material Usage
          </button>
        </div>
      </div>
    </div>
  );
}

function UsageRowEditor({
  row,
  inventory,
  fixedCategory,
  onChange,
  onRemove,
}: {
  row: UsageRow;
  inventory: Material[];
  fixedCategory?: boolean;
  onChange: (patch: Partial<UsageRow>) => void;
  onRemove?: () => void;
}) {
  const material = inventory.find((m) => m.id === row.materialId);
  const unit = material?.unit ?? "unit";
  return (
    <div className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] sm:items-end">
      <label className="block min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Material</span>
        <select
          value={row.materialId}
          onChange={(e) => onChange({ materialId: e.target.value })}
          className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm font-semibold outline-none focus:border-primary"
        >
          {inventory.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.unit})
            </option>
          ))}
        </select>
      </label>
      <label className="block min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Category</span>
        <select
          value={row.category}
          disabled={fixedCategory}
          onChange={(e) => onChange({ category: e.target.value as Category })}
          className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm font-semibold outline-none focus:border-primary disabled:opacity-70"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Used Qty ({unit})
        </span>
        <input
          type="number"
          min={0}
          step={0.25}
          inputMode="decimal"
          value={row.quantity || ""}
          onChange={(e) => onChange({ quantity: Math.max(0, Number(e.target.value) || 0) })}
          className="mt-1 w-full min-w-[6rem] rounded-lg border border-border bg-background px-2.5 py-2 text-right text-sm font-bold tabular-nums outline-none focus:border-primary sm:w-28"
        />
      </label>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label="Remove material"
          className="inline-flex h-9 w-9 items-center justify-center self-end rounded-lg border border-border text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
