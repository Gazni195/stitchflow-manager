// Report registry — the single source of truth for every report the module
// renders. A report is a pure function from the shared dataset
// (`useReportsData`) + the active filters to a table of rows, so the route,
// the print view and every export share exactly one implementation.
import type { ReportsData } from "@/lib/api/reports";
import { STATUS_LABEL, type DesignStatus } from "@/lib/designs";

/* ------------------------------ filters ------------------------------ */

export const FILTER_KEYS = [
  "dateRange",
  "customer",
  "design",
  "productType",
  "status",
  "designer",
  "workstation",
  "productionOrder",
  "material",
  "user",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export type ReportFilters = {
  from: string;
  to: string;
  customer: string;
  design: string;
  productType: string;
  status: string;
  designer: string;
  workstation: string;
  productionOrder: string;
  material: string;
  user: string;
};

export const EMPTY_FILTERS: ReportFilters = {
  from: "",
  to: "",
  customer: "",
  design: "",
  productType: "",
  status: "",
  designer: "",
  workstation: "",
  productionOrder: "",
  material: "",
  user: "",
};

export const FILTER_LABEL: Record<FilterKey, string> = {
  dateRange: "Date range",
  customer: "Customer",
  design: "Design",
  productType: "Product type",
  status: "Status",
  designer: "Designer",
  workstation: "Workstation",
  productionOrder: "Production order",
  material: "Material",
  user: "User",
};

/* ------------------------------ sections ----------------------------- */

export type SectionId =
  | "dashboard"
  | "design"
  | "sample"
  | "production"
  | "inventory"
  | "stock"
  | "users";

export type ReportSection = {
  id: SectionId;
  title: string;
  description: string;
  permission: string;
};

export const REPORT_SECTIONS: ReportSection[] = [
  {
    id: "design",
    title: "Design Reports",
    description: "Design pipeline, approvals and designer output.",
    permission: "reports.design.view",
  },
  {
    id: "sample",
    title: "Sample Development Reports",
    description: "Sample progress, approvals, consumption and cost.",
    permission: "reports.sample.view",
  },
  {
    id: "production",
    title: "Production Reports",
    description: "Orders in flight, throughput, workstations and operators.",
    permission: "reports.production.view",
  },
  {
    id: "inventory",
    title: "Inventory Reports",
    description: "Material stock, bundles and purchase cost.",
    permission: "reports.inventory.view",
  },
  {
    id: "stock",
    title: "Stock Reports",
    description: "Finished goods available from completed production.",
    permission: "reports.stock.view",
  },
  {
    id: "users",
    title: "User Reports",
    description: "Workspace activity, roles and permission coverage.",
    permission: "reports.users.view",
  },
];

/* ------------------------------- types ------------------------------- */

export type ReportColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
};

export type ReportRow = Record<string, string | number | null>;

export type ReportDefinition = {
  id: string;
  section: SectionId;
  title: string;
  description: string;
  permission: string;
  filters: FilterKey[];
  columns: ReportColumn[];
  build: (data: ReportsData, filters: ReportFilters) => ReportRow[];
  /** Rendered under the toolbar — used to state how a metric is derived. */
  note?: string;
};

/* ------------------------------ helpers ------------------------------ */

const DAY = 86_400_000;

/** Production orders running longer than this without completing are "delayed". */
export const DELAY_THRESHOLD_DAYS = 14;

function inRange(iso: string | null | undefined, f: ReportFilters): boolean {
  if (!iso) return !f.from && !f.to;
  const t = new Date(iso).getTime();
  if (f.from && t < new Date(`${f.from}T00:00:00`).getTime()) return false;
  if (f.to && t > new Date(`${f.to}T23:59:59`).getTime()) return false;
  return true;
}

