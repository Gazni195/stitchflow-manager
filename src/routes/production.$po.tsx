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
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Factory,
  FileCheck2,
  GripVertical,
  Layers,
  Loader2,
  PauseCircle,
  PlayCircle,
  Printer,
  Save,
  Settings2,
  StopCircle,
  Timer,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DesignImage } from "@/components/DesignImage";
import { useRequireAuth } from "@/hooks/use-auth";
import {
  useProductionOrder,
  computeProgress,
  useUpdateProductionWorkflow,
  useCompleteProductionOrder,
  PROCESS_OPERATIONS,
  OP_NAME,
  type ProcessOperationId,
  type ProductionProcess,
} from "@/lib/api/production";
import { useWorkstationOptions, workstationTypeKeyForOperation, useWorkstationTypes } from "@/lib/api/workstations";
import {
  ACTIVITY_OPERATIONS,
  ACTIVITY_OP_NAME,
  availableInputForOperation,
  computeSizeSets,
  currentProductionQuantity,
  currentProductionStage,
  DEFAULT_SET_TEMPLATE,
  findCuttingBundle,
  nextConfiguredOperation,
  SET_TEMPLATES,
  STANDARD_SIZES,
  SMALL_SIZES,
  PLUS_SIZES,
  sumSizeBreakdown,
  useAssignActivity,
  useBeginActivity,
  useCancelActivity,
  useCompleteActivity,
  usePauseActivity,
  useProductionActivities,
  useResumeActivity,
  useStartActivity,
  type ActivityOperationId,
  type ProductionActivity,
  type SizeBreakdown,
  type SizeCode,
  type SetTemplateId,
} from "@/lib/api/production-activities";
import { useDesignMaterials, type DesignMaterial } from "@/lib/api/materials";
import { calcProductionPerPiece, calcSetsPossible } from "@/lib/production-calc";
import { useProductionReservations, useAddReservation, useRemoveReservation } from "@/lib/api/production-reservations";
import {
  DEFAULT_FACTORY_CALENDAR,
  effectiveWorkingSeconds,
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
        <ProductionHeader order={order} />

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
                processes={order.processes ?? []}
                orderStatus={order.status}
                completedAt={order.completedAt}
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

// Workflow Progress here is never a fixed set of tabs — it always walks the
// production order's own configured operations (production_processes,
// sequence-ordered, seeded from Start Production → Step 2 / edited via
// "Edit Workflow" on the Bulk Production tab).
function ProductionHeader({ order }: { order: NonNullable<ReturnType<typeof useProductionOrder>["data"]> }) {
  const { data: activities = [] } = useProductionActivities(order.id);
  const steps = useMemo(() => [...(order.processes ?? [])].sort((a, b) => a.sequence - b.sequence), [order.processes]);
  const configuredOps = useMemo(() => steps.map((s) => s.operationId), [steps]);
  const stage = currentProductionStage(activities, configuredOps);
  const cuttingBundle = findCuttingBundle(activities);
  const currentQty = currentProductionQuantity(order.orderQuantity, activities);

  // Done/current here always come from the operator's real activity log
  // (production_activities), the same source Running/Completed Activities
  // and the workflow list on the Bulk Production tab use — never from
  // production_processes.status, which this screen doesn't advance.
  const completedOpIds = useMemo(
    () => new Set(activities.filter((a) => a.status === "completed").map((a) => a.operationId)),
    [activities],
  );
  const pct = steps.length
    ? Math.round((steps.filter((s) => completedOpIds.has(s.operationId)).length / steps.length) * 100)
    : 0;
  const currentIdx = steps.findIndex((s) => !completedOpIds.has(s.operationId));

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

        <div
          className={cn(
            "grid grid-cols-2 gap-2",
            cuttingBundle
              ? order.status === "completed"
                ? "sm:grid-cols-6"
                : "sm:grid-cols-5"
              : order.status === "completed"
                ? "sm:grid-cols-5"
                : "sm:grid-cols-4",
          )}
        >
          <Fact label="Planned Qty" value={`${order.orderQuantity.toLocaleString()} Pcs`} />
          {cuttingBundle && <Fact label="Current Prod. Qty" value={`${currentQty.toLocaleString()} Pcs`} />}
          <Fact label="Current Stage" value={order.status === "completed" ? "Completed" : stage.label} />
          <Fact label="Progress" value={`${pct}%`} />
          {order.status === "completed" && order.completedAt && (
            <Fact label="Completed Date" value={new Date(order.completedAt).toLocaleDateString()} />
          )}
          <FactoryStatusFact />
        </div>

        <div className="min-w-0 rounded-2xl border border-border bg-background p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-bold">Workflow Progress</p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                order.status === "completed" ? "bg-success/15 text-success" : "bg-primary/15 text-primary",
              )}
            >
              {order.status === "completed" ? "Completed" : stage.label}
            </span>
          </div>
          {steps.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No workflow configured for this production order.</p>
          ) : (
            <ol className="mt-3 flex items-start gap-1 sm:gap-1.5">
              {steps.map((step, i) => {
                const n = i + 1;
                const done = completedOpIds.has(step.operationId);
                const current = i === currentIdx;
                const label = OP_NAME[step.operationId] ?? step.operationId;
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
                      {i < steps.length - 1 && (
                        <span className={"h-0.5 min-w-0 flex-1 rounded-full " + (done ? "bg-primary" : "bg-muted")} />
                      )}
                    </div>
                    <span
                      className={
                        "hidden w-full truncate text-center text-[9px] font-semibold leading-tight sm:block " +
                        (current ? "text-primary" : done ? "text-foreground" : "text-muted-foreground")
                      }
                      title={label}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
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

/* ---------- Materials tab: Material Allocation (Estimated Production from reserved bundles, merged duplicates) ---------- */

type ReservationRow = { id: string; label: string; quantity: number };

type BulkRequirement = {
  materialId: string;
  name: string;
  code: string;
  unit: string;
  /** Live inventory stock — not shown as a table column anymore, kept only for the Reserve dialog's over-reservation guard. */
  availableStock: number;
  consumptionRuleName: string | null;
  reductionPct: number;
  productionPerSet: number;
  reserved: number;
  required: number;
  reservationRows: ReservationRow[];
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSample, setShowSample] = useState(false);
  const removeReservation = useRemoveReservation(productionOrderId);

  // Sample BOM merged per material (per-set consumption, before reduction) plus its assigned Consumption Rule.
  const base = useMemo(() => {
    const byMat = new Map<
      string,
      {
        materialId: string;
        name: string;
        code: string;
        unit: string;
        availableStock: number;
        consumptionRuleName: string | null;
        reductionPct: number;
        samplePerSet: number;
      }
    >();
    for (const row of selected) {
      if (!row.material) continue;
      const existing = byMat.get(row.materialId);
      if (existing) {
        existing.samplePerSet += row.quantity;
        continue;
      }
      const rule =
        row.material.consumptionRule && row.material.consumptionRule.status === "active"
          ? row.material.consumptionRule
          : null;
      byMat.set(row.materialId, {
        materialId: row.materialId,
        name: row.material.name,
        code: row.material.code,
        unit: row.material.unit,
        availableStock: row.material.availableStock,
        consumptionRuleName: rule?.name ?? null,
        reductionPct: rule?.reductionPct ?? 0,
        samplePerSet: row.quantity,
      });
    }
    return Array.from(byMat.values());
  }, [selected]);

  // Estimated Production = the bottleneck Sets Possible across every material,
  // using Production Consumption (after Consumption Reduction) against what's
  // actually reserved — same math as Start Production, re-derived from the
  // real reservations. This is NOT the final production quantity; that's only
  // known once Bulk Cutting is complete.
  const estimatedSets = useMemo(() => {
    if (base.length === 0) return 0;
    const perMaterial = base.map((m) => {
      const reserved = reservations.filter((r) => r.materialId === m.materialId).reduce((s, r) => s + r.quantity, 0);
      const productionPerSet = calcProductionPerPiece(m.samplePerSet, m.reductionPct);
      return calcSetsPossible(reserved, productionPerSet);
    });
    return Math.min(...perMaterial);
  }, [base, reservations]);

  const requirements = useMemo<BulkRequirement[]>(() => {
    return base
      .map((m): BulkRequirement => {
        const rows: ReservationRow[] = reservations
          .filter((r) => r.materialId === m.materialId)
          .map((r) => ({
            id: r.id,
            label: r.bundleId
              ? `Bundle ${r.bundleNumber ?? "—"}`
              : r.lotCode
                ? `Lot: ${r.lotCode}`
                : "Manual Reservation",
            quantity: r.quantity,
          }));
        const reserved = rows.reduce((s, r) => s + r.quantity, 0);
        const productionPerSet = calcProductionPerPiece(m.samplePerSet, m.reductionPct);
        return {
          materialId: m.materialId,
          name: m.name,
          code: m.code,
          unit: m.unit,
          availableStock: m.availableStock,
          consumptionRuleName: m.consumptionRuleName,
          reductionPct: m.reductionPct,
          productionPerSet,
          reserved,
          required: Number((estimatedSets * productionPerSet).toFixed(2)),
          reservationRows: rows,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [base, reservations, estimatedSets]);

  const totalRequired = requirements.reduce((s, r) => s + r.required, 0);
  const totalReserved = requirements.reduce((s, r) => s + r.reserved, 0);
  const pendingCount = requirements.filter((r) => r.reserved < r.required - 0.001).length;
  const allReady = requirements.length > 0 && pendingCount === 0;

  return (
    <div className="grid gap-3">
      {/* Readiness banner */}
      <div className="grid gap-3 rounded-2xl border border-border bg-gradient-to-br from-primary-soft to-background p-4 sm:grid-cols-4">
        <ReadinessStat
          label="Estimated Production"
          value={`${estimatedSets.toLocaleString()} Sets`}
          tone="default"
          caption="Based on Consumption Rule"
        />
        <ReadinessStat
          label="Required Fabric"
          value={totalRequired.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          tone="default"
        />
        <ReadinessStat
          label="Reserved Fabric"
          value={totalReserved.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          tone="primary"
        />
        <ReadinessStat
          label="Reservation Status"
          value={requirements.length === 0 ? "—" : allReady ? "Fully Reserved" : `${pendingCount} Pending`}
          tone={requirements.length === 0 ? "default" : allReady ? "success" : "warning"}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Estimated Production is not the final production quantity — the final quantity is only available once Bulk
        Cutting is completed.
      </p>

      {allReady ? (
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-semibold text-success">
          <CheckCircle2 className="h-4 w-4" /> All materials fully reserved — ready to start production.
        </div>
      ) : requirements.length > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm font-semibold text-warning">
          <Clock className="h-4 w-4" />
          {pendingCount} material{pendingCount === 1 ? "" : "s"} still need{pendingCount === 1 ? "s" : ""} to be
          reserved before production can start.
        </div>
      ) : null}

      {/* Material Allocation */}
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
          <div className="border-b border-border/60 bg-muted/40 px-4 py-2.5">
            <p className="text-sm font-bold">Material Allocation</p>
            <p className="text-[11px] text-muted-foreground">Fabric reserved for this production order, by bundle.</p>
          </div>
          <ul className="divide-y divide-border">
            {requirements.map((r) => {
              const done = r.reserved >= r.required - 0.001;
              const open = expandedId === r.materialId;
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
                      <p className="truncate font-semibold">{r.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {r.consumptionRuleName ? `Rule: ${r.consumptionRuleName}` : "No Consumption Rule assigned"}
                      </p>
                      <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1.5 text-[11px]">
                        <Stat
                          label="Required"
                          value={`${r.required.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${r.unit}`}
                          bold
                        />
                        <Stat
                          label="Reserved"
                          value={`${r.reserved.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${r.unit}`}
                          tone="primary"
                          bold
                        />
                        <Stat
                          label="Bundles"
                          value={`${r.reservationRows.length} Bundle${r.reservationRows.length === 1 ? "" : "s"}`}
                          tone={done ? "success" : "warning"}
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
                        Reserved Bundles
                      </p>
                      {r.reservationRows.length === 0 ? (
                        <p className="mt-2 text-xs text-muted-foreground">No bundles reserved yet.</p>
                      ) : (
                        <ul className="mt-2 divide-y divide-border/60 rounded-lg border border-border/60 bg-background">
                          {r.reservationRows.map((row) => (
                            <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                              <span className="font-medium">{row.label}</span>
                              <span className="flex items-center gap-2">
                                <span className="font-mono font-bold">
                                  {row.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {r.unit}
                                </span>
                                <button
                                  onClick={() => {
                                    if (window.confirm("Release this reservation?")) removeReservation.mutate(row.id);
                                  }}
                                  className="rounded p-1 text-muted-foreground hover:bg-accent"
                                  aria-label="Release reservation"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPickerOpen(true)}
            disabled={requirements.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-primary hover:bg-primary-soft/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Layers className="h-3.5 w-3.5" /> Reserve Material
          </button>
          <button
            onClick={onContinue}
            disabled={!allReady}
            title={allReady ? undefined : "Reserve all required materials to continue"}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue to Bulk Production <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {pickerOpen && (
        <MaterialPickerDialog
          requirements={requirements}
          onPick={(r) => {
            setPickerOpen(false);
            setReserveFor(r);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

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

function MaterialPickerDialog({
  requirements,
  onPick,
  onClose,
}: {
  requirements: BulkRequirement[];
  onPick: (r: BulkRequirement) => void;
  onClose: () => void;
}) {
  return (
    <DialogShell title="Reserve Material" subtitle="Choose which fabric to reserve stock for." onClose={onClose}>
      <ul className="divide-y divide-border p-2">
        {requirements.map((r) => (
          <li key={r.materialId}>
            <button
              type="button"
              onClick={() => onPick(r)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-accent"
            >
              <span className="font-semibold">{r.name}</span>
              <span className="text-[11px] text-muted-foreground">
                {r.reserved.toLocaleString(undefined, { maximumFractionDigits: 2 })} /{" "}
                {r.required.toLocaleString(undefined, { maximumFractionDigits: 2 })} {r.unit}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </DialogShell>
  );
}

function ReadinessStat({
  label,
  value,
  tone,
  caption,
}: {
  label: string;
  value: string;
  tone: "default" | "primary" | "success" | "warning";
  caption?: string;
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
        {value}
      </p>
      {caption && <p className="mt-0.5 text-[10px] text-muted-foreground">{caption}</p>}
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

function ReserveDialog({
  productionOrderId,
  requirement,
  onClose,
}: {
  productionOrderId: string;
  requirement: BulkRequirement;
  onClose: () => void;
}) {
  const remaining = Math.max(0, requirement.required - requirement.reserved);
  const [quantity, setQuantity] = useState<number>(remaining);
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
      subtitle={`${requirement.name} · ${remaining} ${requirement.unit} remaining`}
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
  processes,
  orderStatus,
  completedAt,
  onContinue,
}: {
  productionOrderId: string;
  orderQuantity: number;
  processes: ProductionProcess[];
  orderStatus: "running" | "completed";
  completedAt: string | null;
  onContinue: () => void;
}) {
  const { data: activities = [], isLoading } = useProductionActivities(productionOrderId);
  const [startFor, setStartFor] = useState<{
    operationId: ActivityOperationId;
    source: "sequence" | "additional";
  } | null>(null);
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const [completeFor, setCompleteFor] = useState<ProductionActivity | null>(null);
  const [editWorkflowOpen, setEditWorkflowOpen] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const completeOrder = useCompleteProductionOrder();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const running = activities.filter((a) => a.status === "running" || a.status === "paused");
  const pending = activities.filter((a) => a.status === "pending");
  const completed = activities.filter((a) => a.status === "completed");
  const cuttingBundle = findCuttingBundle(activities);
  const currentQty = currentProductionQuantity(orderQuantity, activities);
  const cancelPending = useCancelActivity();

  // The configured workflow, in the exact order saved by Start Production →
  // Step 2 (or since edited via "Edit Workflow" below) — never a hardcoded
  // sequence. This is the single source of truth for the list, the Next
  // Operation gating, and what "Add Additional Operation" is allowed to add.
  const sortedProcesses = useMemo(() => [...processes].sort((a, b) => a.sequence - b.sequence), [processes]);
  const configuredOps = useMemo(
    () => sortedProcesses.map((p) => p.operationId as ActivityOperationId),
    [sortedProcesses],
  );
  const nextOp = nextConfiguredOperation(configuredOps, activities);
  const completedOpIds = useMemo(() => new Set(completed.map((a) => a.operationId)), [completed]);
  const runningByOp = useMemo(() => new Map(running.map((a) => [a.operationId, a])), [running]);
  const pendingByOp = useMemo(() => new Map(pending.map((a) => [a.operationId, a])), [pending]);
  const additionalOperations = useMemo(
    () => ACTIVITY_OPERATIONS.map((o) => o.id).filter((id) => !configuredOps.includes(id)),
    [configuredOps],
  );

  // Every operation in the order's own configured workflow — never the
  // optional ones added via "Add Additional Operation" — is done, and none
  // of them has a pending/assigned/running/paused activity in flight. This
  // is the only gate for showing "Complete Production" below.
  const allConfiguredCompleted =
    sortedProcesses.length > 0 &&
    sortedProcesses.every((p) => completedOpIds.has(p.operationId as ActivityOperationId)) &&
    !sortedProcesses.some((p) => {
      const opId = p.operationId as ActivityOperationId;
      return pendingByOp.has(opId) || runningByOp.has(opId);
    });

  return (
    <div className="grid gap-4">
      {/* Configured workflow — compact operation list */}
      <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Production Workflow</p>
          {orderStatus === "completed" ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-success/15 px-2.5 py-1.5 text-[11px] font-bold text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Completed
            </span>
          ) : (
            <button
              onClick={() => setEditWorkflowOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:bg-accent"
            >
              <Settings2 className="h-3.5 w-3.5" /> Edit Workflow
            </button>
          )}
        </div>

        {sortedProcesses.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No workflow configured for this production order.
          </p>
        ) : (
          <ul className="mt-3 grid gap-1.5">
            {sortedProcesses.map((p, i) => {
              const opId = p.operationId as ActivityOperationId;
              const isCompleted = completedOpIds.has(opId);
              const runningActivity = runningByOp.get(opId);
              const isRunning = !!runningActivity;
              const pendingActivity = pendingByOp.get(opId);
              const isPending = !!pendingActivity;
              const isNext = !isCompleted && !isRunning && !isPending && opId === nextOp;
              const usesQueueForRow = !!workstationTypeKeyForOperation(opId);
              const statusLabel = isCompleted
                ? "Completed"
                : isRunning
                  ? runningActivity?.status === "paused"
                    ? "Paused"
                    : "Running"
                  : isPending
                    ? "Pending"
                    : "Not Started";
              return (
                <li
                  key={p.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
                    isRunning
                      ? "border-primary bg-primary-soft/40"
                      : isPending
                        ? "border-warning/30 bg-warning/5"
                        : isCompleted
                          ? "border-success/30 bg-success/5"
                          : "border-border bg-background",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                        isCompleted
                          ? "bg-success text-white"
                          : isRunning
                            ? "bg-primary text-primary-foreground"
                            : isPending
                              ? "bg-warning text-warning-foreground"
                              : "bg-muted text-muted-foreground",
                      )}
                    >
                      {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{ACTIVITY_OP_NAME[opId] ?? opId}</p>
                      <p
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wide",
                          isCompleted
                            ? "text-success"
                            : isRunning
                              ? "text-primary"
                              : isPending
                                ? "text-warning-foreground"
                                : "text-muted-foreground",
                        )}
                      >
                        {statusLabel}
                        {isPending && pendingActivity?.workstationId ? ` · ${pendingActivity.workstationId}` : ""}
                      </p>
                    </div>
                  </div>

                  {isCompleted ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-success">
                      <Check className="h-3.5 w-3.5" /> Completed
                    </span>
                  ) : isRunning ? (
                    <button
                      onClick={() => setCompleteFor(runningActivity)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90"
                    >
                      Resume
                    </button>
                  ) : isPending ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      {pendingActivity?.workstationId && (
                        <Link
                          to="/workstations/$code"
                          params={{ code: pendingActivity.workstationId }}
                          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:bg-accent"
                        >
                          View Queue
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          if (pendingActivity && window.confirm("Remove this pending assignment?")) {
                            cancelPending.mutate(pendingActivity);
                          }
                        }}
                        disabled={cancelPending.isPending}
                        className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:bg-accent"
                        aria-label="Remove pending assignment"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => isNext && setStartFor({ operationId: opId, source: "sequence" })}
                      disabled={!isNext}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                    >
                      <PlayCircle className="h-3.5 w-3.5" /> {usesQueueForRow ? "Assign" : "Start"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
          <p className="text-[11px] text-muted-foreground">
            {orderStatus === "completed"
              ? `Production order completed${completedAt ? ` on ${new Date(completedAt).toLocaleDateString()}` : ""}.`
              : running.length > 0
                ? "Finish the running activity before the next one opens."
                : pending.length > 0
                  ? "Waiting for the operator to start the pending assignment."
                  : nextOp
                    ? "The workflow advances automatically as each operation is completed."
                    : sortedProcesses.length > 0
                      ? "All production operations completed."
                      : "Use Edit Workflow to configure this order's operations."}
          </p>
          {orderStatus !== "completed" && (
            <button
              onClick={() => setAdditionalOpen(true)}
              className="shrink-0 text-[11px] font-bold text-primary hover:underline"
            >
              + Add Additional Operation
            </button>
          )}
        </div>

        {orderStatus === "running" && allConfiguredCompleted && (
          <button
            onClick={() => setConfirmComplete(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
          >
            <CheckCircle2 className="h-4 w-4" /> Complete Production
          </button>
        )}
      </div>

      {cuttingBundle && <CuttingSummaryCard cuttingBundle={cuttingBundle} currentQty={currentQty} />}

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
              <RunningActivityCard key={a.id} activity={a} onComplete={() => setCompleteFor(a)} />
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

      {startFor && (
        <StartActivityDialog
          productionOrderId={productionOrderId}
          orderQuantity={orderQuantity}
          currentQty={currentQty}
          preselectedOperation={startFor.operationId}
          allowOperationChange={startFor.source === "additional"}
          allowedOperations={startFor.source === "additional" ? additionalOperations : undefined}
          activities={activities}
          onClose={() => setStartFor(null)}
        />
      )}
      {additionalOpen && (
        <PickAdditionalOperationDialog
          operations={additionalOperations}
          onPick={(op) => {
            setAdditionalOpen(false);
            setStartFor({ operationId: op, source: "additional" });
          }}
          onClose={() => setAdditionalOpen(false)}
        />
      )}
      {completeFor && <CompleteActivityDialog activity={completeFor} onClose={() => setCompleteFor(null)} />}
      {editWorkflowOpen && (
        <EditWorkflowDialog
          productionOrderId={productionOrderId}
          processes={processes}
          activities={activities}
          onClose={() => setEditWorkflowOpen(false)}
        />
      )}
      {confirmComplete && (
        <CompleteProductionDialog
          busy={completeOrder.isPending}
          onClose={() => setConfirmComplete(false)}
          onConfirm={async () => {
            await completeOrder.mutateAsync(productionOrderId);
            setConfirmComplete(false);
          }}
        />
      )}
    </div>
  );
}

function CompleteProductionDialog({
  busy,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <DialogShell title="Complete Production Order?" onClose={onClose}>
      <div className="px-5 py-4 text-sm text-muted-foreground">
        All production operations are completed. Do you want to complete this Production Order?
      </div>
      <DialogFooter onCancel={onClose}>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Complete Production
        </button>
      </DialogFooter>
    </DialogShell>
  );
}

function PickAdditionalOperationDialog({
  operations,
  onPick,
  onClose,
}: {
  operations: ActivityOperationId[];
  onPick: (op: ActivityOperationId) => void;
  onClose: () => void;
}) {
  return (
    <DialogShell
      title="Add Additional Operation"
      subtitle="For exceptional steps outside this order's configured workflow"
      onClose={onClose}
    >
      <div className="grid gap-2 p-5">
        <div className="grid grid-cols-2 gap-2">
          {operations.map((id) => (
            <button
              key={id}
              onClick={() => onPick(id)}
              className="rounded-lg border border-border bg-background px-3 py-3 text-sm font-bold hover:bg-accent"
            >
              {ACTIVITY_OP_NAME[id]}
            </button>
          ))}
          {operations.length === 0 && (
            <p className="text-xs text-muted-foreground">No additional operations available.</p>
          )}
        </div>
      </div>
      <DialogFooter onCancel={onClose}>
        <span />
      </DialogFooter>
    </DialogShell>
  );
}

// Reuses the same "reorder + toggle" workflow-editing pattern as Start
// Production → Step 2 (see StartProductionWizard.tsx), but scoped to an
// already-started order: any operation that's pending, running, paused, or
// completed is locked in place (can't be removed or reordered) so history
// and in-flight workstation queue assignments are never corrupted; only
// the untouched, upcoming operations can be reordered, added, or removed.
function EditWorkflowDialog({
  productionOrderId,
  processes,
  activities,
  onClose,
}: {
  productionOrderId: string;
  processes: ProductionProcess[];
  activities: ProductionActivity[];
  onClose: () => void;
}) {
  const touchedOpIds = useMemo(
    () =>
      new Set(
        activities
          .filter(
            (a) =>
              a.status === "pending" || a.status === "running" || a.status === "paused" || a.status === "completed",
          )
          .map((a) => a.operationId),
      ),
    [activities],
  );
  const sortedExisting = useMemo(() => [...processes].sort((a, b) => a.sequence - b.sequence), [processes]);
  const touchedSteps = useMemo(
    () => sortedExisting.filter((p) => touchedOpIds.has(p.operationId as ActivityOperationId)),
    [sortedExisting, touchedOpIds],
  );
  // Seeded once from the order's current untouched processes; never
  // recomputed after that, so the user's own reordering/toggling in this
  // dialog is never overwritten by a background refetch while it's open.
  const [editableIds, setEditableIds] = useState<ProcessOperationId[]>(() =>
    sortedExisting.filter((p) => !touchedOpIds.has(p.operationId as ActivityOperationId)).map((p) => p.operationId),
  );
  const [enabled, setEnabled] = useState<Set<ProcessOperationId>>(
    () =>
      new Set(
        sortedExisting.filter((p) => !touchedOpIds.has(p.operationId as ActivityOperationId)).map((p) => p.operationId),
      ),
  );

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setEditableIds((prev) => {
      const oldIdx = prev.indexOf(active.id as ProcessOperationId);
      const newIdx = prev.indexOf(over.id as ProcessOperationId);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  function toggleOperation(id: ProcessOperationId) {
    if (touchedOpIds.has(id)) return;
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setEditableIds((ids) => ids.filter((x) => x !== id));
      } else {
        next.add(id);
        setEditableIds((ids) => [...ids, id]);
      }
      return next;
    });
  }

  const save = useUpdateProductionWorkflow(productionOrderId);
  const finalOrder = [...touchedSteps.map((p) => p.operationId), ...editableIds];

  function submit() {
    save.mutate({ operationIds: finalOrder, existing: processes }, { onSuccess: onClose });
  }

  return (
    <DialogShell
      title="Edit Workflow"
      subtitle="Reorder, add, or remove this order's upcoming operations"
      onClose={onClose}
    >
      <div className="grid gap-4 p-5">
        {touchedSteps.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Already Started — locked
            </p>
            <ul className="grid gap-1.5">
              {touchedSteps.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="font-semibold text-muted-foreground">{OP_NAME[p.operationId]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Upcoming Operations
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PROCESS_OPERATIONS.map((op) => {
              const locked = touchedOpIds.has(op.id);
              const on = enabled.has(op.id);
              return (
                <button
                  key={op.id}
                  type="button"
                  disabled={locked}
                  onClick={() => toggleOperation(op.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-bold",
                    on
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-accent",
                    locked && "cursor-not-allowed opacity-50",
                  )}
                >
                  {locked ? "✓" : on ? "✓" : "+"} {op.name}
                </button>
              );
            })}
          </div>

          {editableIds.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No upcoming operations selected.
            </p>
          ) : (
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={editableIds} strategy={verticalListSortingStrategy}>
                <ul className="mt-2 grid gap-2">
                  {editableIds.map((id, i) => (
                    <EditWorkflowRow key={id} operationId={id} index={touchedSteps.length + i} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {save.error && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-2 text-xs font-semibold text-destructive">
            {(save.error as Error).message}
          </p>
        )}
      </div>
      <DialogFooter onCancel={onClose}>
        <button
          onClick={submit}
          disabled={save.isPending || finalOrder.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Workflow
        </button>
      </DialogFooter>
    </DialogShell>
  );
}

function EditWorkflowRow({ operationId, index }: { operationId: ProcessOperationId; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: operationId });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn("rounded-xl border border-border bg-background p-2.5", isDragging && "shadow-lg")}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-accent active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{OP_NAME[operationId]}</span>
      </div>
    </li>
  );
}

// All Cutting reporting/analysis lives here, on the Production page, not in
// the Complete Activity popup — that popup is data entry only. Shown once
// Cutting has been completed at least once; Set Calculation has its own
// template picker so Planning/Marketing can flip templates when reviewing,
// independent of whatever the operator had selected while entering sizes.
function CuttingSummaryCard({
  cuttingBundle,
  currentQty,
}: {
  cuttingBundle: NonNullable<ReturnType<typeof findCuttingBundle>>;
  currentQty: number;
}) {
  const [setTemplate, setSetTemplate] = useState<SetTemplateId>(DEFAULT_SET_TEMPLATE);
  const setTemplateDef = SET_TEMPLATES.find((t) => t.id === setTemplate) ?? SET_TEMPLATES[0];
  const { completeSets, remaining } = computeSizeSets(cuttingBundle.bundle, setTemplateDef.sizes);
  const remainingEntries = Object.entries(remaining) as [SizeCode, number][];

  const planned = cuttingBundle.activity.issuedQty;
  const variance = cuttingBundle.total - planned;
  const hasVariance = variance !== 0;

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cutting Summary</p>
        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success">
          {cuttingBundle.total} pcs
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(cuttingBundle.bundle).map(([sz, qty]) => (
          <div key={sz} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold">
            <span className="text-muted-foreground">{sz}</span> <span className="text-foreground">{qty}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-border bg-background p-3 text-xs">
        <RowKV k="Planned Quantity" v={`${planned} pcs`} />
        <RowKV k="Actual Cutting Output" v={`${cuttingBundle.total} pcs`} />
        <RowKV k="Variance" v={hasVariance ? `${variance > 0 ? "+" : ""}${variance} pcs` : "0 pcs"} />
        <RowKV k="Current Production Quantity" v={`${currentQty} pcs`} />
        <RowKV
          k="Activity Duration"
          v={
            cuttingBundle.activity.elapsedSeconds != null ? formatDuration(cuttingBundle.activity.elapsedSeconds) : "—"
          }
        />
        <RowKV
          k="Effective Working Time"
          v={
            cuttingBundle.activity.effectiveSeconds != null
              ? formatDuration(cuttingBundle.activity.effectiveSeconds)
              : "—"
          }
        />
      </div>

      {cuttingBundle.activity.varianceReason && (
        <p className="mt-2 text-[11px] text-warning">Variance note: {cuttingBundle.activity.varianceReason}</p>
      )}

      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Set Calculation</p>
        <div className="flex flex-wrap gap-1.5">
          {SET_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSetTemplate(t.id)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-[11px] font-bold",
                setTemplate === t.id
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-accent",
              )}
            >
              {setTemplate === t.id ? "✓" : "☐"} {t.label}
            </button>
          ))}
        </div>
        <div className="mt-1.5 rounded-lg border border-border bg-background p-2.5 text-xs">
          <RowKV k={`Complete ${setTemplateDef.label} Sets`} v={`${completeSets} Sets`} />
          {remainingEntries.length > 0 ? (
            <div className="mt-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground">Remaining Pieces</p>
              <p className="mt-0.5 font-mono text-[11px] font-bold text-foreground">
                {remainingEntries.map(([sz, qty]) => `${sz}=${qty}`).join("  ")}
              </p>
            </div>
          ) : (
            <p className="mt-1.5 text-[11px] text-success">No leftover pieces — a clean set split.</p>
          )}
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            For Planning, Marketing and Sales analysis only — does not affect production quantity.
          </p>
        </div>
      </div>
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
// Exported so the Workstation Queue page (routes/workstations.$code.tsx)
// can reuse it for a station's currently running/paused job instead of
// duplicating the pause/resume/complete/cancel wiring.
export function RunningActivityCard({
  activity,
  onComplete,
}: {
  activity: ProductionActivity;
  onComplete: () => void;
}) {
  const isPaused = activity.status === "paused";
  const now = new Date();
  const start = new Date(activity.startedAt ?? activity.assignedAt);
  // While paused the clock is frozen at the moment it was paused, not "now" —
  // Live Timer never ticks during a pause. Accumulated pause time is always
  // subtracted so this reflects real work time either way.
  const end = isPaused && activity.pausedAt ? new Date(activity.pausedAt) : now;
  const rawEffective = effectiveWorkingSeconds(start, end);
  const effective = Math.max(0, rawEffective - activity.pausedSeconds);
  const cancel = useCancelActivity();
  const pause = usePauseActivity();
  const resume = useResumeActivity();

  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        isPaused ? "border-warning/30 bg-warning/10" : "border-primary/30 bg-primary-soft/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              "text-[11px] font-bold uppercase tracking-wider",
              isPaused ? "text-warning-foreground" : "text-primary",
            )}
          >
            {ACTIVITY_OP_NAME[activity.operationId]}
          </p>
          <p className="mt-0.5 truncate text-sm font-bold">{activity.assignedTo}</p>
          {activity.workstationId && (
            <p className="text-[11px] text-muted-foreground">Workstation: {activity.workstationId}</p>
          )}
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
            isPaused ? "bg-warning text-warning-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          {isPaused ? "⏸ Paused" : "🟢 Running"}
        </span>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" /> Started:
        <span className="font-bold text-foreground">{formatClock(start)}</span>
      </p>

      <div
        className={cn(
          "mt-2 rounded-xl border p-3 text-center",
          isPaused ? "border-warning/20 bg-background/70" : "border-primary/20 bg-background/70",
        )}
      >
        <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <Timer className="h-3 w-3" />{" "}
          {isPaused ? "Paused · Effective Working Time" : "Live Timer · Effective Working Time"}
        </p>
        <p
          className={cn(
            "mt-1 font-mono text-2xl font-extrabold tabular-nums",
            isPaused ? "text-warning-foreground" : "text-primary",
          )}
        >
          {formatHMS(effective)}
        </p>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Issued Qty: <span className="font-bold text-foreground">{activity.issuedQty} pcs</span>
      </p>

      {activity.notes && (
        <p className="mt-2 rounded-lg bg-background/60 px-2 py-1.5 text-xs text-muted-foreground">{activity.notes}</p>
      )}
      <div className="mt-3 flex gap-2">
        {isPaused ? (
          <button
            onClick={() => resume.mutate(activity)}
            disabled={resume.isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-warning px-3 py-2 text-xs font-bold text-warning-foreground hover:opacity-90 disabled:opacity-60"
          >
            <PlayCircle className="h-3.5 w-3.5" /> Resume
          </button>
        ) : (
          <button
            onClick={() => pause.mutate(activity)}
            disabled={pause.isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-accent disabled:opacity-60"
          >
            <PauseCircle className="h-3.5 w-3.5" /> Pause
          </button>
        )}
        <button
          onClick={onComplete}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-success px-3 py-2 text-xs font-bold text-success-foreground hover:opacity-90"
        >
          <StopCircle className="h-3.5 w-3.5" /> Complete
        </button>
        <button
          onClick={() => {
            if (window.confirm("Cancel this activity? Time is not counted.")) cancel.mutate(activity);
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
            Started:{" "}
            <span className="font-bold text-foreground">
              {formatClock(new Date(activity.startedAt ?? activity.assignedAt))}
            </span>
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
  const cuttingBundle = findCuttingBundle(activities);
  const currentQty = currentProductionQuantity(orderQuantity, activities);

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
      <div className="flex justify-end">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-accent"
        >
          <Printer className="h-3.5 w-3.5" /> Print Summary
        </button>
      </div>

      <div className={cn("grid gap-3", cuttingBundle ? "sm:grid-cols-5" : "sm:grid-cols-4")}>
        <SummaryCard label="Planned Qty" value={`${orderQuantity} pcs`} />
        {cuttingBundle && (
          <SummaryCard label="Current Prod. Qty" value={`${currentQty} pcs`} subtitle="From Actual Cutting Output" />
        )}
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
                  {formatClock(new Date(a.startedAt ?? a.assignedAt))}
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
  currentQty,
  preselectedOperation,
  allowOperationChange,
  allowedOperations,
  activities,
  onClose,
}: {
  productionOrderId: string;
  orderQuantity: number;
  currentQty: number;
  preselectedOperation: ActivityOperationId;
  allowOperationChange: boolean;
  allowedOperations?: ActivityOperationId[];
  activities: ProductionActivity[];
  onClose: () => void;
}) {
  const [operationId, setOperationId] = useState<ActivityOperationId>(preselectedOperation);
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");
  const start = useStartActivity(productionOrderId);
  const assign = useAssignActivity(productionOrderId);

  // Cutting/Hand Work/Embroidery/Stitching each map to exactly one
  // workstation type (see WORKSTATION_TYPE_OPERATION in
  // lib/api/workstations.ts); every other operation (printing, washing,
  // qc, packing) has no workstation concept, so workstationTypeKey is null
  // and no picker/requirement applies. Workstation-bound operations go
  // through the Workstation Queue (Assign → Pending → operator starts the
  // clock); everything else keeps the old immediate-start behavior since
  // there's no queue for it to sit in.
  const { data: workstationTypes = [] } = useWorkstationTypes();
  const workstationTypeKey = workstationTypeKeyForOperation(operationId);
  const workstationTypeLabel = workstationTypes.find((t) => t.typeKey === workstationTypeKey)?.label ?? "";
  const usesQueue = !!workstationTypeKey;
  const [workstationId, setWorkstationId] = useState<string | null>(null);
  const workstationOptions = useWorkstationOptions(workstationTypeKey);

  // Cutting uses a single Issue Qty; every other op after Cutting is
  // size-allocated from the Cutting bundle (bundle allocation UI).
  const isCutting = operationId === "cutting";
  const available = !isCutting ? availableInputForOperation(operationId, activities) : null;
  const hasSizeAllocation = !!available;

  const [issuedQty, setIssuedQty] = useState<number>(currentQty);
  // Prefill bundle allocation to the full available bundle — operator can
  // trim individual sizes for partial batches.
  const [sizes, setSizes] = useState<SizeBreakdown>(() => (available ? { ...available.bundle } : {}));

  useEffect(() => {
    if (available) setSizes({ ...available.bundle });
    else setIssuedQty(currentQty);
    setWorkstationId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operationId]);

  const sizeTotal = sumSizeBreakdown(sizes);
  const overAllocated = available
    ? Object.entries(sizes).some(([sz, q]) => (q ?? 0) > (available.bundle[sz as SizeCode] ?? 0))
    : false;

  function setSize(code: SizeCode, val: number) {
    setSizes((prev) => ({ ...prev, [code]: Number.isFinite(val) && val >= 0 ? val : 0 }));
  }

  const canSubmit =
    !!assignedTo.trim() &&
    (!workstationTypeKey || !!workstationId) &&
    (hasSizeAllocation ? sizeTotal > 0 && !overAllocated : issuedQty >= 1);

  async function submit() {
    if (!canSubmit) return;
    const mutation = usesQueue ? assign : start;
    if (hasSizeAllocation) {
      const bundle: SizeBreakdown = {};
      for (const [k, v] of Object.entries(sizes)) if ((v ?? 0) > 0) bundle[k as SizeCode] = v as number;
      await mutation.mutateAsync({
        operationId,
        assignedTo: assignedTo.trim(),
        issuedQty: sizeTotal,
        issuedSizes: bundle,
        workstationId,
        notes,
      });
    } else {
      await mutation.mutateAsync({
        operationId,
        assignedTo: assignedTo.trim(),
        issuedQty,
        workstationId,
        notes,
      });
    }
    onClose();
  }

  const opChoices = allowedOperations ?? [];

  const dialogVerb = usesQueue ? "Assign" : "Start";
  const dialogSubtitle = usesQueue
    ? "Book this job onto a workstation — the operator starts the clock from the queue"
    : hasSizeAllocation
      ? "Assign worker and allocate bundle by size"
      : "Assign worker and issue quantity";

  return (
    <DialogShell title={`${dialogVerb} ${ACTIVITY_OP_NAME[operationId]}`} subtitle={dialogSubtitle} onClose={onClose}>
      <div className="grid gap-4 p-5">
        {allowOperationChange && opChoices.length > 0 && (
          <Field label="Additional Operation">
            <div className="grid grid-cols-2 gap-2">
              {opChoices.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setOperationId(id)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs font-bold",
                    operationId === id
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-background text-foreground hover:bg-accent",
                  )}
                >
                  {ACTIVITY_OP_NAME[id]}
                </button>
              ))}
            </div>
          </Field>
        )}

        <Field label="Worker / Team / Vendor">
          <input
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="e.g. HW Team 01 / Line 2 / Vendor X"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>

        {workstationTypeKey && (
          <Field label={`${workstationTypeLabel || "Workstation"}`}>
            <select
              value={workstationId ?? ""}
              onChange={(e) => setWorkstationId(e.target.value || null)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select a workstation…</option>
              {(workstationOptions.data ?? []).map((w) => (
                <option key={w.workstationId} value={w.workstationId}>
                  {w.workstationId}
                  {w.running ? " — running" : ""}
                  {w.pendingCount > 0 ? ` — ${w.pendingCount} pending` : ""}
                </option>
              ))}
            </select>
            {!workstationOptions.isLoading && (workstationOptions.data ?? []).length === 0 && (
              <p className="mt-1 text-[11px] font-semibold text-destructive">
                No {workstationTypeLabel || "matching"} workstations configured.
              </p>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              A busy workstation just queues this job behind what's already there.
            </p>
          </Field>
        )}

        {hasSizeAllocation && available ? (
          <div className="rounded-xl border-2 border-primary/30 bg-primary-soft/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Bundle Allocation</span>
              <span className="text-[11px] font-bold text-muted-foreground">Available: {available.total} pcs</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(available.bundle) as SizeCode[]).map((sz) => (
                <label key={sz} className="flex flex-col gap-1">
                  <span className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                    <span>{sz}</span>
                    <span className="text-[10px] font-semibold">/{available.bundle[sz]}</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={available.bundle[sz]}
                    value={sizes[sz] ?? 0}
                    onChange={(e) => setSize(sz, Number(e.target.value))}
                    className={cn(
                      "w-full rounded-lg border bg-background px-2 py-2 text-center text-sm font-semibold",
                      (sizes[sz] ?? 0) > (available.bundle[sz] ?? 0) ? "border-destructive" : "border-border",
                    )}
                  />
                </label>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs font-bold">
              <span className="text-muted-foreground">Total Bundle Qty</span>
              <span className={cn("font-mono", overAllocated ? "text-destructive" : "text-foreground")}>
                {sizeTotal} pcs
              </span>
            </div>
            {overAllocated && (
              <p className="mt-1 text-[11px] font-semibold text-destructive">
                Issued quantity exceeds available Cutting Output.
              </p>
            )}
          </div>
        ) : (
          <Field
            label={
              currentQty !== orderQuantity
                ? `Issue Quantity (Current Prod. Qty ${currentQty} pcs · Planned ${orderQuantity} pcs)`
                : `Issue Quantity (Planned Qty ${orderQuantity} pcs)`
            }
          >
            <input
              type="number"
              min={1}
              value={issuedQty || ""}
              onChange={(e) => setIssuedQty(Number(e.target.value))}
              placeholder="e.g. 40"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
        )}

        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any instructions or remarks"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        {(usesQueue ? assign : start).error && (
          <p className="text-xs text-destructive">{((usesQueue ? assign : start).error as Error).message}</p>
        )}
      </div>
      <DialogFooter onCancel={onClose}>
        <button
          onClick={submit}
          disabled={(usesQueue ? assign : start).isPending || !canSubmit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {(usesQueue ? assign : start).isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PlayCircle className="h-3.5 w-3.5" />
          )}
          {dialogVerb} {ACTIVITY_OP_NAME[operationId]}
        </button>
      </DialogFooter>
    </DialogShell>
  );
}

// Exported so the Workstation Queue page can reuse the same Complete popup
// (Cutting size grid / issued-size allocation / plain qty) rather than a
// second implementation of the same branching logic.
export function CompleteActivityDialog({ activity, onClose }: { activity: ProductionActivity; onClose: () => void }) {
  const isCutting = activity.operationId === "cutting";
  const issuedSizes = activity.issuedSizes ?? null;
  const hasIssuedSizes = !isCutting && !!issuedSizes && sumSizeBreakdown(issuedSizes) > 0;
  const [returned, setReturned] = useState<number>(activity.issuedQty);
  const [completed, setCompleted] = useState<SizeBreakdown>(() =>
    hasIssuedSizes ? { ...(issuedSizes as SizeBreakdown) } : {},
  );
  const [rejectReason, setRejectReason] = useState("");
  const [sizes, setSizes] = useState<SizeBreakdown>(
    () => Object.fromEntries(STANDARD_SIZES.map((s) => [s, 0])) as SizeBreakdown,
  );
  const [showSmall, setShowSmall] = useState(false);
  const [showPlus, setShowPlus] = useState(false);
  const [setTemplate, setSetTemplate] = useState<SetTemplateId>(DEFAULT_SET_TEMPLATE);
  const complete = useCompleteActivity();

  const completedTotal = sumSizeBreakdown(completed);
  const issuedTotal = hasIssuedSizes ? sumSizeBreakdown(issuedSizes as SizeBreakdown) : activity.issuedQty;
  const rejectedTotal = hasIssuedSizes ? Math.max(0, issuedTotal - completedTotal) : 0;
  const overCompleted = hasIssuedSizes
    ? Object.entries(completed).some(([sz, q]) => (q ?? 0) > ((issuedSizes as SizeBreakdown)[sz as SizeCode] ?? 0))
    : false;

  // Actual Cutting Output is allowed to differ from (including exceed) the
  // Issued Quantity, e.g. from better marker planning or fabric
  // utilization — confirming never requires the two to match. This popup
  // is data entry only: variance, duration, and all other reporting live
  // in the Cutting Summary card on the Production page once this closes.
  const totalEntered = isCutting ? sumSizeBreakdown(sizes) : 0;
  const canSubmitCutting = isCutting && totalEntered > 0;

  const setTemplateDef = SET_TEMPLATES.find((t) => t.id === setTemplate) ?? SET_TEMPLATES[0];
  const { completeSets, remaining } = computeSizeSets(sizes, setTemplateDef.sizes);
  const remainingEntries = Object.entries(remaining) as [SizeCode, number][];

  function setSize(code: SizeCode, val: number) {
    setSizes((prev) => ({ ...prev, [code]: Number.isFinite(val) && val >= 0 ? val : 0 }));
  }

  // Hiding a size group also clears its values, so a collapsed group never
  // silently keeps contributing to the total.
  function removeSmallSizes() {
    setShowSmall(false);
    setSizes((prev) => {
      const next = { ...prev };
      for (const s of SMALL_SIZES) delete next[s];
      return next;
    });
  }
  function removePlusSizes() {
    setShowPlus(false);
    setSizes((prev) => {
      const next = { ...prev };
      for (const s of PLUS_SIZES) delete next[s];
      return next;
    });
  }

  async function submit() {
    if (isCutting) {
      if (!canSubmitCutting) return;
      // Strip zero entries for a clean bundle.
      const bundle: SizeBreakdown = {};
      for (const [k, v] of Object.entries(sizes)) {
        if ((v ?? 0) > 0) bundle[k as SizeCode] = v as number;
      }
      await complete.mutateAsync({ activity, returnedQty: totalEntered, sizeBreakdown: bundle, varianceReason: null });
    } else if (hasIssuedSizes) {
      if (overCompleted) return;
      const done: SizeBreakdown = {};
      for (const [k, v] of Object.entries(completed)) if ((v ?? 0) > 0) done[k as SizeCode] = v as number;
      await complete.mutateAsync({
        activity,
        returnedQty: completedTotal,
        completedSizes: done,
        varianceReason: rejectReason.trim() || null,
      });
    } else {
      await complete.mutateAsync({ activity, returnedQty: returned });
    }
    onClose();
  }

  return (
    <DialogShell title="Complete Activity" subtitle={ACTIVITY_OP_NAME[activity.operationId]} onClose={onClose}>
      <div className="grid gap-3 p-4">
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs">
          <RowKV k="Assigned To" v={activity.assignedTo} />
          <RowKV k="Issued Quantity" v={`${activity.issuedQty} pcs`} />
        </div>

        {isCutting ? (
          <>
            <div className="rounded-xl border-2 border-primary/30 bg-primary-soft/40 p-3">
              <div className="mb-2 text-xs font-bold text-foreground">Cutting Output — Standard Sizes</div>
              <div className="grid grid-cols-4 gap-2">
                {STANDARD_SIZES.map((s) => (
                  <SizeInput key={s} label={s} value={sizes[s] ?? 0} onChange={(v) => setSize(s, v)} />
                ))}
              </div>

              {showSmall ? (
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Small Sizes</span>
                    <button
                      type="button"
                      onClick={removeSmallSizes}
                      className="text-[11px] font-bold text-muted-foreground hover:text-destructive"
                    >
                      ✕ Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {SMALL_SIZES.map((s) => (
                      <SizeInput key={s} label={s} value={sizes[s] ?? 0} onChange={(v) => setSize(s, v)} />
                    ))}
                  </div>
                </div>
              ) : null}

              {showPlus ? (
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Plus Sizes</span>
                    <button
                      type="button"
                      onClick={removePlusSizes}
                      className="text-[11px] font-bold text-muted-foreground hover:text-destructive"
                    >
                      ✕ Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {PLUS_SIZES.map((s) => (
                      <SizeInput key={s} label={s} value={sizes[s] ?? 0} onChange={(v) => setSize(s, v)} />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {!showSmall && (
                  <button
                    type="button"
                    onClick={() => setShowSmall(true)}
                    className="rounded-lg border border-dashed border-border bg-background px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-accent"
                  >
                    + Add Small Sizes
                  </button>
                )}
                {!showPlus && (
                  <button
                    type="button"
                    onClick={() => setShowPlus(true)}
                    className="rounded-lg border border-dashed border-border bg-background px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-accent"
                  >
                    + Add Plus Sizes
                  </button>
                )}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-bold text-foreground">Set Calculation</div>
              <div className="flex flex-wrap gap-1.5">
                {SET_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSetTemplate(t.id)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-[11px] font-bold",
                      setTemplate === t.id
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {setTemplate === t.id ? "✓" : "☐"} {t.label}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 rounded-lg border border-border bg-background p-2.5 text-xs">
                <RowKV k={`Complete ${setTemplateDef.label} Sets`} v={`${completeSets} Sets`} />
                {remainingEntries.length > 0 ? (
                  <div className="mt-1.5">
                    <p className="text-[11px] font-semibold text-muted-foreground">Remaining Pieces</p>
                    <p className="mt-0.5 font-mono text-[11px] font-bold text-foreground">
                      {remainingEntries.map(([sz, qty]) => `${sz}=${qty}`).join("  ")}
                    </p>
                  </div>
                ) : (
                  totalEntered > 0 && (
                    <p className="mt-1.5 text-[11px] text-success">No leftover pieces — a clean set split.</p>
                  )
                )}
              </div>
            </div>
          </>
        ) : hasIssuedSizes ? (
          <>
            <div className="rounded-xl border-2 border-primary/30 bg-primary-soft/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Completed Quantity (by size)</span>
                <span className="text-[11px] font-bold text-muted-foreground">Issued: {issuedTotal} pcs</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(issuedSizes as SizeBreakdown) as SizeCode[]).map((sz) => {
                  const max = (issuedSizes as SizeBreakdown)[sz] ?? 0;
                  const val = completed[sz] ?? 0;
                  return (
                    <label key={sz} className="flex flex-col gap-1">
                      <span className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                        <span>{sz}</span>
                        <span className="text-[10px] font-semibold">/{max}</span>
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={max}
                        value={val}
                        onChange={(e) =>
                          setCompleted((prev) => ({ ...prev, [sz]: Math.max(0, Number(e.target.value) || 0) }))
                        }
                        className={cn(
                          "w-full rounded-lg border bg-background px-2 py-2 text-center text-sm font-semibold",
                          val > max ? "border-destructive" : "border-border",
                        )}
                      />
                    </label>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-bold">
                <div className="rounded-lg bg-background px-2 py-1.5">
                  <div className="text-muted-foreground">Completed</div>
                  <div className="font-mono text-sm text-foreground">{completedTotal}</div>
                </div>
                <div className="rounded-lg bg-background px-2 py-1.5">
                  <div className="text-muted-foreground">Rejected</div>
                  <div className="font-mono text-sm text-destructive">{rejectedTotal}</div>
                </div>
                <div className="rounded-lg bg-background px-2 py-1.5">
                  <div className="text-muted-foreground">Balance</div>
                  <div className="font-mono text-sm text-foreground">
                    {issuedTotal - completedTotal - rejectedTotal}
                  </div>
                </div>
              </div>
              {overCompleted && (
                <p className="mt-2 text-[11px] font-semibold text-destructive">
                  Completed quantity per size cannot exceed the issued quantity.
                </p>
              )}
            </div>
            {rejectedTotal > 0 && (
              <Field label="Reject Reason (optional)">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. stitching defect, fabric flaw"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
            )}
          </>
        ) : (
          <Field label="Return Quantity">
            <input
              type="number"
              min={0}
              value={returned}
              onChange={(e) => setReturned(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
        )}

        {complete.error && <p className="text-xs text-destructive">{(complete.error as Error).message}</p>}
      </div>
      <DialogFooter onCancel={onClose}>
        <button
          onClick={submit}
          disabled={complete.isPending || (isCutting && !canSubmitCutting) || (hasIssuedSizes && overCompleted)}
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

function SizeInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
      <input
        type="number"
        min={0}
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder="0"
        className="w-full rounded-lg border border-border bg-background px-2 py-2 text-center text-sm font-semibold"
      />
    </label>
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
