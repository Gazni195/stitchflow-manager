import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/hooks/use-auth";
import { useDesignByCode } from "@/lib/api/designs";
import {
  useBomItems,
  useDeleteBomItem,
  useUpsertBomItem,
  type BomItem,
} from "@/lib/api/sample-bom";
import type { Design } from "@/lib/designs";

export const Route = createFileRoute("/sample-development/$code/materials")({
  head: ({ params }) => ({
    meta: [{ title: `Materials · ${params.code} — Fawri Lifestyle` }],
  }),
  component: MaterialSelectionPage,
});

function MaterialSelectionPage() {
  useRequireAuth();
  const { code } = Route.useParams();
  const { data: design, isLoading } = useDesignByCode(code);

  if (isLoading) {
    return (
      <AppShell title="Material Selection">
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }
  if (!design) {
    return (
      <AppShell title="Design not found" subtitle={code}>
        <p className="text-sm text-muted-foreground">No design with code {code}.</p>
      </AppShell>
    );
  }
  return <MaterialSelection design={design} />;
}

type PartRow = {
  partId: string;
  name: string;
  fabric: string;
  color: string;
  bomId: string | null;
  consumption: number;
  unit: string;
  rate: number;
};

function MaterialSelection({ design }: { design: Design }) {
  const { data: bomItems = [], isLoading } = useBomItems(design.id);
  const upsert = useUpsertBomItem(design.id);
  const del = useDeleteBomItem(design.id);

  const [partRows, setPartRows] = useState<PartRow[]>([]);
  const [accessories, setAccessories] = useState<BomItem[]>([]);

  useEffect(() => {
    setPartRows(
      design.parts.map((p, i) => {
        const existing = bomItems.find((b) => b.kind === "part" && b.partId === p.id);
        return {
          partId: p.id,
          name: p.name,
          fabric: p.fabric,
          color: p.color,
          bomId: existing?.id ?? null,
          consumption: existing?.consumption ?? 0,
          unit: existing?.unit ?? "Mtr",
          rate: existing?.rate ?? 0,
        };
      }),
    );
    setAccessories(bomItems.filter((b) => b.kind === "accessory").map((b) => ({ ...b })));
  }, [bomItems, design.parts]);

  function updatePart(partId: string, patch: Partial<PartRow>) {
    setPartRows((rows) => rows.map((r) => (r.partId === partId ? { ...r, ...patch } : r)));
  }

  function commitPart(row: PartRow) {
    upsert.mutate({
      id: row.bomId ?? undefined,
      kind: "part",
      partId: row.partId,
      name: row.name,
      color: row.color,
      consumption: row.consumption,
      unit: row.unit,
      rate: row.rate,
      sequence: 0,
    });
  }

  function updateAccessory(id: string, patch: Partial<BomItem>) {
    setAccessories((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function commitAccessory(row: BomItem) {
    upsert.mutate({
      id: row.id,
      kind: "accessory",
      partId: null,
      name: row.name,
      color: row.color,
      consumption: row.consumption,
      unit: row.unit,
      rate: row.rate,
      sequence: row.sequence,
    });
  }

  function addAccessory() {
    upsert.mutate({
      kind: "accessory",
      partId: null,
      name: "New Accessory",
      color: "",
      consumption: 1,
      unit: "Pcs",
      rate: 0,
      sequence: accessories.length,
    });
  }

  return (
    <AppShell
      title="Material Selection"
      subtitle={`${design.code} · ${design.name}`}
      action={
        <Link
          to="/sample-development/$code"
          params={{ code: design.code }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Sample
        </Link>
      }
    >
      <div className="grid gap-5">
        {isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-base font-bold">Materials (BOM)</h3>
              {partRows.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Add garment parts on the design to start material selection.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {partRows.map((row) => (
                    <li
                      key={row.partId}
                      className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-background p-3 sm:grid-cols-4"
                    >
                      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                        <span
                          className="h-4 w-4 shrink-0 rounded-full border border-border"
                          style={{ backgroundColor: swatchColor(row.color) }}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">
                            {row.name} {row.fabric ? `(${row.fabric})` : ""}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{row.color || "—"}</p>
                        </div>
                      </div>
                      <NumField
                        label={`Consumption (${row.unit})`}
                        value={row.consumption}
                        onChange={(v) => updatePart(row.partId, { consumption: v })}
                        onBlur={() => commitPart(partRows.find((r) => r.partId === row.partId)!)}
                      />
                      <NumField
                        label={`Rate / ${row.unit}`}
                        value={row.rate}
                        prefix="₹"
                        onChange={(v) => updatePart(row.partId, { rate: v })}
                        onBlur={() => commitPart(partRows.find((r) => r.partId === row.partId)!)}
                      />
                      <div className="flex items-end justify-end text-sm font-bold text-primary">
                        ₹{(row.consumption * row.rate).toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">Accessories</h3>
                <button
                  onClick={addAccessory}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              {accessories.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No accessories added yet.</p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {accessories.map((row) => (
                    <li
                      key={row.id}
                      className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-background p-3 sm:grid-cols-5"
                    >
                      <input
                        value={row.name}
                        onChange={(e) => updateAccessory(row.id, { name: e.target.value })}
                        onBlur={() => commitAccessory(accessories.find((r) => r.id === row.id)!)}
                        placeholder="Name"
                        className="col-span-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm font-semibold outline-none focus:border-primary sm:col-span-1"
                      />
                      <input
                        value={row.color}
                        onChange={(e) => updateAccessory(row.id, { color: e.target.value })}
                        onBlur={() => commitAccessory(accessories.find((r) => r.id === row.id)!)}
                        placeholder="Color"
                        className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm outline-none focus:border-primary"
                      />
                      <NumField
                        label={`Qty (${row.unit})`}
                        value={row.consumption}
                        onChange={(v) => updateAccessory(row.id, { consumption: v })}
                        onBlur={() => commitAccessory(accessories.find((r) => r.id === row.id)!)}
                      />
                      <NumField
                        label="Rate"
                        value={row.rate}
                        prefix="₹"
                        onChange={(v) => updateAccessory(row.id, { rate: v })}
                        onBlur={() => commitAccessory(accessories.find((r) => r.id === row.id)!)}
                      />
                      <button
                        aria-label="Remove accessory"
                        onClick={() => del.mutate(row.id)}
                        className="flex items-center justify-end text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Link
              to="/sample-development/$code/next-process"
              params={{ code: design.code }}
              className="inline-flex w-fit items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-105"
            >
              Save &amp; Next
            </Link>
          </>
        )}
      </div>
    </AppShell>
  );
}

function NumField({
  label,
  value,
  prefix,
  onChange,
  onBlur,
}: {
  label: string;
  value: number;
  prefix?: string;
  onChange: (v: number) => void;
  onBlur: () => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
        <input
          type="number"
          min={0}
          value={value || ""}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          onBlur={onBlur}
          className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-sm font-semibold outline-none focus:border-primary"
        />
      </div>
    </label>
  );
}

function swatchColor(name: string): string {
  const known: Record<string, string> = {
    black: "#111827",
    white: "#f9fafb",
    ivory: "#fffff0",
    red: "#dc2626",
    blue: "#2563eb",
    green: "#16a34a",
    pink: "#ec4899",
    gold: "#ca8a04",
    beige: "#e8dcc8",
  };
  return known[name.trim().toLowerCase()] ?? "#d4d4d8";
}
