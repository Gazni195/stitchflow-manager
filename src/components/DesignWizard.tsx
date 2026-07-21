import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Loader2,
  X,
  CheckCircle2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Search,
} from "lucide-react";
import { useCreateDesign } from "@/lib/api/designs";
import type { DesignPart } from "@/lib/designs";
import { useMaterials } from "@/lib/api/materials";
import { cn } from "@/lib/utils";

// This app only ever operates on Women's Wear today — there is no
// Category step anymore, this is just what gets saved silently.
const DEFAULT_CATEGORY = "Women's Wear";

const PRODUCT_TYPES = ["Three Piece", "Two Piece", "Kurti", "Other"] as const;
type ProductType = (typeof PRODUCT_TYPES)[number];

const DEFAULT_PARTS: Record<ProductType, string[]> = {
  "Three Piece": ["Top", "Pant", "Shawl"],
  "Two Piece": ["Top", "Shawl"],
  Kurti: ["Top"],
  Other: [],
};

const QUANTITY_PRESETS = ["20", "40", "60", "80"] as const;
type QuantityChoice = "" | (typeof QUANTITY_PRESETS)[number] | "other";

// No color master exists anywhere in this app, so this is just a
// starting list for the searchable selector — typing anything else and
// picking "Use ..." is always available (see SearchableSelect below).
const COMMON_COLORS = [
  "Ivory",
  "White",
  "Black",
  "Red",
  "Maroon",
  "Pink",
  "Peach",
  "Yellow",
  "Mustard",
  "Green",
  "Olive",
  "Blue",
  "Navy",
  "Teal",
  "Purple",
  "Lavender",
  "Grey",
  "Beige",
  "Gold",
  "Silver",
  "Multicolor",
];

type Draft = {
  imageFile: File | null;
  name: string;
  customer: string;
  quantityChoice: QuantityChoice;
  customQuantity: number;
  productType: ProductType | "";
  parts: DesignPart[];
};

const EMPTY: Draft = {
  imageFile: null,
  name: "",
  customer: "",
  quantityChoice: "",
  customQuantity: 0,
  productType: "",
  parts: [],
};

const TOTAL_STEPS = 2;
type Step = 0 | 1;

function uid() {
  return (crypto?.randomUUID?.() ?? `p-${Date.now()}-${Math.random()}`).slice(0, 12);
}

// Design Code is never asked for here — it has no meaning until a design
// is approved and enters Sample Development, at which point it's the only
// thing anyone actually looks up by. The `designs.code` column is still
// NOT NULL + UNIQUE today, so something has to be written; this generates
// it silently (current time, base-36) so the user never sees or types it,
// with no schema change required.
function generateDesignCode(): string {
  return `FL-${Date.now().toString(36).toUpperCase()}`;
}

