import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X, CheckCircle2 } from "lucide-react";
import { useCreateDesign } from "@/lib/api/designs";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Kurta", "Saree", "Lehenga", "Gown", "Sherwani", "Co-ord", "Suit", "Other"];

type Draft = {
  code: string;
  name: string;
  customer: string;
  category: string;
  fabric: string;
  color: string;
  orderQuantity: number;
  imageFile: File | null;
};

const EMPTY: Draft = {
  code: "",
  name: "",
  customer: "",
  category: "Kurta",
  fabric: "",
  color: "",
  orderQuantity: 0,
  imageFile: null,
};

export function DesignWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<0 | 1 | 2>(0);
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

  const step0Valid = d.code.trim() && d.name.trim() && d.customer.trim();
  const step1Valid = d.fabric.trim() && d.color.trim() && d.orderQuantity > 0;

  async function submit() {
    setError(null);
    try {
      const design = await create.mutateAsync({
        code: d.code.trim(),
        name: d.name.trim(),
        customer: d.customer.trim(),
        category: d.category,
        fabric: d.fabric.trim(),
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
              Step {step + 1} of 3
            </p>
            <h2 className="text-lg font-extrabold">
              {step === 0 ? "Design basics" : step === 1 ? "Specifications" : "Cover image"}
            </h2>
          </div>
          <button aria-label="Close" onClick={close}
            className="rounded-xl p-2 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid grid-cols-3 gap-1 px-5 pt-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cn("h-1.5 rounded-full",
              i <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
          {step === 0 && (
            <div className="grid gap-4">
              <Text label="Design Code" placeholder="e.g. FL-2419"
                value={d.code} onChange={(v) => setD({ ...d, code: v.toUpperCase() })} />
              <Text label="Design Name" placeholder="Ivory Anarkali Gown"
                value={d.name} onChange={(v) => setD({ ...d, name: v })} />
              <Text label="Customer" placeholder="Aanya Couture"
                value={d.customer} onChange={(v) => setD({ ...d, customer: v })} />
              <div>
                <Label>Category</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button key={c} onClick={() => setD({ ...d, category: c })}
                      className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold",
                        d.category === c
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:border-primary/40")}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4">
              <Text label="Fabric" placeholder="Silk Chanderi"
                value={d.fabric} onChange={(v) => setD({ ...d, fabric: v })} />
              <Text label="Color" placeholder="Ivory"
                value={d.color} onChange={(v) => setD({ ...d, color: v })} />
              <div>
                <Label>Order Quantity</Label>
                <input type="number" min={1} value={d.orderQuantity || ""}
                  onChange={(e) => setD({ ...d, orderQuantity: Math.max(0, Number(e.target.value) || 0) })}
                  className="mt-1.5 w-full rounded-2xl border border-border bg-card px-4 py-3 text-base font-semibold outline-none focus:border-primary" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4">
              <Label>Design Image (optional)</Label>
              <label className="grid cursor-pointer place-items-center rounded-3xl border-2 border-dashed border-border bg-muted/40 py-10 hover:border-primary hover:bg-primary-soft">
                {preview ? (
                  <img src={preview} alt="Preview" className="max-h-48 rounded-2xl object-contain" />
                ) : (
                  <div className="text-center">
                    <ImagePlus className="mx-auto h-8 w-8 text-primary" />
                    <p className="mt-2 text-sm font-semibold">Tap to upload cover image</p>
                    <p className="text-[11px] text-muted-foreground">PNG or JPG, up to ~5MB</p>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
              </label>
              {preview && (
                <button onClick={() => pickImage(null)}
                  className="text-sm font-semibold text-muted-foreground hover:text-destructive">
                  Remove image
                </button>
              )}
              <div className="rounded-2xl border border-primary/20 bg-primary-soft p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-bold">Ready to create</p>
                    <p className="text-xs text-muted-foreground">
                      A sample workflow will be started automatically. You can configure it right after.
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
          <button onClick={() => (step === 0 ? close() : setStep((step - 1) as 0 | 1 | 2))}
            disabled={create.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent disabled:opacity-50">
            <ArrowLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < 2 ? (
            <button
              onClick={() => setStep((step + 1) as 0 | 1 | 2)}
              disabled={(step === 0 && !step0Valid) || (step === 1 && !step1Valid)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50">
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={submit} disabled={create.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md hover:brightness-105 disabled:opacity-70">
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

function Text({ label, placeholder, value, onChange }: {
  label: string; placeholder?: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1.5 w-full rounded-2xl border border-border bg-card px-4 py-3 text-base font-semibold outline-none focus:border-primary" />
    </div>
  );
}