function match(value: string | null | undefined, filter: string): boolean {
  if (!filter) return true;
  return (value ?? "") === filter;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function round(n: number, digits = 2): number {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function daysBetween(from: string | null | undefined, to?: string | null): number {
  if (!from) return 0;
  const end = to ? new Date(to).getTime() : Date.now();
  return Math.max(0, Math.round((end - new Date(from).getTime()) / DAY));
}

const SAMPLE_ROLES = ["designer", "merchandiser", "production_head"] as const;

export function roleLabel(role: string): string {
  return role
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function designerName(data: ReportsData, userId: string | null): string {
  if (!userId) return "Unassigned";
  return data.users.find((u) => u.userId === userId)?.email ?? userId.slice(0, 8);
}

/** Finished quantity for a completed order — QC return count, else order qty. */
function finishedQty(data: ReportsData, orderId: string, orderQty: number): number {
  const qc = data.processes.find((p) => p.productionOrderId === orderId && p.operationId === "qc");
  if (qc?.returnedQty != null) return qc.returnedQty;
  const act = data.activities.filter((a) => a.productionOrderId === orderId && a.operationId === "qc");
  const returned = act.reduce((s, a) => s + (a.returnedQty ?? 0), 0);
  return returned || orderQty;
}

function designFilterOk(
  data: ReportsData,
  designId: string,
  f: ReportFilters,
): boolean {
  const d = data.designs.find((x) => x.id === designId);
  if (!d) return !f.design && !f.customer && !f.productType && !f.designer;
  return (
    match(d.code, f.design) &&
    match(d.customer, f.customer) &&
    match(d.productType, f.productType) &&
    (!f.designer || designerName(data, d.createdBy) === f.designer)
  );
}

function orderProgress(data: ReportsData, orderId: string): number {
  const procs = data.processes.filter((p) => p.productionOrderId === orderId);
  if (!procs.length) return 0;
  const done = procs.filter((p) => p.status === "completed").length;
  return Math.round((done / procs.length) * 100);
}

function currentOperation(data: ReportsData, orderId: string): string {
  const running = data.activities.find(
    (a) => a.productionOrderId === orderId && (a.status === "running" || a.status === "paused"),
  );
  if (running) return running.operationId;
  const next = data.processes
    .filter((p) => p.productionOrderId === orderId && p.status !== "completed")
    .sort((a, b) => a.sequence - b.sequence)[0];
  return next?.operationId ?? "—";
}

/* ------------------------------ registry ----------------------------- */

export const REPORTS: ReportDefinition[] = [
  /* ------------------------------ Design ------------------------------ */
  {
    id: "design-status",
    section: "design",
    title: "Design Status Report",
    description: "Every design with its current pipeline status and order quantity.",
    permission: "reports.design.view",
    filters: ["dateRange", "customer", "design", "productType", "status", "designer"],
    columns: [
      { key: "code", label: "Design" },
      { key: "name", label: "Name" },
      { key: "customer", label: "Customer" },
      { key: "productType", label: "Product type" },
      { key: "status", label: "Status" },
      { key: "qty", label: "Order qty", align: "right" },
      { key: "designer", label: "Created by" },
      { key: "created", label: "Created" },
    ],
    build: (data, f) =>
      data.designs
        .filter(
          (d) =>
            inRange(d.createdAt, f) &&
            match(d.code, f.design) &&
            match(d.customer, f.customer) &&
            match(d.productType, f.productType) &&
            match(d.status, f.status) &&
            (!f.designer || designerName(data, d.createdBy) === f.designer),
        )
        .map((d) => ({
          code: d.code,
          name: d.name,
          customer: d.customer,
          productType: d.productType,
          status: STATUS_LABEL[d.status as DesignStatus] ?? d.status,
          qty: d.orderQuantity,
          designer: designerName(data, d.createdBy),
          created: fmtDate(d.createdAt),
        })),
  },
  {
    id: "designer-performance",
    section: "design",
    title: "Designer Performance",
    description: "Designs created per user, split by how far they progressed.",
    permission: "reports.design.view",
    filters: ["dateRange", "customer", "productType", "designer"],
    columns: [
      { key: "designer", label: "Designer" },
      { key: "total", label: "Designs", align: "right" },
      { key: "approved", label: "Sample approved", align: "right" },
      { key: "inProduction", label: "In production", align: "right" },
      { key: "completed", label: "Completed", align: "right" },
      { key: "rejected", label: "Rejected", align: "right" },
      { key: "qty", label: "Total order qty", align: "right" },
    ],
    build: (data, f) => {
      const map = new Map<string, ReportRow>();
      for (const d of data.designs) {
        if (
          !inRange(d.createdAt, f) ||
          !match(d.customer, f.customer) ||
          !match(d.productType, f.productType)
        )
          continue;
        const who = designerName(data, d.createdBy);
        if (f.designer && who !== f.designer) continue;
        const row =
          map.get(who) ??
          ({ designer: who, total: 0, approved: 0, inProduction: 0, completed: 0, rejected: 0, qty: 0 } as ReportRow);
        row.total = (row.total as number) + 1;
        row.qty = (row.qty as number) + d.orderQuantity;
        if (d.status === "sample_approved") row.approved = (row.approved as number) + 1;
        if (d.status === "in_production") row.inProduction = (row.inProduction as number) + 1;
        if (d.status === "completed") row.completed = (row.completed as number) + 1;
        if (d.status === "design_rejected") row.rejected = (row.rejected as number) + 1;
        map.set(who, row);
      }
      return [...map.values()].sort((a, b) => (b.total as number) - (a.total as number));
    },
  },
  {
    id: "pending-approvals",
    section: "design",
    title: "Pending Approvals",
    description: "Designs in sampling that still need one or more sign-offs.",
    permission: "reports.design.view",
    filters: ["dateRange", "customer", "design", "productType", "designer"],
    columns: [
      { key: "code", label: "Design" },
      { key: "customer", label: "Customer" },
      { key: "status", label: "Status" },
      { key: "approved", label: "Approved", align: "right" },
      { key: "pending", label: "Awaiting" },
      { key: "age", label: "Age (days)", align: "right" },
    ],
    build: (data, f) =>
      data.designs
        .filter(
          (d) =>
            d.status === "sampling" &&
            inRange(d.createdAt, f) &&
            match(d.code, f.design) &&
            match(d.customer, f.customer) &&
            match(d.productType, f.productType) &&
            (!f.designer || designerName(data, d.createdBy) === f.designer),
        )
        .map((d) => {
          const done = data.approvals.filter((a) => a.designId === d.id).map((a) => a.role);
          const pending = SAMPLE_ROLES.filter((r) => !done.includes(r));
          return {
            code: d.code,
            customer: d.customer,
            status: STATUS_LABEL[d.status as DesignStatus] ?? d.status,
            approved: `${done.length}/${SAMPLE_ROLES.length}`,
            pending: pending.map(roleLabel).join(", ") || "—",
            age: daysBetween(d.createdAt),
          };
        })
        .filter((r) => r.pending !== "—"),
  },
  {
    id: "approved-designs",
    section: "design",
    title: "Approved Designs",
    description: "Designs whose sample has been fully signed off.",
    permission: "reports.design.view",
    filters: ["dateRange", "customer", "design", "productType", "designer"],
    columns: [
      { key: "code", label: "Design" },
      { key: "name", label: "Name" },
      { key: "customer", label: "Customer" },
      { key: "qty", label: "Order qty", align: "right" },
      { key: "approvedAt", label: "Approved on" },
      { key: "approvers", label: "Approvers" },
    ],
    build: (data, f) =>
      data.designs
        .filter(
          (d) =>
            ["sample_approved", "in_production", "completed"].includes(d.status) &&
            match(d.code, f.design) &&
            match(d.customer, f.customer) &&
            match(d.productType, f.productType) &&
            (!f.designer || designerName(data, d.createdBy) === f.designer),
        )
        .map((d) => {
          const rows = data.approvals.filter((a) => a.designId === d.id);
          const last = rows.map((a) => a.approvedAt).sort().at(-1) ?? null;
          return {
            code: d.code,
            name: d.name,
            customer: d.customer,
            qty: d.orderQuantity,
            approvedAt: fmtDate(last),
            approvers: rows.map((a) => a.approverName).join(", ") || "—",
            _ts: last,
          } as ReportRow & { _ts: string | null };
        })
        .filter((r) => inRange((r as any)._ts ?? undefined, f) || (!f.from && !f.to))
        .map(({ ...r }) => {
          delete (r as any)._ts;
          return r;
        }),
  },
  {
    id: "returned-designs",
    section: "design",
    title: "Returned Designs",
    description: "Designs rejected or sent back to draft for rework.",
    permission: "reports.design.view",
    filters: ["dateRange", "customer", "design", "productType", "designer"],
    columns: [
      { key: "code", label: "Design" },
      { key: "name", label: "Name" },
      { key: "customer", label: "Customer" },
      { key: "status", label: "Status" },
      { key: "designer", label: "Created by" },
      { key: "updated", label: "Returned on" },
    ],
    build: (data, f) =>
      data.designs
        .filter(
          (d) =>
            d.status === "design_rejected" &&
            inRange(d.updatedAt, f) &&
            match(d.code, f.design) &&
            match(d.customer, f.customer) &&
            match(d.productType, f.productType) &&
            (!f.designer || designerName(data, d.createdBy) === f.designer),
        )
        .map((d) => ({
          code: d.code,
          name: d.name,
          customer: d.customer,
          status: STATUS_LABEL[d.status as DesignStatus] ?? d.status,
          designer: designerName(data, d.createdBy),
          updated: fmtDate(d.updatedAt),
        })),
  },

  /* ------------------------------ Sample ------------------------------ */
  {
    id: "sample-progress",
    section: "sample",
    title: "Sample Progress",
    description: "Sample workflow completion per design.",
    permission: "reports.sample.view",
    filters: ["dateRange", "customer", "design", "productType", "status"],
    columns: [
      { key: "code", label: "Design" },
      { key: "customer", label: "Customer" },
      { key: "steps", label: "Steps", align: "right" },
      { key: "completed", label: "Completed", align: "right" },
      { key: "progress", label: "Progress %", align: "right" },
      { key: "status", label: "Design status" },
      { key: "lastActivity", label: "Last activity" },
    ],
    build: (data, f) =>
      data.designs
        .filter(
          (d) =>
            inRange(d.createdAt, f) &&
            designFilterOk(data, d.id, f) &&
            match(d.status, f.status),
        )
        .map((d) => {
          const steps = data.steps.filter((s) => s.designId === d.id && s.kind === "sample" && s.status !== "deleted");
          const done = steps.filter((s) => s.status === "completed").length;
          const last = steps
            .map((s) => s.completedAt ?? s.startedAt ?? s.createdAt)
            .filter(Boolean)
            .sort()
            .at(-1);
          return {
            code: d.code,
            customer: d.customer,
            steps: steps.length,
            completed: done,
            progress: steps.length ? Math.round((done / steps.length) * 100) : 0,
            status: STATUS_LABEL[d.status as DesignStatus] ?? d.status,
            lastActivity: fmtDate(last ?? null),
          };
        })
        .filter((r) => (r.steps as number) > 0),
  },
  {
    id: "pending-samples",
    section: "sample",
    title: "Pending Samples",
    description: "Sample operations that are not yet completed.",
    permission: "reports.sample.view",
    filters: ["dateRange", "customer", "design", "productType", "status"],
    columns: [
      { key: "code", label: "Design" },
      { key: "customer", label: "Customer" },
      { key: "operation", label: "Operation" },
      { key: "stepStatus", label: "Step status" },
      { key: "assigned", label: "Assigned to" },
      { key: "started", label: "Started" },
      { key: "age", label: "Age (days)", align: "right" },
    ],
    build: (data, f) =>
      data.steps
        .filter(
          (s) =>
            s.kind === "sample" &&
            !["completed", "deleted", "skipped"].includes(s.status) &&
            inRange(s.createdAt, f) &&
            designFilterOk(data, s.designId, f) &&
            match(s.status, f.status),
        )
        .map((s) => {
          const d = data.designs.find((x) => x.id === s.designId);
          return {
            code: d?.code ?? "—",
            customer: d?.customer ?? "—",
            operation: s.label ?? s.operationId,
            stepStatus: s.status,
            assigned: s.assignedTo ?? "—",
            started: fmtDate(s.startedAt),
            age: daysBetween(s.startedAt ?? s.createdAt),
          };
        }),
  },
  {
    id: "sample-approval-status",
    section: "sample",
    title: "Approval Status",
    description: "Sign-off matrix across Designer, Merchandiser and Production Head.",
    permission: "reports.sample.view",
    filters: ["dateRange", "customer", "design", "productType"],
    columns: [
      { key: "code", label: "Design" },
      { key: "customer", label: "Customer" },
      { key: "designer", label: "Designer" },
      { key: "merchandiser", label: "Merchandiser" },
      { key: "productionHead", label: "Production Head" },
      { key: "complete", label: "Complete" },
    ],
    build: (data, f) =>
      data.designs
        .filter((d) => inRange(d.createdAt, f) && designFilterOk(data, d.id, f))
        .map((d) => {
          const rows = data.approvals.filter((a) => a.designId === d.id);
          const cell = (role: string) => {
            const a = rows.find((x) => x.role === role);
            return a ? `${a.approverName} · ${fmtDate(a.approvedAt)}` : "Pending";
          };
          return {
            code: d.code,
            customer: d.customer,
            designer: cell("designer"),
            merchandiser: cell("merchandiser"),
            productionHead: cell("production_head"),
            complete: rows.length >= SAMPLE_ROLES.length ? "Yes" : "No",
          };
        }),
  },
  {
    id: "sample-material-consumption",
    section: "sample",
    title: "Material Consumption",
    description: "Material quantities recorded against each sample.",
    permission: "reports.sample.view",
    filters: ["dateRange", "customer", "design", "productType", "material"],
    columns: [
      { key: "code", label: "Design" },
      { key: "part", label: "Part / group" },
      { key: "material", label: "Material" },
      { key: "unit", label: "Unit" },
      { key: "qty", label: "Quantity", align: "right" },
      { key: "rate", label: "Rate", align: "right" },
      { key: "amount", label: "Amount", align: "right" },
    ],
    build: (data, f) =>
      data.designMaterials
        .filter((m) => designFilterOk(data, m.designId, f))
        .map((m) => {
          const d = data.designs.find((x) => x.id === m.designId);
          const mat = data.materials.find((x) => x.id === m.materialId);
          return {
            code: d?.code ?? "—",
            part: m.groupName || "—",
            material: mat ? `${mat.code} · ${mat.name}` : "—",
            unit: mat?.unit ?? "—",
            qty: round(m.quantity),
            rate: round(m.rate),
            amount: round(m.quantity * m.rate),
            _material: mat?.name ?? "",
          } as ReportRow & { _material: string };
        })
        .filter((r) => !f.material || (r as any)._material === f.material)
        .map((r) => {
          delete (r as any)._material;
          return r;
        }),
  },
  {
    id: "sample-cost-summary",
    section: "sample",
    title: "Sample Cost Summary",
    description: "Material cost plus workflow labour cost (duration × hourly rate) per sample.",
    permission: "reports.sample.view",
    filters: ["dateRange", "customer", "design", "productType"],
    columns: [
      { key: "code", label: "Design" },
      { key: "customer", label: "Customer" },
      { key: "materialCost", label: "Material cost", align: "right" },
      { key: "labourCost", label: "Labour cost", align: "right" },
      { key: "total", label: "Total", align: "right" },
      { key: "perPiece", label: "Cost / piece", align: "right" },
    ],
    build: (data, f) =>
      data.designs
        .filter((d) => inRange(d.createdAt, f) && designFilterOk(data, d.id, f))
        .map((d) => {
          const materialCost = data.designMaterials
            .filter((m) => m.designId === d.id)
            .reduce((s, m) => s + m.quantity * m.rate, 0);
          const labourCost = data.steps
            .filter((s) => s.designId === d.id && s.kind === "sample")
            .reduce((s, step) => s + ((step.durationSeconds ?? 0) / 3600) * step.hourlyRate, 0);
          const total = materialCost + labourCost;
          return {
            code: d.code,
            customer: d.customer,
            materialCost: round(materialCost),
            labourCost: round(labourCost),
            total: round(total),
            perPiece: d.orderQuantity ? round(total / d.orderQuantity) : 0,
          };
        })
        .filter((r) => (r.total as number) > 0),
    note: "Labour cost = recorded workflow step duration × the step's hourly rate.",
  },

  /* ---------------------------- Production ---------------------------- */
  {
    id: "running-production",
    section: "production",
    title: "Running Production",
    description: "Production orders currently in progress.",
    permission: "reports.production.view",
    filters: ["dateRange", "customer", "design", "productType", "productionOrder"],
    columns: [
      { key: "po", label: "PO" },
      { key: "design", label: "Design" },
      { key: "customer", label: "Customer" },
      { key: "qty", label: "Qty", align: "right" },
      { key: "operation", label: "Current operation" },
      { key: "progress", label: "Progress %", align: "right" },
      { key: "started", label: "Start date" },
      { key: "days", label: "Days running", align: "right" },
    ],
    build: (data, f) =>
      data.orders
        .filter(
          (o) =>
            o.status === "running" &&
            inRange(o.startDate, f) &&
            match(o.customer, f.customer) &&
            match(o.designCode, f.design) &&
            match(o.productType, f.productType) &&
            match(o.code, f.productionOrder),
        )
        .map((o) => ({
          po: o.code,
          design: o.designCode,
          customer: o.customer,
          qty: o.orderQuantity,
          operation: currentOperation(data, o.id),
          progress: orderProgress(data, o.id),
          started: fmtDate(o.startDate),
          days: daysBetween(o.startDate),
        })),
  },
  {
    id: "completed-production",
    section: "production",
    title: "Completed Production",
    description: "Finished production orders with lead time and output.",
    permission: "reports.production.view",
    filters: ["dateRange", "customer", "design", "productType", "productionOrder"],
    columns: [
      { key: "po", label: "PO" },
      { key: "design", label: "Design" },
      { key: "customer", label: "Customer" },
      { key: "qty", label: "Order qty", align: "right" },
      { key: "finished", label: "Finished", align: "right" },
      { key: "started", label: "Start" },
      { key: "completed", label: "Completed" },
      { key: "lead", label: "Lead time (days)", align: "right" },
    ],
    build: (data, f) =>
      data.orders
        .filter(
          (o) =>
            o.status === "completed" &&
            inRange(o.completedAt, f) &&
            match(o.customer, f.customer) &&
            match(o.designCode, f.design) &&
            match(o.productType, f.productType) &&
            match(o.code, f.productionOrder),
        )
        .map((o) => ({
          po: o.code,
          design: o.designCode,
          customer: o.customer,
          qty: o.orderQuantity,
          finished: finishedQty(data, o.id, o.orderQuantity),
          started: fmtDate(o.startDate),
          completed: fmtDate(o.completedAt),
          lead: daysBetween(o.startDate, o.completedAt),
        })),
  },
  {
    id: "delayed-production",
    section: "production",
    title: "Delayed Production",
    description: `Running orders open longer than ${DELAY_THRESHOLD_DAYS} days, or with a paused activity.`,
    permission: "reports.production.view",
    filters: ["dateRange", "customer", "design", "productType", "productionOrder", "workstation"],
    columns: [
      { key: "po", label: "PO" },
      { key: "design", label: "Design" },
      { key: "customer", label: "Customer" },
      { key: "days", label: "Days open", align: "right" },
      { key: "progress", label: "Progress %", align: "right" },
      { key: "paused", label: "Paused jobs", align: "right" },
      { key: "reason", label: "Flagged because" },
    ],
    build: (data, f) =>
      data.orders
        .filter(
          (o) =>
            o.status === "running" &&
            inRange(o.startDate, f) &&
            match(o.customer, f.customer) &&
            match(o.designCode, f.design) &&
            match(o.productType, f.productType) &&
            match(o.code, f.productionOrder),
        )
        .map((o) => {
          const acts = data.activities.filter(
            (a) => a.productionOrderId === o.id && (!f.workstation || a.workstationId === f.workstation),
          );
          const paused = acts.filter((a) => a.status === "paused").length;
          const days = daysBetween(o.startDate);
          const overdue = days > DELAY_THRESHOLD_DAYS;
          return {
            po: o.code,
            design: o.designCode,
            customer: o.customer,
            days,
            progress: orderProgress(data, o.id),
            paused,
            reason: overdue && paused ? "Overdue + paused" : overdue ? "Overdue" : paused ? "Paused work" : "",
          } as ReportRow;
        })
        .filter((r) => !!r.reason),
    note: `An order is flagged when it has been open more than ${DELAY_THRESHOLD_DAYS} days or has a paused activity.`,
  },
  {
    id: "workstation-performance",
    section: "production",
    title: "Workstation Performance",
    description: "Jobs, output and effective working time per workstation.",
    permission: "reports.production.view",
    filters: ["dateRange", "workstation", "productionOrder"],
    columns: [
      { key: "workstation", label: "Workstation" },
      { key: "jobs", label: "Jobs", align: "right" },
      { key: "completed", label: "Completed", align: "right" },
      { key: "issued", label: "Issued qty", align: "right" },
      { key: "returned", label: "Returned qty", align: "right" },
      { key: "effective", label: "Effective time" },
      { key: "perPiece", label: "Avg min / piece", align: "right" },
    ],
    build: (data, f) => {
      const map = new Map<string, { jobs: number; completed: number; issued: number; returned: number; secs: number }>();
      for (const a of data.activities) {
        const order = data.orders.find((o) => o.id === a.productionOrderId);
        if (!inRange(a.assignedAt, f)) continue;
        if (f.workstation && a.workstationId !== f.workstation) continue;
        if (f.productionOrder && order?.code !== f.productionOrder) continue;
        const key = a.workstationId ?? "Unassigned";
        const agg = map.get(key) ?? { jobs: 0, completed: 0, issued: 0, returned: 0, secs: 0 };
        agg.jobs += 1;
        if (a.status === "completed") agg.completed += 1;
        agg.issued += a.issuedQty;
        agg.returned += a.returnedQty ?? 0;
        agg.secs += a.effectiveSeconds ?? 0;
        map.set(key, agg);
      }
      return [...map.entries()]
        .map(([workstation, v]) => ({
          workstation,
          jobs: v.jobs,
          completed: v.completed,
          issued: v.issued,
          returned: v.returned,
          effective: fmtDuration(v.secs),
          perPiece: v.returned ? round(v.secs / 60 / v.returned, 1) : 0,
        }))
        .sort((a, b) => (b.jobs as number) - (a.jobs as number));
    },
  },
  {
    id: "operator-performance",
    section: "production",
    title: "Operator Performance",
    description: "Output and working time per assigned operator.",
    permission: "reports.production.view",
    filters: ["dateRange", "workstation", "productionOrder", "user"],
    columns: [
      { key: "operator", label: "Operator" },
      { key: "jobs", label: "Jobs", align: "right" },
      { key: "completed", label: "Completed", align: "right" },
      { key: "returned", label: "Pieces done", align: "right" },
      { key: "effective", label: "Effective time" },
      { key: "paused", label: "Paused time" },
      { key: "perPiece", label: "Avg min / piece", align: "right" },
    ],
    build: (data, f) => {
      const map = new Map<string, { jobs: number; completed: number; returned: number; secs: number; paused: number }>();
      for (const a of data.activities) {
        const order = data.orders.find((o) => o.id === a.productionOrderId);
        if (!inRange(a.assignedAt, f)) continue;
        if (f.workstation && a.workstationId !== f.workstation) continue;
        if (f.productionOrder && order?.code !== f.productionOrder) continue;
        const key = a.assignedTo || "Unassigned";
        if (f.user && key !== f.user) continue;
        const agg = map.get(key) ?? { jobs: 0, completed: 0, returned: 0, secs: 0, paused: 0 };
        agg.jobs += 1;
        if (a.status === "completed") agg.completed += 1;
        agg.returned += a.returnedQty ?? 0;
        agg.secs += a.effectiveSeconds ?? 0;
        agg.paused += a.pausedSeconds;
        map.set(key, agg);
      }
      return [...map.entries()]
        .map(([operator, v]) => ({
          operator,
          jobs: v.jobs,
          completed: v.completed,
          returned: v.returned,
          effective: fmtDuration(v.secs),
          paused: fmtDuration(v.paused),
          perPiece: v.returned ? round(v.secs / 60 / v.returned, 1) : 0,
        }))
        .sort((a, b) => (b.returned as number) - (a.returned as number));
    },
  },
  {
    id: "production-efficiency",
    section: "production",
    title: "Production Efficiency",
    description: "Issued vs returned pieces and wastage per production order.",
    permission: "reports.production.view",
    filters: ["dateRange", "customer", "design", "productType", "productionOrder", "status"],
    columns: [
      { key: "po", label: "PO" },
      { key: "design", label: "Design" },
      { key: "status", label: "Status" },
      { key: "issued", label: "Issued", align: "right" },
      { key: "returned", label: "Returned", align: "right" },
      { key: "loss", label: "Loss", align: "right" },
      { key: "efficiency", label: "Efficiency %", align: "right" },
      { key: "effective", label: "Effective time" },
    ],
    build: (data, f) =>
      data.orders
        .filter(
          (o) =>
            inRange(o.createdAt, f) &&
            match(o.customer, f.customer) &&
            match(o.designCode, f.design) &&
            match(o.productType, f.productType) &&
            match(o.code, f.productionOrder) &&
            match(o.status, f.status),
        )
        .map((o) => {
          const acts = data.activities.filter((a) => a.productionOrderId === o.id);
          const issued = acts.reduce((s, a) => s + a.issuedQty, 0);
          const returned = acts.reduce((s, a) => s + (a.returnedQty ?? 0), 0);
          const secs = acts.reduce((s, a) => s + (a.effectiveSeconds ?? 0), 0);
          return {
            po: o.code,
            design: o.designCode,
            status: o.status,
            issued,
            returned,
            loss: Math.max(0, issued - returned),
            efficiency: issued ? Math.round((returned / issued) * 100) : 0,
            effective: fmtDuration(secs),
          };
        })
        .filter((r) => (r.issued as number) > 0),
  },
  {
    id: "production-timeline",
    section: "production",
    title: "Production Timeline",
    description: "Every production activity with assignment, start and completion stamps.",
    permission: "reports.production.view",
    filters: ["dateRange", "customer", "design", "productionOrder", "workstation", "status", "user"],
    columns: [
      { key: "po", label: "PO" },
      { key: "design", label: "Design" },
      { key: "operation", label: "Operation" },
      { key: "workstation", label: "Workstation" },
      { key: "operator", label: "Operator" },
      { key: "status", label: "Status" },
      { key: "assigned", label: "Assigned" },
      { key: "started", label: "Started" },
      { key: "completed", label: "Completed" },
      { key: "effective", label: "Effective" },
    ],
    build: (data, f) =>
      data.activities
        .filter((a) => {
          const o = data.orders.find((x) => x.id === a.productionOrderId);
          return (
            inRange(a.assignedAt, f) &&
            match(o?.customer, f.customer) &&
            match(o?.designCode, f.design) &&
            match(o?.code, f.productionOrder) &&
            (!f.workstation || a.workstationId === f.workstation) &&
            match(a.status, f.status) &&
            (!f.user || a.assignedTo === f.user)
          );
        })
        .sort((a, b) => (a.assignedAt < b.assignedAt ? 1 : -1))
        .map((a) => {
          const o = data.orders.find((x) => x.id === a.productionOrderId);
          return {
            po: o?.code ?? "—",
            design: o?.designCode ?? "—",
            operation: a.operationId,
            workstation: a.workstationId ?? "—",
            operator: a.assignedTo || "—",
            status: a.status,
            assigned: fmtDateTime(a.assignedAt),
            started: fmtDateTime(a.startedAt),
            completed: fmtDateTime(a.completedAt),
            effective: fmtDuration(a.effectiveSeconds),
          };
        }),
  },

  /* ---------------------------- Inventory ----------------------------- */
  {
    id: "material-stock",
    section: "inventory",
    title: "Material Stock",
    description: "Available stock and bundle counts per material.",
    permission: "reports.inventory.view",
    filters: ["material", "status"],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Material" },
      { key: "color", label: "Color" },
      { key: "unit", label: "Unit" },
      { key: "bundles", label: "Bundles", align: "right" },
      { key: "purchased", label: "Purchased", align: "right" },
      { key: "available", label: "Available", align: "right" },
      { key: "value", label: "Stock value", align: "right" },
      { key: "status", label: "Status" },
    ],
    build: (data, f) =>
      data.materials
        .filter((m) => (!f.material || m.name === f.material) && match(m.status, f.status))
        .map((m) => {
          const bundles = data.bundles.filter((b) => b.materialId === m.id);
          const purchased = bundles.reduce((s, b) => s + b.purchasedLength, 0);
          return {
            code: m.code,
            name: m.name,
            color: m.color ?? "—",
            unit: m.unit,
            bundles: bundles.length,
            purchased: round(purchased),
            available: round(m.availableStock),
            value: round(m.availableStock * m.costPerUnit),
            status: m.status,
          };
        }),
  },
  {
    id: "low-stock",
    section: "inventory",
    title: "Low Stock",
    description: "Materials with no available bundles left, or under 10% of purchased length.",
    permission: "reports.inventory.view",
    filters: ["material", "status"],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Material" },
      { key: "available", label: "Available", align: "right" },
      { key: "purchased", label: "Purchased", align: "right" },
      { key: "remainingPct", label: "Remaining %", align: "right" },
      { key: "availableBundles", label: "Available bundles", align: "right" },
    ],
    build: (data, f) =>
      data.materials
        .filter((m) => (!f.material || m.name === f.material) && match(m.status, f.status))
        .map((m) => {
          const bundles = data.bundles.filter((b) => b.materialId === m.id);
          const purchased = bundles.reduce((s, b) => s + b.purchasedLength, 0);
          const availableBundles = bundles.filter((b) => b.status === "available").length;
          const pct = purchased ? Math.round((m.availableStock / purchased) * 100) : 0;
          return {
            code: m.code,
            name: m.name,
            available: round(m.availableStock),
            purchased: round(purchased),
            remainingPct: pct,
            availableBundles,
          } as ReportRow;
        })
        .filter((r) => (r.availableBundles as number) === 0 || (r.remainingPct as number) < 10),
    note: "Threshold: zero available bundles, or less than 10% of purchased length remaining.",
  },
  {
    id: "inventory-consumption",
    section: "inventory",
    title: "Material Consumption",
    description: "Length allocated out of inventory bundles per material.",
    permission: "reports.inventory.view",
    filters: ["material"],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Material" },
      { key: "unit", label: "Unit" },
      { key: "purchased", label: "Purchased", align: "right" },
      { key: "allocated", label: "Consumed", align: "right" },
      { key: "consumedPct", label: "Consumed %", align: "right" },
      { key: "cost", label: "Consumed value", align: "right" },
    ],
    build: (data, f) =>
      data.materials
        .filter((m) => !f.material || m.name === f.material)
        .map((m) => {
          const bundles = data.bundles.filter((b) => b.materialId === m.id);
          const purchased = bundles.reduce((s, b) => s + b.purchasedLength, 0);
          const allocated = bundles.reduce((s, b) => s + b.allocatedLength, 0);
          return {
            code: m.code,
            name: m.name,
            unit: m.unit,
            purchased: round(purchased),
            allocated: round(allocated),
            consumedPct: purchased ? Math.round((allocated / purchased) * 100) : 0,
            cost: round(allocated * m.costPerUnit),
          };
        })
        .filter((r) => (r.purchased as number) > 0),
  },
  {
    id: "bundle-usage",
    section: "inventory",
    title: "Bundle Usage",
    description: "Every fabric bundle with its allocation state.",
    permission: "reports.inventory.view",
    filters: ["dateRange", "material", "status"],
    columns: [
      { key: "material", label: "Material" },
      { key: "bundle", label: "Bundle #", align: "right" },
      { key: "width", label: "Fabric width" },
      { key: "layer", label: "Layer length", align: "right" },
      { key: "purchased", label: "Purchased", align: "right" },
      { key: "allocated", label: "Allocated", align: "right" },
      { key: "remaining", label: "Remaining", align: "right" },
      { key: "status", label: "Status" },
      { key: "created", label: "Added" },
    ],
    build: (data, f) =>
      data.bundles
        .filter((b) => inRange(b.createdAt, f) && match(b.status, f.status))
        .map((b) => {
          const m = data.materials.find((x) => x.id === b.materialId);
          return {
            material: m ? `${m.code} · ${m.name}` : "—",
            bundle: b.bundleNumber,
            width: b.fabricWidth,
            layer: round(b.layerLength),
            purchased: round(b.purchasedLength),
            allocated: round(b.allocatedLength),
            remaining: round(Math.max(0, b.purchasedLength - b.allocatedLength)),
            status: b.status,
            created: fmtDate(b.createdAt),
            _material: m?.name ?? "",
          } as ReportRow & { _material: string };
        })
        .filter((r) => !f.material || (r as any)._material === f.material)
        .map((r) => {
          delete (r as any)._material;
          return r;
        }),
  },
  {
    id: "purchase-cost-summary",
    section: "inventory",
    title: "Purchase Cost Summary",
    description: "Purchased length × cost per unit for each material.",
    permission: "reports.inventory.view",
    filters: ["dateRange", "material", "status"],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Material" },
      { key: "unit", label: "Unit" },
      { key: "bundles", label: "Bundles", align: "right" },
      { key: "purchased", label: "Purchased qty", align: "right" },
      { key: "rate", label: "Cost / unit", align: "right" },
      { key: "total", label: "Purchase value", align: "right" },
    ],
    build: (data, f) =>
      data.materials
        .filter((m) => (!f.material || m.name === f.material) && match(m.status, f.status))
        .map((m) => {
          const bundles = data.bundles.filter((b) => b.materialId === m.id && inRange(b.createdAt, f));
          const purchased = bundles.reduce((s, b) => s + b.purchasedLength, 0);
          return {
            code: m.code,
            name: m.name,
            unit: m.unit,
            bundles: bundles.length,
            purchased: round(purchased),
            rate: round(m.costPerUnit),
            total: round(purchased * m.costPerUnit),
          };
        })
        .filter((r) => (r.bundles as number) > 0),
  },

  /* ------------------------------- Stock ------------------------------ */
  {
    id: "ready-stock",
    section: "stock",
    title: "Ready Stock",
    description: "Finished goods from completed production orders.",
    permission: "reports.stock.view",
    filters: ["dateRange", "customer", "design", "productType", "productionOrder"],
    columns: [
      { key: "po", label: "PO" },
      { key: "design", label: "Design" },
      { key: "name", label: "Name" },
      { key: "customer", label: "Customer" },
      { key: "ordered", label: "Ordered", align: "right" },
      { key: "finished", label: "Finished", align: "right" },
      { key: "completed", label: "Completed" },
    ],
    build: (data, f) =>
      data.orders
        .filter(
          (o) =>
            o.status === "completed" &&
            inRange(o.completedAt, f) &&
            match(o.customer, f.customer) &&
            match(o.designCode, f.design) &&
            match(o.productType, f.productType) &&
            match(o.code, f.productionOrder),
        )
        .map((o) => ({
          po: o.code,
          design: o.designCode,
          name: o.designName,
          customer: o.customer,
          ordered: o.orderQuantity,
          finished: finishedQty(data, o.id, o.orderQuantity),
          completed: fmtDate(o.completedAt),
        })),
  },
  {
    id: "dispatch-ready",
    section: "stock",
    title: "Dispatch Ready",
    description: "Completed orders whose packing operation is finished.",
    permission: "reports.stock.view",
    filters: ["dateRange", "customer", "design", "productionOrder"],
    columns: [
      { key: "po", label: "PO" },
      { key: "design", label: "Design" },
      { key: "customer", label: "Customer" },
      { key: "finished", label: "Pieces", align: "right" },
      { key: "packed", label: "Packing completed" },
      { key: "age", label: "Waiting (days)", align: "right" },
    ],
    build: (data, f) =>
      data.orders
        .filter(
          (o) =>
            o.status === "completed" &&
            inRange(o.completedAt, f) &&
            match(o.customer, f.customer) &&
            match(o.designCode, f.design) &&
            match(o.code, f.productionOrder),
        )
        .map((o) => {
          const packing = data.activities
            .filter((a) => a.productionOrderId === o.id && a.operationId === "packing" && a.status === "completed")
            .map((a) => a.completedAt)
            .filter(Boolean)
            .sort()
            .at(-1);
          return {
            po: o.code,
            design: o.designCode,
            customer: o.customer,
            finished: finishedQty(data, o.id, o.orderQuantity),
            packed: fmtDate(packing ?? o.completedAt),
            age: daysBetween(packing ?? o.completedAt),
          };
        }),
    note: "Falls back to the order completion date when no packing activity was logged.",
  },
  {
    id: "product-availability",
    section: "stock",
    title: "Product Availability",
    description: "Finished pieces grouped by design and product type.",
    permission: "reports.stock.view",
    filters: ["customer", "design", "productType"],
    columns: [
      { key: "design", label: "Design" },
      { key: "name", label: "Name" },
      { key: "productType", label: "Product type" },
      { key: "customer", label: "Customer" },
      { key: "orders", label: "Completed POs", align: "right" },
      { key: "available", label: "Pieces available", align: "right" },
    ],
    build: (data, f) => {
      const map = new Map<string, ReportRow>();
      for (const o of data.orders) {
        if (o.status !== "completed") continue;
        if (!match(o.customer, f.customer) || !match(o.designCode, f.design) || !match(o.productType, f.productType))
          continue;
        const row =
          map.get(o.designId) ??
          ({
            design: o.designCode,
            name: o.designName,
            productType: o.productType,
            customer: o.customer,
            orders: 0,
            available: 0,
          } as ReportRow);
        row.orders = (row.orders as number) + 1;
        row.available = (row.available as number) + finishedQty(data, o.id, o.orderQuantity);
        map.set(o.designId, row);
      }
      return [...map.values()];
    },
  },

  /* ------------------------------- Users ------------------------------ */
  {
    id: "user-activity",
    section: "users",
    title: "User Activity",
    description: "Records each user created or approved across the workspace.",
    permission: "reports.users.view",
    filters: ["dateRange", "user"],
    columns: [
      { key: "user", label: "User" },
      { key: "roles", label: "Roles" },
      { key: "designs", label: "Designs created", align: "right" },
      { key: "approvals", label: "Sample approvals", align: "right" },
      { key: "lastAction", label: "Last recorded action" },
    ],
    build: (data, f) =>
      data.users
        .filter((u) => !f.user || u.email === f.user)
        .map((u) => {
          const designs = data.designs.filter((d) => d.createdBy === u.userId && inRange(d.createdAt, f));
          const approvals = data.approvals.filter(
            (a) => a.approverUserId === u.userId && inRange(a.approvedAt, f),
          );
          const last = [...designs.map((d) => d.createdAt), ...approvals.map((a) => a.approvedAt)]
            .sort()
            .at(-1);
          return {
            user: u.email,
            roles: u.roles.join(", ") || "—",
            designs: designs.length,
            approvals: approvals.length,
            lastAction: fmtDateTime(last ?? null),
          };
        }),
    note: "Derived from records users authored — the workspace has no separate audit-log table.",
  },
  {
    id: "login-history",
    section: "users",
    title: "Login History",
    description: "Most recent recorded action per user, used as a proxy for activity.",
    permission: "reports.users.view",
    filters: ["dateRange", "user"],
    columns: [
      { key: "user", label: "User" },
      { key: "roles", label: "Roles" },
      { key: "lastSeen", label: "Last recorded action" },
      { key: "daysAgo", label: "Days ago", align: "right" },
    ],
    build: (data, f) =>
      data.users
        .filter((u) => !f.user || u.email === f.user)
        .map((u) => {
          const stamps = [
            ...data.designs.filter((d) => d.createdBy === u.userId).map((d) => d.updatedAt),
            ...data.approvals.filter((a) => a.approverUserId === u.userId).map((a) => a.approvedAt),
          ]
            .filter((s) => inRange(s, f))
            .sort();
          const last = stamps.at(-1) ?? null;
          return {
            user: u.email,
            roles: u.roles.join(", ") || "—",
            lastSeen: fmtDateTime(last),
            daysAgo: last ? daysBetween(last) : 0,
          };
        }),
    note: "Authentication sign-in timestamps are not exposed to the application, so this shows last workspace activity instead.",
  },
  {
    id: "role-assignment",
    section: "users",
    title: "Role Assignment",
    description: "Which roles each user holds, and how many users each role has.",
    permission: "reports.users.view",
    filters: ["user"],
    columns: [
      { key: "user", label: "User" },
      { key: "roles", label: "Roles" },
      { key: "roleCount", label: "Roles held", align: "right" },
    ],
    build: (data, f) =>
      data.users
        .filter((u) => !f.user || u.email === f.user)
        .map((u) => ({
          user: u.email,
          roles: u.roles.join(", ") || "No role assigned",
          roleCount: u.roles.length,
        })),
  },
  {
    id: "permission-summary",
    section: "users",
    title: "Permission Summary",
    description: "Permission coverage per role across the catalog.",
    permission: "reports.users.view",
    filters: [],
    columns: [
      { key: "role", label: "Role" },
      { key: "key", label: "Key" },
      { key: "users", label: "Users", align: "right" },
      { key: "permissions", label: "Permissions", align: "right" },
      { key: "coverage", label: "Coverage %", align: "right" },
      { key: "active", label: "Active" },
    ],
    build: (data) => {
      const total = data.permissions.length || 1;
      return data.roles.map((r) => ({
        role: r.label,
        key: r.key,
        users: r.userCount,
        permissions: r.grantsAll ? total : r.permissionCount,
        coverage: r.grantsAll ? 100 : Math.round((r.permissionCount / total) * 100),
        active: r.isActive ? "Yes" : "No",
      }));
    },
  },
];

