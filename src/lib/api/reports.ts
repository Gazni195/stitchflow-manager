// Reporting data layer.
//
// Reports are *derived* views over the tables the operational modules already
// own — no new tables, no duplicated business logic. This module performs one
// batched read of every dataset the report registry can consume and normalises
// it into camelCase rows; `src/lib/reports/definitions.ts` turns those rows
// into the individual reports.
//
// Each query is wrapped in `safe()` so a user whose role can read production
// but not, say, users still gets the reports they *are* allowed to see instead
// of a hard failure — RLS remains the single enforcement point.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DesignStatus } from "@/lib/designs";

async function safe<T>(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  try {
    const { data, error } = await p;
    if (error) return [];
    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Normalised row shapes                                               */
/* ------------------------------------------------------------------ */

export type ReportDesign = {
  id: string;
  code: string;
  name: string;
  customer: string;
  category: string;
  productType: string;
  color: string;
  orderQuantity: number;
  status: DesignStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReportApproval = {
  designId: string;
  role: string;
  approverName: string;
  approverUserId: string | null;
  approvedAt: string;
  notes: string | null;
};

export type ReportWorkflowStep = {
  id: string;
  designId: string;
  kind: string;
  operationId: string;
  sequence: number;
  label: string | null;
  status: string;
  assignedTo: string | null;
  inputQuantity: number | null;
  outputQuantity: number | null;
  wastageQuantity: number | null;
  durationSeconds: number | null;
  hourlyRate: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type ReportDesignMaterial = {
  designId: string;
  materialId: string;
  groupName: string;
  quantity: number;
  rate: number;
};

export type ReportMaterial = {
  id: string;
  code: string;
  name: string;
  color: string | null;
  unit: string;
  costPerUnit: number;
  availableStock: number;
  status: string;
  createdAt: string;
};

export type ReportBundle = {
  id: string;
  materialId: string;
  bundleNumber: number;
  fabricWidth: string;
  purchasedLength: number;
  layerLength: number;
  allocatedLength: number;
  status: string;
  createdAt: string;
};

export type ReportOrder = {
  id: string;
  code: string;
  designId: string;
  designCode: string;
  designName: string;
  customer: string;
  productType: string;
  orderQuantity: number;
  startDate: string;
  supervisor: string | null;
  status: string;
  completedAt: string | null;
  createdAt: string;
};

export type ReportProcess = {
  id: string;
  productionOrderId: string;
  operationId: string;
  sequence: number;
  status: string;
  workstationId: string | null;
  assignedTo: string | null;
  issuedQty: number | null;
  returnedQty: number | null;
  completedAt: string | null;
};

export type ReportActivity = {
  id: string;
  productionOrderId: string;
  operationId: string;
  workstationId: string | null;
  assignedTo: string;
  issuedQty: number;
  returnedQty: number | null;
  status: string;
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  elapsedSeconds: number | null;
  effectiveSeconds: number | null;
  pausedSeconds: number;
};

export type ReportUser = {
  userId: string;
  email: string;
  roles: string[];
};

export type ReportRole = {
  id: string;
  key: string;
  label: string;
  grantsAll: boolean;
  isActive: boolean;
  permissionCount: number;
  userCount: number;
};

export type ReportPermission = {
  id: string;
  key: string;
  module: string;
  label: string;
  nodeType: string;
  category: string | null;
};

export type ReportsData = {
  designs: ReportDesign[];
  approvals: ReportApproval[];
  steps: ReportWorkflowStep[];
  designMaterials: ReportDesignMaterial[];
  materials: ReportMaterial[];
  bundles: ReportBundle[];
  orders: ReportOrder[];
  processes: ReportProcess[];
  activities: ReportActivity[];
  users: ReportUser[];
  roles: ReportRole[];
  permissions: ReportPermission[];
};

/* ------------------------------------------------------------------ */
/* Loader                                                              */
/* ------------------------------------------------------------------ */

const anyDb = () => supabase as unknown as {
  from: (t: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export function useReportsData() {
  return useQuery({
    queryKey: ["reports", "dataset"],
    staleTime: 30_000,
    queryFn: async (): Promise<ReportsData> => {
      const db = anyDb();

      const [
        designRows,
        approvalRows,
        workflowRows,
        stepRows,
        designMaterialRows,
        materialRows,
        bundleRows,
        orderRows,
        processRows,
        activityRows,
        userRows,
        roleRows,
        rolePermRows,
        userRoleRows,
        permissionRows,
      ] = await Promise.all([
        safe<any>(
          db
            .from("designs")
            .select(
              "id, code, name, customer, category, product_type, color, order_quantity, status, created_by, created_at, updated_at",
            )
            .order("created_at", { ascending: false }),
        ),
        safe<any>(
          db
            .from("sample_approvals")
            .select("design_id, role, approver_name, approver_user_id, approved_at, notes"),
        ),
        safe<any>(db.from("design_workflows").select("id, design_id, kind")),
        safe<any>(
          db
            .from("workflow_steps")
            .select(
              "id, workflow_id, operation_id, sequence, label, status, assigned_to, input_quantity, output_quantity, wastage_quantity, duration_seconds, hourly_rate, started_at, completed_at, created_at",
            ),
        ),
        safe<any>(
          db.from("design_materials").select("design_id, material_id, group_name, quantity, rate"),
        ),
        safe<any>(
          db
            .from("materials")
            .select(
              "id, code, name, color, unit, cost_per_unit, available_stock, status, created_at",
            ),
        ),
        safe<any>(
          db
            .from("inventory_bundles")
            .select(
              "id, material_id, bundle_number, fabric_width, purchased_length, layer_length, allocated_length, status, created_at",
            ),
        ),
        safe<any>(
          db
            .from("production_orders")
            .select(
              "id, code, design_id, order_quantity, start_date, supervisor, status, completed_at, created_at, designs(code, name, customer, product_type)",
            ),
        ),
        safe<any>(
          db
            .from("production_processes")
            .select(
              "id, production_order_id, operation_id, sequence, status, workstation_id, assigned_to, issued_qty, returned_qty, completed_at",
            ),
        ),
        safe<any>(
          db
            .from("production_activities")
            .select(
              "id, production_order_id, operation_id, workstation_id, assigned_to, issued_qty, returned_qty, status, assigned_at, started_at, completed_at, elapsed_seconds, effective_seconds, paused_seconds",
            ),
        ),
        safe<any>(db.rpc("list_users_with_roles")),
        safe<any>(db.from("roles").select("id, key, label, grants_all, is_active").order("label")),
        safe<any>(db.from("role_permissions").select("role_id")),
        safe<any>(db.from("user_roles").select("role_id")),
        safe<any>(db.from("permissions").select("id, key, module, label, node_type, category")),
      ]);

      const workflowById = new Map<string, { designId: string; kind: string }>(
        workflowRows.map((w) => [w.id as string, { designId: w.design_id as string, kind: w.kind as string }]),
      );

      const permCounts = new Map<string, number>();
      for (const r of rolePermRows) permCounts.set(r.role_id, (permCounts.get(r.role_id) ?? 0) + 1);
      const userCounts = new Map<string, number>();
      for (const r of userRoleRows) userCounts.set(r.role_id, (userCounts.get(r.role_id) ?? 0) + 1);

      return {
        designs: designRows.map((d) => ({
          id: d.id,
          code: d.code ?? "",
          name: d.name ?? "",
          customer: d.customer ?? "",
          category: d.category ?? "",
          productType: d.product_type ?? "",
          color: d.color ?? "",
          orderQuantity: Number(d.order_quantity ?? 0),
          status: d.status as DesignStatus,
          createdBy: d.created_by ?? null,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        })),
        approvals: approvalRows.map((a) => ({
          designId: a.design_id,
          role: a.role ?? "",
          approverName: a.approver_name ?? "",
          approverUserId: a.approver_user_id ?? null,
          approvedAt: a.approved_at,
          notes: a.notes ?? null,
        })),
        steps: stepRows
          .map((s) => {
            const wf = workflowById.get(s.workflow_id);
            if (!wf) return null;
            return {
              id: s.id,
              designId: wf.designId,
              kind: wf.kind,
              operationId: s.operation_id ?? "",
              sequence: Number(s.sequence ?? 0),
              label: s.label ?? null,
              status: s.status ?? "",
              assignedTo: s.assigned_to ?? null,
              inputQuantity: s.input_quantity ?? null,
              outputQuantity: s.output_quantity ?? null,
              wastageQuantity: s.wastage_quantity ?? null,
              durationSeconds: s.duration_seconds ?? null,
              hourlyRate: Number(s.hourly_rate ?? 0),
              startedAt: s.started_at ?? null,
              completedAt: s.completed_at ?? null,
              createdAt: s.created_at,
            } as ReportWorkflowStep;
          })
          .filter((s): s is ReportWorkflowStep => !!s),
        designMaterials: designMaterialRows.map((m) => ({
          designId: m.design_id,
          materialId: m.material_id,
          groupName: m.group_name ?? "",
          quantity: Number(m.quantity ?? 0),
          rate: Number(m.rate ?? 0),
        })),
        materials: materialRows.map((m) => ({
          id: m.id,
          code: m.code ?? "",
          name: m.name ?? "",
          color: m.color ?? null,
          unit: m.unit ?? "",
          costPerUnit: Number(m.cost_per_unit ?? 0),
          availableStock: Number(m.available_stock ?? 0),
          status: m.status ?? "",
          createdAt: m.created_at,
        })),
        bundles: bundleRows.map((b) => ({
          id: b.id,
          materialId: b.material_id,
          bundleNumber: Number(b.bundle_number ?? 0),
          fabricWidth: b.fabric_width ?? "",
          purchasedLength: Number(b.purchased_length ?? 0),
          layerLength: Number(b.layer_length ?? 0),
          allocatedLength: Number(b.allocated_length ?? 0),
          status: b.status ?? "",
          createdAt: b.created_at,
        })),
        orders: orderRows.map((o) => ({
          id: o.id,
          code: o.code ?? "",
          designId: o.design_id,
          designCode: o.designs?.code ?? "",
          designName: o.designs?.name ?? "",
          customer: o.designs?.customer ?? "",
          productType: o.designs?.product_type ?? "",
          orderQuantity: Number(o.order_quantity ?? 0),
          startDate: o.start_date,
          supervisor: o.supervisor ?? null,
          status: o.status ?? "",
          completedAt: o.completed_at ?? null,
          createdAt: o.created_at,
        })),
        processes: processRows.map((p) => ({
          id: p.id,
          productionOrderId: p.production_order_id,
          operationId: p.operation_id ?? "",
          sequence: Number(p.sequence ?? 0),
          status: p.status ?? "",
          workstationId: p.workstation_id ?? null,
          assignedTo: p.assigned_to ?? null,
          issuedQty: p.issued_qty ?? null,
          returnedQty: p.returned_qty ?? null,
          completedAt: p.completed_at ?? null,
        })),
        activities: activityRows.map((a) => ({
          id: a.id,
          productionOrderId: a.production_order_id,
          operationId: a.operation_id ?? "",
          workstationId: a.workstation_id ?? null,
          assignedTo: a.assigned_to ?? "",
          issuedQty: Number(a.issued_qty ?? 0),
          returnedQty: a.returned_qty ?? null,
          status: a.status ?? "",
          assignedAt: a.assigned_at,
          startedAt: a.started_at ?? null,
          completedAt: a.completed_at ?? null,
          elapsedSeconds: a.elapsed_seconds ?? null,
          effectiveSeconds: a.effective_seconds ?? null,
          pausedSeconds: Number(a.paused_seconds ?? 0),
        })),
        users: userRows.map((u) => ({
          userId: u.user_id,
          email: u.email ?? "",
          roles: Array.isArray(u.roles)
            ? (u.roles as any[]).map((r) => (typeof r === "string" ? r : (r?.label ?? r?.key ?? "")))
            : [],
        })),
        roles: roleRows.map((r) => ({
          id: r.id,
          key: r.key ?? "",
          label: r.label ?? "",
          grantsAll: !!r.grants_all,
          isActive: !!r.is_active,
          permissionCount: permCounts.get(r.id) ?? 0,
          userCount: userCounts.get(r.id) ?? 0,
        })),
        permissions: permissionRows.map((p) => ({
          id: p.id,
          key: p.key ?? "",
          module: p.module ?? "",
          label: p.label ?? "",
          nodeType: p.node_type ?? "",
          category: p.category ?? null,
        })),
      };
    },
  });
}
