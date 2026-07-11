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
} from "lucide-react";
import { useCreateDesign } from "@/lib/api/designs";
import type { DesignPart } from "@/lib/designs";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Women's Wear"];

const PRODUCT_TYPES = [
  "Three Piece Set",
  "Two Piece Set",
  "Kurti",
  "Dress",
  "Gown",
  "Co-ord Set",
  "Top Only",
  "Pant Only",
  "Shawl Only",
  "Other",
] as const;
type ProductType = (typeof PRODUCT_TYPES)[number];

const DEFAULT_PARTS: Record<ProductType, string[]> = {
  "Three Piece Set": ["Top", "Pant", "Shawl"],
  "Two Piece Set": ["Top", "Pant"],
  Kurti: ["Top"],
  Dress: ["Dress"],
  Gown: ["Gown"],
  "Co-ord Set": ["Top", "Bottom"],
  "Top Only": ["Top"],
  "Pant Only": ["Pant"],
  "Shawl Only": ["Shawl"],
  Other: [],
};

type Draft = {
  category: string;
  productType: ProductType | "";
  parts: DesignPart[];
  code: string;
  name: string;
  customer: string;
  fabric: string;
  color: string;
  orderQuantity: number;
  imageFile: File | null;
};

const EMPTY: Draft = {
  category: "Women's Wear",
  productType: "",
  parts: [],
  code: "",
  name: "",
  customer: "",
  fabric: "",
  color: "",
  orderQuantity: 0,
  imageFile: null,
};

const TOTAL_STEPS = 5;
type Step = 0 | 1 | 2 | 3 | 4;

function uid() {
  return (crypto?.randomUUID?.() ?? `p-${Date.now()}-${Math.random()}`).slice(0, 12);
}