export function reportById(id: string): ReportDefinition | undefined {
  return REPORTS.find((r) => r.id === id);
}

export function reportsForSection(section: SectionId): ReportDefinition[] {
  return REPORTS.filter((r) => r.section === section);
}

/* --------------------------- dashboard cards -------------------------- */

export type SummaryCard = {
  id: string;
  label: string;
  value: string;
  hint: string;
};

export function buildSummaryCards(data: ReportsData | undefined): SummaryCard[] {
  const d = data;
  const designs = d?.designs ?? [];
  const orders = d?.orders ?? [];
  const materials = d?.materials ?? [];
  const running = orders.filter((o) => o.status === "running");
  const completed = orders.filter((o) => o.status === "completed");
  const readyPieces = d
    ? completed.reduce((s, o) => s + finishedQty(d, o.id, o.orderQuantity), 0)
    : 0;
  const inventoryValue = materials.reduce((s, m) => s + m.availableStock * m.costPerUnit, 0);

  return [
    {
      id: "total-designs",
      label: "Total Designs",
      value: String(designs.length),
      hint: `${designs.filter((x) => x.status === "draft").length} in draft`,
    },
    {
      id: "sample-development",
      label: "Sample Development",
      value: String(designs.filter((x) => x.status === "sampling").length),
      hint: `${designs.filter((x) => x.status === "sample_approved").length} approved`,
    },
    {
      id: "production-running",
      label: "Production Running",
      value: String(running.length),
      hint: `${running.reduce((s, o) => s + o.orderQuantity, 0)} pcs in flight`,
    },
    {
      id: "production-completed",
      label: "Production Completed",
      value: String(completed.length),
      hint: `${completed.reduce((s, o) => s + o.orderQuantity, 0)} pcs ordered`,
    },
    {
      id: "ready-stock",
      label: "Ready Stock",
      value: `${readyPieces} pcs`,
      hint: `${completed.length} completed orders`,
    },
    {
      id: "inventory-value",
      label: "Inventory Value",
      value: round(inventoryValue).toLocaleString(),
      hint: `${materials.length} materials on file`,
    },
  ];
}

