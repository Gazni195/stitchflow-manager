import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, MoreVertical, Pencil, Trash2, X, AlertTriangle } from "lucide-react";
import type { Design, DesignPart } from "@/lib/designs";
import { STATUS_LABEL } from "@/lib/designs";
import { useDeleteDesign, useUpdateDesign } from "@/lib/api/designs";
import { cn } from "@/lib/utils";

export function DesignActionsMenu({ design }: { design: Design }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!btnRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const canDelete = design.status === "draft";

  return (
    <>
      <div ref={btnRef} className="relative">
        <button
          aria-label="Design actions"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
        {open && (
          <div className="absolute right-0 top-12 z-40 w-56 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <button
              onClick={() => { setOpen(false); setEdit(true); }}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold hover:bg-accent"
            >
              <Pencil className="h-4 w-4 text-primary" /> Edit design
            </button>
            <button
              disabled={!canDelete}
              onClick={() => { setOpen(false); setConfirm(true); }}
              className="flex w-full items-center gap-2.5 border-t border-border px-4 py-3 text-left text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent"
              title={canDelete ? undefined : `Only draft designs can be deleted (currently ${STATUS_LABEL[design.status]}).`}
            >
              <Trash2 className="h-4 w-4" /> Delete design
            </button>
            {!canDelete && (
              <p className="border-t border-border bg-muted/50 px-4 py-2 text-[11px] text-muted-foreground">
                Deletion is only available while the design is in Draft.
              </p>
            )}
          </div>
        )}
      </div>

      {edit && <EditDesignDialog design={design} onClose={() => setEdit(false)} />}
      {confirm && <DeleteConfirmDialog design={design} onClose={() => setConfirm(false)} />}
    </>
  );
}

function EditDesignDialog({ design, onClose }: { design: Design; onClose: () => void }) {
  const update = useUpdateDesign();
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState({
    code: design.code,
    name: design.name,
    customer: design.customer,
    color: design.color,
    orderQuantity: design.orderQuantity,
    parts: design.parts.map((p) => ({ ...p })) as DesignPart[],
  });

  function updatePart(id: string, patch: Partial<DesignPart>) {
    setD({ ...d, parts: d.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  }

  const partsValid = d.parts.every(
    (p) =>
      p.name.trim().length > 0 &&
      p.fabric.trim().length > 0 &&
      p.color.trim().length > 0 &&
      p.quantity > 0,
  );
  const valid =
    d.code.trim() && d.name.trim() && d.customer.trim() && d.color.trim() && d.orderQuantity > 0 && partsValid;

  async function submit() {
    setError(null);
    try {
      await update.mutateAsync({
        id: design.id,
        code: d.code.trim(),
        name: d.name.trim(),
        customer: d.customer.trim(),
        category: design.category,
        productType: design.productType,
        parts: d.parts.map((p) => ({
          id: p.id,
          name: p.name.trim(),
          fabric: p.fabric.trim(),
          color: p.color.trim(),
          quantity: p.quantity,
        })),
        color: d.color.trim(),
        orderQuantity: d.orderQuantity,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update design");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Edit</p>
            <h2 className="text-lg font-extrabold">Update design</h2>
          </div>
          <button
            aria-label="Close"
            onClick={() => !update.isPending && onClose()}
            className="rounded-xl p-2 text-muted-foreground hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
          <div className="grid gap-4">
            <Text label="Design Code" value={d.code} onChange={(v) => setD({ ...d, code: v.toUpperCase() })} />
            <Text label="Design Name" value={d.name} onChange={(v) => setD({ ...d, name: v })} />
            <Text label="Customer" value={d.customer} onChange={(v) => setD({ ...d, customer: v })} />
            <Text label="Color" value={d.color} onChange={(v) => setD({ ...d, color: v })} />
            <div>
              <Label>Order Quantity</Label>
              <input
                type="number"
                min={1}
                value={d.orderQuantity || ""}
                onChange={(e) => setD({ ...d, orderQuantity: Math.max(0, Number(e.target.value) || 0) })}
                className="mt-1.5 w-full rounded-2xl border border-border bg-card px-4 py-3 text-base font-semibold outline-none focus:border-primary"
              />
            </div>

            <div>
              <Label>Garment Parts</Label>
              <div className="mt-2 grid gap-2">
                {d.parts.map((p, i) => (
                  <div key={p.id} className="rounded-2xl border border-border bg-card p-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <input
                        value={p.name}
                        onChange={(e) => updatePart(p.id, { name: e.target.value })}
                        placeholder="Part name"
                        className="flex-1 rounded-lg bg-transparent px-2 py-1.5 text-sm font-semibold outline-none focus:bg-muted/40"
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <PartField label="Fabric" value={p.fabric} onChange={(v) => updatePart(p.id, { fabric: v })} />
                      <PartField label="Color" value={p.color} onChange={(v) => updatePart(p.id, { color: v })} />
                      <PartField
                        label="Quantity"
                        type="number"
                        value={p.quantity ? String(p.quantity) : ""}
                        onChange={(v) => updatePart(p.id, { quantity: Math.max(0, Number(v) || 0) })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            disabled={update.isPending}
            className="rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!valid || update.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </footer>
      </div>
    </div>
  );
}

function DeleteConfirmDialog({ design, onClose }: { design: Design; onClose: () => void }) {
  const del = useDeleteDesign();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await del.mutateAsync({ id: design.id, status: design.status, imagePath: design.imagePath });
      onClose();
      navigate({ to: "/designs" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete design");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-background shadow-2xl">
        <div className="px-5 pt-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-extrabold">Delete this design?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{design.code}</span> — {design.name}
            <br />
            This permanently removes the design and its workflow. This action cannot be undone.
          </p>
          {error && (
            <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2 border-t border-border p-4">
          <button
            onClick={onClose}
            disabled={del.isPending}
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={del.isPending}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50",
            )}
          >
            {del.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{children}</label>;
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-2xl border border-border bg-card px-4 py-3 text-base font-semibold outline-none focus:border-primary"
      />
    </div>
  );
}

function PartField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
      />
    </label>
  );
}