export function DesignWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const [d, setD] = useState<Draft>(EMPTY);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateDesign();

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
      quantity: 0,
    }));
    setD({ ...d, productType: pt, parts });
  }

  function addPart() {
    setD({
      ...d,
      parts: [
        ...d.parts,
        { id: uid(), name: "", fabric: "", color: "" },
      ],
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

  const step0Valid = !!d.category;
  const partsValid =
    d.parts.length > 0 &&
    d.parts.every(
      (p) =>
        p.name.trim().length > 0 &&
        p.fabric.trim().length > 0 &&
        p.color.trim().length > 0 &&
        p.quantity > 0,
    );
  const step1Valid = !!d.productType && partsValid;
  const step2Valid = d.code.trim() && d.name.trim() && d.customer.trim();
  const step3Valid = d.color.trim() && d.orderQuantity > 0;

  const stepTitle = [
    "Category",
    "Product type & parts",
    "Design basics",
    "Specifications",
    "Cover image",
  ][step];

  async function submit() {
    setError(null);
    try {
      const design = await create.mutateAsync({
        code: d.code.trim(),
        name: d.name.trim(),
        customer: d.customer.trim(),
        category: d.category,
        productType: d.productType || "",
        parts: d.parts.map((p) => ({
          id: p.id,
          name: p.name.trim(),
          fabric: p.fabric.trim(),
          color: p.color.trim(),
          quantity: p.quantity,
        })),
        color: d.color.trim(),
        orderQuantity: d.orderQuantity,
        imageFile: d.imageFile,
      });
      reset();
      onClose();
      navigate({ to: "/designs/$code", params: { code: design.code } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create design");
    }
  }

  function nextDisabled() {
    if (step === 0) return !step0Valid;
    if (step === 1) return !step1Valid;
    if (step === 2) return !step2Valid;
    if (step === 3) return !step3Valid;
    return false;
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
          <button
            aria-label="Close"
            onClick={close}
            className="rounded-xl p-2 text-muted-foreground hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className={cn("grid gap-1 px-5 pt-4", `grid-cols-${TOTAL_STEPS}`)}
             style={{ gridTemplateColumns: `repeat(${TOTAL_STEPS}, minmax(0, 1fr))` }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")}
            />
          ))}
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
          {step === 0 && (
            <div className="grid gap-3">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setD({ ...d, category: c })}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-sm font-semibold",
                      d.category === c
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                More categories will unlock as your catalog grows.
              </p>
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
                    Auto-filled from product type — edit, reorder or add your own.
                  </p>

                  <div className="mt-3 grid gap-2">
                    {d.parts.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-center text-xs text-muted-foreground">
                        No parts yet — add one to describe this garment.
                      </div>
                    )}
                    {d.parts.map((p, i) => (
                      <div
                        key={p.id}
                        className="rounded-2xl border border-border bg-card p-3"
                      >
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
                            <IconBtn
                              label="Move up"
                              disabled={i === 0}
                              onClick={() => movePart(i, -1)}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </IconBtn>
                            <IconBtn
                              label="Move down"
                              disabled={i === d.parts.length - 1}
                              onClick={() => movePart(i, 1)}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </IconBtn>
                            <IconBtn
                              label="Remove"
                              onClick={() => removePart(p.id)}
                              destructive
                            >
                              <Trash2 className="h-4 w-4" />
                            </IconBtn>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <PartField
                            label="Fabric"
                            placeholder="Silk Chanderi"
                            value={p.fabric}
                            onChange={(v) => updatePart(p.id, { fabric: v })}
                          />
                          <PartField
                            label="Color"
                            placeholder="Ivory"
                            value={p.color}
                            onChange={(v) => updatePart(p.id, { color: v })}
                          />
                          <PartField
                            label="Quantity"
                            placeholder="0"
                            type="number"
                            value={p.quantity ? String(p.quantity) : ""}
                            onChange={(v) =>
                              updatePart(p.id, {
                                quantity: Math.max(0, Number(v) || 0),
                              })
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4">
              <Text
                label="Design Code"
                placeholder="e.g. FL-2419"
                value={d.code}
                onChange={(v) => setD({ ...d, code: v.toUpperCase() })}
              />
              <Text
                label="Design Name"
                placeholder="Ivory Anarkali Gown"
                value={d.name}
                onChange={(v) => setD({ ...d, name: v })}
              />
              <Text
                label="Customer"
                placeholder="Aanya Couture"
                value={d.customer}
                onChange={(v) => setD({ ...d, customer: v })}
              />
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4">
              <Text
                label="Color"
                placeholder="Ivory"
                value={d.color}
                onChange={(v) => setD({ ...d, color: v })}
              />
              <div>
                <Label>Order Quantity</Label>
                <input
                  type="number"
                  min={1}
                  value={d.orderQuantity || ""}
                  onChange={(e) =>
                    setD({
                      ...d,
                      orderQuantity: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="mt-1.5 w-full rounded-2xl border border-border bg-card px-4 py-3 text-base font-semibold outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-4">
              <Label>Design Image (optional)</Label>
              <label className="grid cursor-pointer place-items-center rounded-3xl border-2 border-dashed border-border bg-muted/40 py-10 hover:border-primary hover:bg-primary-soft">
                {preview ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-h-48 rounded-2xl object-contain"
                  />
                ) : (
                  <div className="text-center">
                    <ImagePlus className="mx-auto h-8 w-8 text-primary" />
                    <p className="mt-2 text-sm font-semibold">Tap to upload cover image</p>
                    <p className="text-[11px] text-muted-foreground">
                      PNG or JPG, up to ~5MB
                    </p>
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
                  className="text-sm font-semibold text-muted-foreground hover:text-destructive"
                >
                  Remove image
                </button>
              )}
              <div className="rounded-2xl border border-primary/20 bg-primary-soft p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-bold">Ready to create</p>
                    <p className="text-xs text-muted-foreground">
                      {d.parts.length} part{d.parts.length === 1 ? "" : "s"} configured. A
                      sample workflow will be started automatically.
                    </p>
                  </div>
                </div>
              </div>
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
          {step < TOTAL_STEPS - 1 ? (
            <button
              onClick={() => setStep((step + 1) as Step)}
              disabled={nextDisabled()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={create.isPending}
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
  return (
    <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
      {children}
    </span>
  );
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

function PartField({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        min={type === "number" ? 0 : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-primary"
      />
    </label>
  );
}