export function DesignWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const [d, setD] = useState<Draft>(EMPTY);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateDesign();
  const { data: inventory = [] } = useMaterials();

  // "Fabric" here is simply every active Inventory item — this app's
  // Materials table has no category/type column to distinguish fabric
  // from trims/accessories yet, so there's nothing to filter by beyond
  // active/inactive. Stock is deliberately not read or shown at all.
  const fabricOptions = inventory.filter((m) => m.status === "active").map((m) => m.name);

  if (!open) return null;

  function reset() {
    setStep(0);
    setD(EMPTY);
    setPreview(null);
    setError(null);
  }

  function close() {
    if (create.isPending) return;
    reset();
    onClose();
  }

  function pickImage(f: File | null) {
    setD({ ...d, imageFile: f });
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  function pickProductType(pt: ProductType) {
    const parts = DEFAULT_PARTS[pt].map((name) => ({
      id: uid(),
      name,
      fabric: "",
      color: "",
    }));
    setD({ ...d, productType: pt, parts });
  }

  function addPart() {
    setD({
      ...d,
      parts: [...d.parts, { id: uid(), name: "", fabric: "", color: "" }],
    });
  }
  function removePart(id: string) {
    setD({ ...d, parts: d.parts.filter((p) => p.id !== id) });
  }
  function updatePart(id: string, patch: Partial<DesignPart>) {
    setD({ ...d, parts: d.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  }
  function movePart(idx: number, dir: -1 | 1) {
    const next = [...d.parts];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setD({ ...d, parts: next });
  }

  const step0Valid = !!d.imageFile && d.name.trim().length > 0;
  const step1Valid = !!d.productType && d.parts.length > 0 && d.parts.every((p) => p.name.trim().length > 0);

  const stepTitle = ["Design Information", "Product Structure"][step];

  async function submit() {
    setError(null);
    try {
      const orderQuantity =
        d.quantityChoice === "other" ? d.customQuantity : d.quantityChoice ? Number(d.quantityChoice) : 0;

      const design = await create.mutateAsync({
        code: generateDesignCode(),
        name: d.name.trim(),
        customer: d.customer.trim(),
        category: DEFAULT_CATEGORY,
        productType: d.productType || "",
        parts: d.parts.map((p) => ({
          id: p.id,
          name: p.name.trim(),
          fabric: p.fabric.trim(),
          color: p.color.trim(),
        })),
        color: "",
        orderQuantity,
        imageFile: d.imageFile,
      });
      reset();
      onClose();
      navigate({ to: "/designs/$code", params: { code: design.code } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create design");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
              Step {step + 1} of {TOTAL_STEPS}
            </p>
            <h2 className="text-lg font-extrabold">{stepTitle}</h2>
          </div>
          <button aria-label="Close" onClick={close} className="rounded-xl p-2 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid gap-1 px-5 pt-4" style={{ gridTemplateColumns: `repeat(${TOTAL_STEPS}, minmax(0, 1fr))` }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
          {step === 0 && (
            <div className="grid gap-4">
              <div>
                <Label>Reference Image</Label>
                <label className="mt-1.5 grid cursor-pointer place-items-center rounded-3xl border-2 border-dashed border-border bg-muted/40 py-8 hover:border-primary hover:bg-primary-soft">
                  {preview ? (
                    <img src={preview} alt="Preview" className="max-h-40 rounded-2xl object-contain" />
                  ) : (
                    <div className="text-center">
                      <ImagePlus className="mx-auto h-8 w-8 text-primary" />
                      <p className="mt-2 text-sm font-semibold">Tap to upload reference image</p>
                      <p className="text-[11px] text-muted-foreground">PNG or JPG, up to ~5MB</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                  />
                </label>
                {preview && (
                  <button
                    onClick={() => pickImage(null)}
                    className="mt-1.5 text-sm font-semibold text-muted-foreground hover:text-destructive"
                  >
                    Remove image
                  </button>
                )}
              </div>

              <Text
                label="Design Name"
                placeholder="Ivory Anarkali Gown"
                value={d.name}
                onChange={(v) => setD({ ...d, name: v })}
              />

              <Text
                label="Customer (optional)"
                placeholder="Aanya Couture"
                value={d.customer}
                onChange={(v) => setD({ ...d, customer: v })}
              />

              <div>
                <Label>Estimated Order Quantity (optional)</Label>
                <select
                  value={d.quantityChoice}
                  onChange={(e) => setD({ ...d, quantityChoice: e.target.value as QuantityChoice })}
                  className="mt-1.5 w-full rounded-2xl border border-border bg-card px-4 py-3 text-base font-semibold outline-none focus:border-primary"
                >
                  <option value="">Not specified</option>
                  {QUANTITY_PRESETS.map((q) => (
                    <option key={q} value={q}>
                      {q} Pieces
                    </option>
                  ))}
                  <option value="other">Other</option>
                </select>
                {d.quantityChoice === "other" && (
                  <input
                    type="number"
                    min={1}
                    value={d.customQuantity || ""}
                    onChange={(e) => setD({ ...d, customQuantity: Math.max(0, Number(e.target.value) || 0) })}
                    placeholder="Enter quantity"
                    className="mt-2 w-full rounded-2xl border border-border bg-card px-4 py-3 text-base font-semibold outline-none focus:border-primary"
                  />
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-5">
              <div>
                <Label>Product Type</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {PRODUCT_TYPES.map((pt) => (
                    <button
                      key={pt}
                      onClick={() => pickProductType(pt)}
                      className={cn(
                        "rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold",
                        d.productType === pt
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border bg-card hover:border-primary/40",
                      )}
                    >
                      {pt}
                    </button>
                  ))}
                </div>
              </div>

              {d.productType && (
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Garment Parts</Label>
                    <button
                      onClick={addPart}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add part
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Auto-filled from product type — edit, reorder or add your own. Fabric and color are optional.
                  </p>

                  <div className="mt-3 grid gap-2">
                    {d.parts.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-center text-xs text-muted-foreground">
                        No parts yet — add one to describe this garment.
                      </div>
                    )}
                    {d.parts.map((p, i) => (
                      <div key={p.id} className="rounded-2xl border border-border bg-card p-3">
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
                            {i + 1}
                          </span>
                          <input
                            value={p.name}
                            onChange={(e) => updatePart(p.id, { name: e.target.value })}
                            placeholder="Part name (e.g. Sleeve)"
                            className="flex-1 rounded-lg bg-transparent px-2 py-1.5 text-sm font-semibold outline-none focus:bg-muted/40"
                          />
                          <div className="flex items-center gap-1">
                            <IconBtn label="Move up" disabled={i === 0} onClick={() => movePart(i, -1)}>
                              <ArrowUp className="h-4 w-4" />
                            </IconBtn>
                            <IconBtn
                              label="Move down"
                              disabled={i === d.parts.length - 1}
                              onClick={() => movePart(i, 1)}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </IconBtn>
                            <IconBtn label="Remove" onClick={() => removePart(p.id)} destructive>
                              <Trash2 className="h-4 w-4" />
                            </IconBtn>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <SearchableSelect
                            label="Fabric (optional)"
                            value={p.fabric}
                            options={fabricOptions}
                            placeholder="Select from Inventory"
                            onChange={(v) => updatePart(p.id, { fabric: v })}
                          />
                          <SearchableSelect
                            label="Color (optional)"
                            value={p.color}
                            options={COMMON_COLORS}
                            placeholder="Select or type a color"
                            allowCustom
                            onChange={(v) => updatePart(p.id, { color: v })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step1Valid && (
                <div className="rounded-2xl border border-primary/20 bg-primary-soft p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-bold">Ready to create</p>
                      <p className="text-xs text-muted-foreground">
                        {d.parts.length} part{d.parts.length === 1 ? "" : "s"} configured. A sample workflow will be
                        started automatically.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <button
            onClick={() => (step === 0 ? close() : setStep((step - 1) as Step))}
            disabled={create.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}
          </button>
          {step === 0 ? (
            <button
              onClick={() => setStep(1)}
              disabled={!step0Valid}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!step1Valid || create.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md hover:brightness-105 disabled:opacity-70"
            >
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Design
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{children}</span>;
}

function Text({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-2xl border border-border bg-card px-4 py-3 text-base font-semibold outline-none focus:border-primary"
      />
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  disabled,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-30",
        destructive && "hover:bg-destructive/10 hover:text-destructive",
      )}
    >
      {children}
    </button>
  );
}

// Compact searchable dropdown used for per-part Fabric/Color. Fabric is
// restricted to real Inventory items (allowCustom left off); Color has no
// backing master data so typing a value that isn't in the starter list is
// still allowed via the "Use ..." row.
function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  allowCustom,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;

  function choose(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  return (
    <label className="relative grid gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-left text-sm font-semibold outline-none focus:border-primary"
      >
        <span className={cn("truncate", !value && "font-normal text-muted-foreground")}>
          {value || placeholder || "Select"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[12rem] rounded-xl border border-border bg-card shadow-lg">
            <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ul className="max-h-40 overflow-y-auto py-1">
              {value && (
                <li>
                  <button
                    type="button"
                    onClick={() => choose("")}
                    className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-muted-foreground hover:bg-accent"
                  >
                    Clear selection
                  </button>
                </li>
              )}
              {filtered.map((o) => (
                <li key={o}>
                  <button
                    type="button"
                    onClick={() => choose(o)}
                    className="w-full px-2.5 py-1.5 text-left text-sm font-medium hover:bg-accent"
                  >
                    {o}
                  </button>
                </li>
              ))}
              {filtered.length === 0 && !(allowCustom && query.trim()) && (
                <li className="px-2.5 py-2 text-xs text-muted-foreground">No matches</li>
              )}
              {allowCustom && query.trim() && (
                <li>
                  <button
                    type="button"
                    onClick={() => choose(query.trim())}
                    className="w-full px-2.5 py-1.5 text-left text-sm font-semibold text-primary hover:bg-primary-soft/40"
                  >
                    Use "{query.trim()}"
                  </button>
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </label>
  );
}