/* ------------------------- filter option lists ------------------------ */

export type FilterOptions = Record<FilterKey, string[]>;

export function buildFilterOptions(data: ReportsData | undefined): FilterOptions {
  const uniq = (xs: (string | null | undefined)[]) =>
    [...new Set(xs.filter((x): x is string => !!x))].sort();

  return {
    dateRange: [],
    customer: uniq((data?.designs ?? []).map((d) => d.customer)),
    design: uniq((data?.designs ?? []).map((d) => d.code)),
    productType: uniq((data?.designs ?? []).map((d) => d.productType)),
    status: uniq([
      ...(data?.designs ?? []).map((d) => d.status),
      ...(data?.orders ?? []).map((o) => o.status),
      ...(data?.activities ?? []).map((a) => a.status),
      ...(data?.materials ?? []).map((m) => m.status),
      ...(data?.bundles ?? []).map((b) => b.status),
    ]),
    designer: uniq((data?.designs ?? []).map((d) => (data ? designerName(data, d.createdBy) : null))),
    workstation: uniq((data?.activities ?? []).map((a) => a.workstationId)),
    productionOrder: uniq((data?.orders ?? []).map((o) => o.code)),
    material: uniq((data?.materials ?? []).map((m) => m.name)),
    user: uniq([
      ...(data?.users ?? []).map((u) => u.email),
      ...(data?.activities ?? []).map((a) => a.assignedTo),
    ]),
  };
}
