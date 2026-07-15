// Bulk Production details — mirrors the Sample module UX so operators
// never have to relearn the flow: same tabbed shell, same "Start …"
// primary button, same Running / Completed timeline. The only substantive
// difference is that "Sample Making" becomes "Bulk Production", which
// supports multiple concurrent activities (Cutting, Hand Work, Machine
// Embroidery, Stitching, Printing, Washing, QC, Packing) with automatic
// factory-clock-aware time tracking.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Coffee,
  Factory,
  FileCheck2,
  Layers,
  Loader2,
  PlayCircle,
  StopCircle,
  Timer,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DesignImage } from "@/components/DesignImage";
import { useRequireAuth } from "@/hooks/use-auth";
import { useProductionOrder, computeProgress, useAssignLine } from "@/lib/api/production";
import { PRODUCTION_LINES, slugForLine } from "@/lib/lines";
import {
  ACTIVITY_OPERATIONS,
  ACTIVITY_OP_NAME,
  currentProductionStage,
  useCancelActivity,
  useCompleteActivity,
  useProductionActivities,
  useStartActivity,
  type ActivityOperationId,
  type ProductionActivity,
} from "@/lib/api/production-activities";
import { useDesignMaterials, type DesignMaterial } from "@/lib/api/materials";
import {
  useProductionReservations,
  useAddReservation,
  useRemoveReservation,
  type ProductionReservation,
} from "@/lib/api/production-reservations";
import {
  DEFAULT_FACTORY_CALENDAR,
  effectiveWorkingSeconds,
  elapsedSeconds,
  factoryStatusAt,
  formatClock,
  formatDuration,
  formatHMS,
} from "@/lib/factory-clock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/production/$po")({
  head: ({ params }) => ({ meta: [{ title: `${params.po} — Production` }] }),
  component: ProductionDetails,
});

type TabId = "materials" | "bulk" | "summary";
const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "materials", label: "Material Selection", icon: Layers },
  { id: "bulk", label: "Bulk Production", icon: Factory },
  { id: "summary", label: "Production Summary", icon: BarChart3 },
];

const PRODUCTION_STAGES = [
  { id: "material", label: "Material Selection" },
  { id: "bulk", label: "Bulk Production" },
  { id: "summary", label: "Production Summary" },
];

function ProductionDetails() {
  useRequireAuth();
  const { po } = Route.useParams();
  const { data: order, isLoading } = useProductionOrder(po);
  const [tab, setTab] = useState<TabId>("materials");

  if (isLoading) {
    return (
      <AppShell title={po}>
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }
  if (!order) {
    return (
      <AppShell title={po}>
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Production Order not found.</p>
          <Link to="/production" className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-primary">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Production
          </Link>
        </div>
      </AppShell>
    );
  }

  const stageIndex = tab === "materials" ? 0 : tab === "bulk" ? 1 : 2;

  return (
    <AppShell
      title={order.code}
      subtitle={`${order.designCode} · ${order.designName}`}
      action={
        <Link
          to="/production"
          aria-label="Back to production"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2.5 sm:text-sm sm:font-semibold sm:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">All Orders</span>
        </Link>
      }
    >
      <div className="grid gap-5">
        <ProductionHeader order={order} stageIndex={stageIndex} />

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
            {tab === "materials" && (
              <MaterialsPanel
                designId={order.designId}
                productionOrderId={order.id}
                orderQuantity={order.orderQuantity}
                onContinue={() => setTab("bulk")}
              />
            )}
            {tab === "bulk" && (
              <BulkProductionPanel
                productionOrderId={order.id}
                orderQuantity={order.orderQuantity}
                onContinue={() => setTab("summary")}
              />
            )}
            {tab === "summary" && <SummaryPanel productionOrderId={order.id} orderQuantity={order.orderQuantity} />}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/* ---------- Header (image + facts + workflow progress) ---------- */

function ProductionHeader({
  order,
  stageIndex,
}: {
  order: NonNullable<ReturnType<typeof useProductionOrder>["data"]>;
  stageIndex: number;
}) {
  const { data: activities = [] } = useProductionActivities(order.id);
  const stage = currentProductionStage(activities);
  const pct = computeProgress(order.processes);

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[16/10] w-full bg-primary-soft">
        <DesignImage path={order.imagePath ?? null} alt={order.designName ?? ""} />
      </div>

      <div className="grid gap-4 p-3 sm:p-5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold tracking-widest text-muted-foreground">{order.code}</p>
          <h2 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{order.designName}</h2>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {order.customer} · Started {new Date(order.startDate).toLocaleDateString()}
            {order.supervisor ? ` · Supervisor ${order.supervisor}` : ""}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Fact label="Order Qty" value={`${order.orderQuantity.toLocaleString()} Pcs`} />
          <Fact label="Current Stage" value={stage.label} />
          <Fact label="Progress" value={`${pct}%`} />
          <FactoryStatusFact />
        </div>

        <div className="min-w-0 rounded-2xl border border-border bg-background p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-bold">Workflow Progress</p>
            <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary">
              {PRODUCTION_STAGES[stageIndex].label}
            </span>
          </div>
          <ol className="mt-3 flex items-start gap-1 sm:gap-1.5">
            {PRODUCTION_STAGES.map((step, i) => {
              const n = i + 1;
              const done = i < stageIndex;
              const current = i === stageIndex;
              return (
                <li key={step.id} className="flex min-w-0 flex-1 flex-col items-center gap-1 sm:gap-1.5">
                  <div className="flex w-full items-center gap-1 sm:gap-1.5">
                    <span
                      className={
                        "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-bold transition sm:h-8 sm:w-8 sm:text-[11px] " +
                        (done
                          ? "bg-primary text-primary-foreground"
                          : current
                            ? "bg-primary text-primary-foreground ring-[3px] ring-primary/30 sm:ring-[5px]"
                            : "bg-muted text-muted-foreground")
                      }
                    >
                      {done ? "✓" : n}
                    </span>
                    {i < PRODUCTION_STAGES.length - 1 && (
                      <span
                        className={"h-0.5 min-w-0 flex-1 rounded-full " + (i < stageIndex ? "bg-primary" : "bg-muted")}
                      />
                    )}
                  </div>
                  <span
                    className={
                      "hidden w-full truncate text-center text-[9px] font-semibold leading-tight sm:block " +
                      (current ? "text-primary" : done ? "text-foreground" : "text-muted-foreground")
                    }
                    title={step.label}
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
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

function FactoryStatusFact() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  const status = factoryStatusAt(now, DEFAULT_FACTORY_CALENDAR);
  const label =
    status.kind === "working"
      ? "Working"
      : status.kind === "break"
        ? `${status.name} Break`
        : status.reason === "off-hours"
          ? "Closed"
          : status.reason === "weekly-off"
            ? "Weekly Off"
            : "Holiday";
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Factory · {formatClock(now)}
      </p>
      <p
        className={cn(
          "mt-1 truncate text-sm font-bold",
          status.kind === "working" && "text-success",
          status.kind === "break" && "text-warning",
          status.kind === "closed" && "text-muted-foreground",
        )}
      >
        {label}
      </p>
    </div>
  );
}

/* ---------- Materials tab: Bulk Requirement (per-piece × order qty, merged) ---------- */

type BulkRequirement = {
  materialId: string;
  name: string;
  code: string;
  unit: string;
  availableStock: number;
  perPiece: number;
  required: number;
  reserved: number;
  remaining: number;
  parts: { part: string; qty: number }[];
};

function MaterialsPanel({
  designId,
  productionOrderId,
  orderQuantity,
  onContinue,
}: {
  designId: string;
  productionOrderId: string;
  orderQuantity: number;
  onContinue: () => void;
}) {
  const { data: selected = [], isLoading } = useDesignMaterials(designId);
  const { data: reservations = [] } = useProductionReservations(productionOrderId);
  const [reserveFor, setReserveFor] = useState<BulkRequirement | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSample, setShowSample] = useState(false);

  const requirements = useMemo<BulkRequirement[]>(() => {
    const byMat = new Map<string, BulkRequirement>();
    for (const row of selected) {
      if (!row.material) continue;
      const partLabel = row.groupName.split("::")[0] || "Other";
      const existing = byMat.get(row.materialId);
      if (existing) {
        existing.perPiece += row.quantity;
        existing.required = existing.perPiece * orderQuantity;
        existing.parts.push({ part: partLabel, qty: row.quantity });
      } else {
        byMat.set(row.materialId, {
          materialId: row.materialId,
          name: row.material.name,
          code: row.material.code,
          unit: row.material.unit,
          availableStock: row.material.availableStock,
          perPiece: row.quantity,
          required: row.quantity * orderQuantity,
          reserved: 0,
          remaining: 0,
          parts: [{ part: partLabel, qty: row.quantity }],
        });
      }
    }
    for (const r of reservations) {
      const rec = byMat.get(r.materialId);
      if (rec) rec.reserved += r.quantity;
    }
    for (const rec of byMat.values()) {
      rec.remaining = Math.max(0, rec.required - rec.reserved);
    }
    return Array.from(byMat.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [selected, reservations, orderQuantity]);

  const totalRequired = requirements.reduce((s, r) => s + r.required, 0);
  const totalReserved = requirements.reduce((s, r) => s + r.reserved, 0);
  const totalRemaining = requirements.reduce((s, r) => s + r.remaining, 0);
  const allReady = requirements.length > 0 && totalRemaining === 0;

  return (
    <div className="grid gap-3">
      {/* Readiness banner */}
      <div className="grid gap-3 rounded-2xl border border-border bg-gradient-to-br from-primary-soft to-background p-4 sm:grid-cols-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Production Qty</p>
          <p className="mt-0.5 text-xl font-extrabold">{orderQuantity.toLocaleString()} pcs</p>
          <p className="text-[11px] text-muted-foreground">
            {requirements.length} material{requirements.length === 1 ? "" : "s"} required
          </p>
        </div>
        <ReadinessStat label="Estimated" value={totalRequired} tone="default" />
        <ReadinessStat label="Reserved" value={totalReserved} tone="primary" />
        <ReadinessStat label="Remaining" value={totalRemaining} tone={allReady ? "success" : "warning"} />
      </div>

      {allReady ? (
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-semibold text-success">
          <CheckCircle2 className="h-4 w-4" /> All materials fully reserved — ready to start production.
        </div>
      ) : requirements.length > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm font-semibold text-warning">
          <Clock className="h-4 w-4" />
          {totalRemaining.toLocaleString(undefined, { maximumFractionDigits: 2 })} unit
          {totalRemaining === 1 ? "" : "s"} still to be reserved before production can start.
        </div>
      ) : null}

      {/* Requirement table */}
      {isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : requirements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <Layers className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No materials in the approved sample BOM.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2.5">
            <p className="text-sm font-bold">Bulk Material Requirement</p>
            <p className="text-[11px] text-muted-foreground">Sample per-piece × {orderQuantity} pcs</p>
          </div>
          <ul className="divide-y divide-border">
            {requirements.map((r) => {
              const short = r.availableStock < r.remaining;
              const done = r.remaining === 0;
              const open = expandedId === r.materialId;
              const breakdownTotal = r.parts.reduce((s, p) => s + p.qty * orderQuantity, 0);
              return (
                <li key={r.materialId}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : r.materialId)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent/40"
                  >
                    <span className="mt-1 text-muted-foreground">
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">{r.name}</p>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {r.code}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] sm:grid-cols-5">
                        <Stat label="Per Piece" value={`${r.perPiece} ${r.unit}`} />
                        <Stat
                          label="Estimated Qty"
                          value={`${r.required.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${r.unit}`}
                          bold
                        />
                        <Stat
                          label="Available"
                          value={`${r.availableStock.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${r.unit}`}
                          tone={short ? "danger" : "muted"}
                        />
                        <Stat
                          label="Reserved"
                          value={`${r.reserved.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${r.unit}`}
                          tone="primary"
                        />
                        <Stat
                          label="Remaining to Reserve"
                          value={`${r.remaining.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${r.unit}`}
                          tone={done ? "success" : "warning"}
                          bold
                        />
                      </div>
                    </div>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setReserveFor(r);
                      }}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold",
                        done
                          ? "border-border bg-background text-muted-foreground hover:bg-accent"
                          : "border-primary bg-primary text-primary-foreground hover:opacity-90",
                      )}
                    >
                      <Layers className="h-3 w-3" /> Reserve
                    </span>
                  </button>
                  {open && (
                    <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Breakdown
                      </p>
                      <ul className="mt-2 divide-y divide-border/60 rounded-lg border border-border/60 bg-background">
                        {r.parts.map((p, i) => (
                          <li
                            key={`${p.part}-${i}`}
                            className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2 text-xs"
                          >
                            <span className="font-medium">{p.part}</span>
                            <span className="font-mono text-muted-foreground">
                              {p.qty} {r.unit} × {orderQuantity} pcs ={" "}
                              <span className="font-bold text-foreground">
                                {(p.qty * orderQuantity).toLocaleString(undefined, {
                                  maximumFractionDigits: 2,
                                })}{" "}
                                {r.unit}
                              </span>
                            </span>
                          </li>
                        ))}
                        <li className="flex items-center justify-between bg-muted/40 px-3 py-2 text-xs">
                          <span className="font-semibold">Total Estimated</span>
                          <span className="font-mono font-bold">
                            {breakdownTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} {r.unit}
                          </span>
                        </li>
                      </ul>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        Breakdown is for reference only. Reserve stock from the material row above.
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Existing reservations */}
      {reservations.length > 0 && (
        <ReservationList
          productionOrderId={productionOrderId}
          reservations={reservations}
          requirements={requirements}
        />
      )}

      {/* Sample BOM reference (collapsed) */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <button
          onClick={() => setShowSample((s) => !s)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-left"
        >
          <div>
            <p className="text-sm font-bold">Sample BOM (per piece) — reference</p>
            <p className="text-[11px] text-muted-foreground">
              Original quantities from the approved sample, grouped by garment part.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-primary">{showSample ? "Hide" : "Show"}</span>
        </button>
        {showSample && (
          <div className="border-t border-border/60 p-3">
            <SampleReference selected={selected} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/inventory"
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-primary hover:bg-primary-soft/40"
        >
          <Layers className="h-3.5 w-3.5" /> Open Inventory
        </Link>
        <button
          onClick={onContinue}
          disabled={!allReady}
          title={allReady ? undefined : "Reserve all required materials to continue"}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to Bulk Production <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {reserveFor && (
        <ReserveDialog
          productionOrderId={productionOrderId}
          requirement={reserveFor}
          onClose={() => setReserveFor(null)}
        />
      )}
    </div>
  );
}

function ReadinessStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "primary" | "success" | "warning";
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-extrabold",
          tone === "primary" && "text-primary",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
        )}
      >
        {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
  bold = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "muted" | "primary" | "success" | "warning" | "danger";
  bold?: boolean;
}) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-mono text-[11px]",
          bold && "font-bold",
          tone === "muted" && "text-muted-foreground",
          tone === "primary" && "text-primary",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-destructive font-semibold",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SampleReference({ selected }: { selected: DesignMaterial[] }) {
  const byPart = new Map<string, DesignMaterial[]>();
  for (const row of selected) {
    const key = row.groupName.split("::")[0] || "Other";
    byPart.set(key, [...(byPart.get(key) ?? []), row]);
  }
  if (byPart.size === 0) {
    return <p className="text-xs text-muted-foreground">No sample materials recorded.</p>;
  }
  return (
    <div className="grid gap-2">
      {Array.from(byPart.entries()).map(([part, rows]) => (
        <div key={part} className="rounded-xl border border-border bg-background">
          <div className="border-b border-border/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {part}
          </div>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                <span className="truncate font-semibold">{r.material?.name ?? "—"}</span>
                <span className="shrink-0 text-muted-foreground">
                  {r.quantity} {r.material?.unit ?? ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ReservationList({
  productionOrderId,
  reservations,
  requirements,
}: {
  productionOrderId: string;
  reservations: ProductionReservation[];
  requirements: BulkRequirement[];
}) {
  const remove = useRemoveReservation(productionOrderId);
  const nameOf = new Map(requirements.map((r) => [r.materialId, { name: r.name, unit: r.unit }]));
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border/60 bg-muted/40 px-4 py-2.5">
        <p className="text-sm font-bold">Reserved Rolls / Lots</p>
        <p className="text-[11px] text-muted-foreground">Inventory earmarked for this production order.</p>
      </div>
      <ul className="divide-y divide-border">
        {reservations.map((r) => {
          const info = nameOf.get(r.materialId);
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{info?.name ?? "Material"}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {r.lotCode ? `Lot / Roll: ${r.lotCode}` : "No lot code"}
                  {r.notes ? ` · ${r.notes}` : ""}
                </p>
              </div>
              <p className="shrink-0 font-bold">
                {r.quantity} {info?.unit ?? ""}
              </p>
              <button
                onClick={() => {
                  if (window.confirm("Release this reservation?")) remove.mutate(r.id);
                }}
                className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:bg-accent"
                aria-label="Release reservation"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReserveDialog({
  productionOrderId,
  requirement,
  onClose,
}: {
  productionOrderId: string;
  requirement: BulkRequirement;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState<number>(requirement.remaining);
  const [lotCode, setLotCode] = useState("");
  const [notes, setNotes] = useState("");
  const add = useAddReservation(productionOrderId);
  const exceedsStock = quantity > requirement.availableStock;

  async function submit() {
    if (quantity <= 0) return;
    await add.mutateAsync({ materialId: requirement.materialId, quantity, lotCode, notes });
    onClose();
  }

  return (
    <DialogShell
      title="Reserve Material"
      subtitle={`${requirement.name} · ${requirement.remaining} ${requirement.unit} remaining`}
      onClose={onClose}
    >
      <div className="grid gap-4 p-5">
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/50 p-3 text-center text-xs">
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Required</p>
            <p className="mt-0.5 font-bold">
              {requirement.required} {requirement.unit}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Reserved</p>
            <p className="mt-0.5 font-bold text-primary">
              {requirement.reserved} {requirement.unit}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">In Stock</p>
            <p className="mt-0.5 font-bold">
              {requirement.availableStock} {requirement.unit}
            </p>
          </div>
        </div>
        <Field label="Barcode / Roll / Lot Code">
          <input
            value={lotCode}
            onChange={(e) => setLotCode(e.target.value)}
            placeholder="e.g. ROLL-2410-08"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label={`Reserve Quantity (${requirement.unit})`}>
          <input
            type="number"
            min={0}
            step="0.01"
            value={quantity || ""}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          {exceedsStock && (
            <p className="mt-1 text-[11px] font-semibold text-destructive">
              Exceeds available inventory ({requirement.availableStock} {requirement.unit}).
            </p>
          )}
        </Field>
        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Warehouse bin, supplier, remarks…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        {add.error && <p className="text-xs text-destructive">{(add.error as Error).message}</p>}
      </div>
      <DialogFooter onCancel={onClose}>
        <button
          onClick={submit}
          disabled={add.isPending || quantity <= 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
          Reserve Stock
        </button>
      </DialogFooter>
    </DialogShell>
  );
}

/* ---------- Bulk Production tab ---------- */

function BulkProductionPanel({
  productionOrderId,
  orderQuantity,
  onContinue,
}: {
  productionOrderId: string;
  orderQuantity: number;
  onContinue: () => void;
}) {
  const { data: activities = [], isLoading } = useProductionActivities(productionOrderId);
  const [startOpen, setStartOpen] = useState(false);
  const [completeFor, setCompleteFor] = useState<ProductionActivity | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const running = activities.filter((a) => a.status === "running");
  const completed = activities.filter((a) => a.status === "completed");

  return (
    <div className="grid gap-4">
      <button
        onClick={() => setStartOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-bold text-primary-foreground shadow-sm hover:opacity-90"
      >
        <PlayCircle className="h-5 w-5" /> Start Production
      </button>

      {/* Running Activities */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Running Activities</p>
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">
            {running.length}
          </span>
        </div>
        {isLoading ? (
          <div className="mt-3 grid place-items-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : running.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No activities running right now.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {running.map((a) => (
              <RunningActivityCard
                key={a.id}
                activity={a}
                productionOrderId={productionOrderId}
                onComplete={() => setCompleteFor(a)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Completed Activities */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Completed Activities</p>
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success">
            {completed.length}
          </span>
        </div>
        {completed.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No completed activities yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {completed.map((a) => (
              <CompletedActivityRow key={a.id} activity={a} />
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onContinue}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
        >
          View Production Summary <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {startOpen && (
        <StartActivityDialog
          productionOrderId={productionOrderId}
          orderQuantity={orderQuantity}
          onClose={() => setStartOpen(false)}
        />
      )}
      {completeFor && (
        <CompleteActivityDialog
          activity={completeFor}
          productionOrderId={productionOrderId}
          onClose={() => setCompleteFor(null)}
        />
      )}
    </div>
  );
}

// Running Activities re-render every second via the parent's tick timer
// (see ActivitiesSection). `now` is recomputed fresh on every one of those
// renders, so this always reflects the true current second — nothing here
// is cached or frozen at mount time. Effective Working Time is the only
// number shown live: it already excludes off-hours, weekly-off days, and
// every break window automatically (effectiveWorkingSeconds), including
// pausing through a break and resuming after it ends, since it's
// recomputed from the factory calendar on every tick rather than just
// counted up.
function RunningActivityCard({
  activity,
  productionOrderId,
  onComplete,
}: {
  activity: ProductionActivity;
  productionOrderId: string;
  onComplete: () => void;
}) {
  const now = new Date();
  const start = new Date(activity.startedAt);
  const effective = effectiveWorkingSeconds(start, now);
  const cancel = useCancelActivity(productionOrderId);

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary-soft/30 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
            {ACTIVITY_OP_NAME[activity.operationId]}
          </p>
          <p className="mt-0.5 truncate text-sm font-bold">{activity.assignedTo}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
          🟢 Running
        </span>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" /> Started:
        <span className="font-bold text-foreground">{formatClock(start)}</span>
      </p>

      <div className="mt-2 rounded-xl border border-primary/20 bg-background/70 p-3 text-center">
        <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <Timer className="h-3 w-3" /> Live Timer · Effective Working Time
        </p>
        <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums text-primary">{formatHMS(effective)}</p>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Issued Qty: <span className="font-bold text-foreground">{activity.issuedQty} pcs</span>
      </p>

      {activity.notes && (
        <p className="mt-2 rounded-lg bg-background/60 px-2 py-1.5 text-xs text-muted-foreground">{activity.notes}</p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          onClick={onComplete}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-success px-3 py-2 text-xs font-bold text-success-foreground hover:opacity-90"
        >
          <StopCircle className="h-3.5 w-3.5" /> Complete
        </button>
        <button
          onClick={() => {
            if (window.confirm("Cancel this activity? Time is not counted.")) cancel.mutate(activity.id);
          }}
          disabled={cancel.isPending}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-accent"
        >
          <XCircle className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// Completed activities never tick — they only ever display the final
// values already saved to the database (elapsedSeconds/effectiveSeconds,
// stamped once at Complete), never a live recomputation.
function CompletedActivityRow({ activity }: { activity: ProductionActivity }) {
  return (
    <li className="grid gap-2 rounded-2xl border border-border bg-background p-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold">{ACTIVITY_OP_NAME[activity.operationId]}</p>
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">Completed</span>
          <span className="truncate text-muted-foreground">{activity.assignedTo}</span>
        </div>
        <div className="mt-1.5 grid gap-0.5 text-[11px] text-muted-foreground">
          <p>
            Started: <span className="font-bold text-foreground">{formatClock(new Date(activity.startedAt))}</span>
          </p>
          {activity.completedAt && (
            <p>
              Completed:{" "}
              <span className="font-bold text-foreground">{formatClock(new Date(activity.completedAt))}</span>
            </p>
          )}
          {activity.effectiveSeconds != null && (
            <p>
              Total Effective Time:{" "}
              <span className="font-mono font-bold text-foreground">{formatHMS(activity.effectiveSeconds)}</span>
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 sm:justify-end">
        <span className="text-[11px] text-muted-foreground">
          📦 {activity.issuedQty} → 📥 {activity.returnedQty ?? "—"}
        </span>
      </div>
    </li>
  );
}

/* ---------- Summary tab ---------- */

function SummaryPanel({ productionOrderId, orderQuantity }: { productionOrderId: string; orderQuantity: number }) {
  const { data: activities = [], isLoading } = useProductionActivities(productionOrderId);
  const completed = activities.filter((a) => a.status === "completed");

  const totalIssued = activities.reduce((s, a) => s + a.issuedQty, 0);
  const totalReturned = completed.reduce((s, a) => s + (a.returnedQty ?? 0), 0);
  const totalEffective = completed.reduce((s, a) => s + (a.effectiveSeconds ?? 0), 0);
  const totalElapsed = completed.reduce((s, a) => s + (a.elapsedSeconds ?? 0), 0);

  // Per-operation rollup
  const perOp = ACTIVITY_OPERATIONS.map((op) => {
    const rows = completed.filter((a) => a.operationId === op.id);
    const issued = rows.reduce((s, a) => s + a.issuedQty, 0);
    const returned = rows.reduce((s, a) => s + (a.returnedQty ?? 0), 0);
    const eff = rows.reduce((s, a) => s + (a.effectiveSeconds ?? 0), 0);
    return { op, count: rows.length, issued, returned, eff };
  }).filter((r) => r.count > 0);

  if (isLoading) {
    return (
      <div className="grid place-items-center rounded-2xl border border-border bg-card p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard label="Order Qty" value={`${orderQuantity} pcs`} />
        <SummaryCard label="Issued" value={`${totalIssued} pcs`} />
        <SummaryCard label="Returned" value={`${totalReturned} pcs`} />
        <SummaryCard
          label="Effective Time"
          value={formatDuration(totalEffective)}
          subtitle={`Elapsed ${formatDuration(totalElapsed)}`}
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-bold">Per-Operation Rollup</p>
          <p className="text-[11px] text-muted-foreground">
            Effective working time excludes break windows, off-hours, and weekly-off days.
          </p>
        </div>
        {perOp.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No completed activities yet — start production to see the rollup.
          </div>
        ) : (
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Operation</th>
                <th className="px-4 py-2.5 text-right">Activities</th>
                <th className="px-4 py-2.5 text-right">Issued</th>
                <th className="px-4 py-2.5 text-right">Returned</th>
                <th className="px-4 py-2.5 text-right">Effective</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {perOp.map((r) => (
                <tr key={r.op.id}>
                  <td className="px-4 py-2.5 font-semibold">{r.op.name}</td>
                  <td className="px-4 py-2.5 text-right">{r.count}</td>
                  <td className="px-4 py-2.5 text-right">{r.issued}</td>
                  <td className="px-4 py-2.5 text-right">{r.returned}</td>
                  <td className="px-4 py-2.5 text-right">{formatDuration(r.eff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <FileCheck2 className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-bold">Activity Log</p>
        </div>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activities recorded yet.</p>
        ) : (
          <ul className="grid gap-2">
            {activities.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-3 text-xs"
              >
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                  {ACTIVITY_OP_NAME[a.operationId]}
                </span>
                <span className="font-semibold">{a.assignedTo}</span>
                <span className="text-muted-foreground">· 📦 {a.issuedQty}</span>
                {a.returnedQty != null && <span className="text-muted-foreground">→ 📥 {a.returnedQty}</span>}
                <span className="ml-auto text-muted-foreground">
                  {formatClock(new Date(a.startedAt))}
                  {a.completedAt ? ` – ${formatClock(new Date(a.completedAt))}` : ""}
                  {a.effectiveSeconds != null ? ` · ⏱ ${formatDuration(a.effectiveSeconds)}` : ""}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    a.status === "running" && "bg-primary text-primary-foreground",
                    a.status === "completed" && "bg-success/15 text-success",
                    a.status === "cancelled" && "bg-muted text-muted-foreground",
                  )}
                >
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-extrabold">{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

/* ---------- Dialogs ---------- */

function StartActivityDialog({
  productionOrderId,
  orderQuantity,
  onClose,
}: {
  productionOrderId: string;
  orderQuantity: number;
  onClose: () => void;
}) {
  const [operationId, setOperationId] = useState<ActivityOperationId | "">("");
  const [assignedTo, setAssignedTo] = useState("");
  const [issuedQty, setIssuedQty] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const start = useStartActivity(productionOrderId);

  async function submit() {
    if (!operationId || !assignedTo.trim() || issuedQty < 1) return;
    await start.mutateAsync({
      operationId,
      assignedTo: assignedTo.trim(),
      issuedQty,
      notes,
    });
    onClose();
  }

  return (
    <DialogShell title="Start Production" subtitle="Log a new bulk production activity" onClose={onClose}>
      <div className="grid gap-4 p-5">
        <Field label="Select Activity">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ACTIVITY_OPERATIONS.map((op) => (
              <button
                key={op.id}
                type="button"
                onClick={() => setOperationId(op.id)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs font-bold",
                  operationId === op.id
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-background text-foreground hover:bg-accent",
                )}
              >
                {op.name}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Assign Worker / Team / Line">
          <input
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="e.g. HW Team 01 / Line 2 / Vendor X"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label={`Issue Quantity (Order ${orderQuantity} pcs)`}>
          <input
            type="number"
            min={1}
            value={issuedQty || ""}
            onChange={(e) => setIssuedQty(Number(e.target.value))}
            placeholder="e.g. 40"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any instructions or remarks"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        {start.error && <p className="text-xs text-destructive">{(start.error as Error).message}</p>}
      </div>
      <DialogFooter onCancel={onClose}>
        <button
          onClick={submit}
          disabled={start.isPending || !operationId || !assignedTo.trim() || issuedQty < 1}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {start.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
          Start Activity
        </button>
      </DialogFooter>
    </DialogShell>
  );
}

function CompleteActivityDialog({
  activity,
  productionOrderId,
  onClose,
}: {
  activity: ProductionActivity;
  productionOrderId: string;
  onClose: () => void;
}) {
  const [returned, setReturned] = useState<number>(activity.issuedQty);
  const complete = useCompleteActivity(productionOrderId);
  const now = new Date();
  const start = new Date(activity.startedAt);
  const eff = effectiveWorkingSeconds(start, now);
  const elp = elapsedSeconds(start, now);

  async function submit() {
    await complete.mutateAsync({ activity, returnedQty: returned });
    onClose();
  }

  return (
    <DialogShell title="Complete Activity" subtitle={ACTIVITY_OP_NAME[activity.operationId]} onClose={onClose}>
      <div className="grid gap-4 p-5">
        <div className="rounded-xl bg-muted/50 p-3 text-xs">
          <RowKV k="Assigned To" v={activity.assignedTo} />
          <RowKV k="Issued Qty" v={`${activity.issuedQty} pcs`} />
          <RowKV k="Started" v={formatClock(start)} />
          <RowKV k="End (now)" v={formatClock(now)} />
          <RowKV k="Elapsed" v={formatDuration(elp)} />
          <RowKV k="Effective Working" v={formatDuration(eff)} />
        </div>
        <Field label="Return Quantity">
          <input
            type="number"
            min={0}
            value={returned}
            onChange={(e) => setReturned(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Coffee className="h-3 w-3" /> Break windows and non-working hours are excluded automatically.
        </p>
        {complete.error && <p className="text-xs text-destructive">{(complete.error as Error).message}</p>}
      </div>
      <DialogFooter onCancel={onClose}>
        <button
          onClick={submit}
          disabled={complete.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-success px-4 py-2 text-xs font-bold text-success-foreground hover:opacity-90 disabled:opacity-60"
        >
          {complete.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          Complete Activity
        </button>
      </DialogFooter>
    </DialogShell>
  );
}

function RowKV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-bold">{v}</span>
    </div>
  );
}

function DialogShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-base font-bold">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DialogFooter({ onCancel, children }: { onCancel: () => void; children: React.ReactNode }) {
  return (
    <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
      <button
        onClick={onCancel}
        className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-accent"
      >
        Cancel
      </button>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
