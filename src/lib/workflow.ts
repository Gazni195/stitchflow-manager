// Supabase-backed workflow CRUD with react-query hooks.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LucideIcon } from "lucide-react";
import {
  Barcode,
  Coins,
  FileCheck2,
  FilePlus2,
  Hand,
  Layers,
  Package,
  Pin,
  Scissors,
  ShieldCheck,
  Warehouse,
} from "lucide-react";

export type WorkflowStage = {
  id: string;
  step: number;
  title: string;
  phase: string;
  description: string;
  icon: LucideIcon;
  to: string;
};

export const WORKFLOW: WorkflowStage[] = [
  {
    id: "sample-creation",
    step: 1,
    title: "Sample Creation",
    phase: "Pre-Production",
    description: "Create and register new sample requests for styles.",
    icon: FilePlus2,
    to: "/samples",
  },
  {
    id: "material-selection",
    step: 2,
    title: "Material Selection",
    phase: "Pre-Production",
    description: "Choose fabrics, trims, and accessories for each garment part.",
    icon: Layers,
    to: "/materials",
  },
  {
    id: "costing",
    step: 3,
    title: "Costing",
    phase: "Pre-Production",
    description: "Calculate material, labor, and overhead costs before approval.",
    icon: Coins,
    to: "/costing",
  },
  {
    id: "sample-making",
    step: 4,
    title: "Sample Making",
    phase: "Sampling",
    description: "Sew the prototype and record sample construction details.",
    icon: Scissors,
    to: "/sample-making",
  },
  {
    id: "sample-approval",
    step: 5,
    title: "Sample Approval",
    phase: "Sampling",
    description: "Designer, merchandiser, and production head sign-off.",
    icon: FileCheck2,
    to: "/approvals",
  },
  {
    id: "cutting",
    step: 6,
    title: "Bulk Cutting",
    phase: "Production",
    description: "Cut bulk fabric bundles according to the approved pattern.",
    icon: Scissors,
    to: "/cutting",
  },
  {
    id: "handwork",
    step: 7,
    title: "Bulk Hand Work",
    phase: "Production",
    description: "Embroidery, beadwork, and other manual surface embellishments.",
    icon: Hand,
    to: "/handwork",
  },
  {
    id: "stitching",
    step: 8,
    title: "Bulk Stitching",
    phase: "Production",
    description: "Assemble cut parts into finished garments on the line.",
    icon: Pin,
    to: "/stitching",
  },
  {
    id: "qc",
    step: 9,
    title: "Quality Check",
    phase: "Production",
    description: "Inspect finished pieces against quality standards.",
    icon: ShieldCheck,
    to: "/qc",
  },
  {
    id: "packing",
    step: 10,
    title: "Packaging",
    phase: "Post-Production",
    description: "Fold, tag, and pack approved garments for dispatch.",
    icon: Package,
    to: "/packing",
  },
  {
    id: "barcode",
    step: 11,
    title: "Barcode",
    phase: "Post-Production",
    description: "Generate and attach barcodes for inventory tracking.",
    icon: Barcode,
    to: "/barcode",
  },
  {
    id: "ready-stock",
    step: 12,
    title: "Ready Stock",
    phase: "Post-Production",
    description: "Move finished and packed goods into the warehouse.",
    icon: Warehouse,
    to: "/stock",
  },
];

export type WorkflowKind = "sample" | "bulk";
export type StepStatus = "pending" | "in-progress" | "completed" | "skipped" | "deleted";

export type WorkflowStep = {
  id: string;
  workflowId: string;
  operationId: string;
  sequence: number;
  label: string | null;
  status: StepStatus;
  assignedTo: string | null;
  inputQuantity: number | null;
  outputQuantity: number | null;
  wastageQuantity: number | null;
  startDate: string | null;
  endDate: string | null;
  remarks: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  hourlyRate: number;
  garmentPart: string | null;
  workArea: string | null;
  customArea: string | null;
};

export type DesignWorkflow = {
  id: string;
  designId: string;
  kind: WorkflowKind;
  locked: boolean;
  steps: WorkflowStep[];
};

type DbStep = {
  id: string;
  workflow_id: string;
  operation_id: string;
  sequence: number;
  label: string | null;
  status: StepStatus;
  assigned_to: string | null;
  input_quantity: number | null;
  output_quantity: number | null;
  wastage_quantity: number | null;
  start_date: string | null;
  end_date: string | null;
  remarks: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  hourly_rate: number | string | null;
  garment_part: string | null;
  work_area: string | null;
  custom_area: string | null;
};

function mapStep(r: DbStep): WorkflowStep {
  return {
    id: r.id,
    workflowId: r.workflow_id,
    operationId: r.operation_id,
    sequence: r.sequence,
    label: r.label,
    status: r.status,
    assignedTo: r.assigned_to,
    inputQuantity: r.input_quantity,
    outputQuantity: r.output_quantity,
    wastageQuantity: r.wastage_quantity,
    startDate: r.start_date,
    endDate: r.end_date,
    remarks: r.remarks,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    durationSeconds: r.duration_seconds,
    hourlyRate: r.hourly_rate == null ? 150 : Number(r.hourly_rate),
    garmentPart: r.garment_part,
    workArea: r.work_area,
    customArea: r.custom_area,
  };
}

export function useWorkflows(designId: string | undefined) {
  return useQuery({
    queryKey: ["workflows", designId],
    enabled: !!designId,
    queryFn: async (): Promise<DesignWorkflow[]> => {
      const { data: wfs, error } = await supabase.from("design_workflows").select("*").eq("design_id", designId!);
      if (error) throw error;
      const ids = (wfs ?? []).map((w) => w.id);
      let steps: DbStep[] = [];
      if (ids.length) {
        const { data: ss, error: sErr } = await supabase
          .from("workflow_steps")
          .select("*")
          .in("workflow_id", ids)
          .order("sequence", { ascending: true });
        if (sErr) throw sErr;
        steps = ss as DbStep[];
      }
      return (wfs as Array<{ id: string; design_id: string; kind: WorkflowKind; locked: boolean }>).map((w) => ({
        id: w.id,
        designId: w.design_id,
        kind: w.kind,
        locked: w.locked,
        steps: steps.filter((s) => s.workflow_id === w.id).map(mapStep),
      }));
    },
  });
}

// ------ mutations ------

function invalidate(qc: ReturnType<typeof useQueryClient>, designId: string) {
  qc.invalidateQueries({ queryKey: ["workflows", designId] });
  qc.invalidateQueries({ queryKey: ["designs"] });
  qc.invalidateQueries({ predicate: (query) => query.queryKey[0] === "design" });
}

export function useAddStep(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { workflowId: string; operationId: string; sequence: number }): Promise<string> => {
      const { data, error } = await supabase
        .from("workflow_steps")
        .insert({
          workflow_id: v.workflowId,
          operation_id: v.operationId,
          sequence: v.sequence,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => invalidate(qc, designId),
  });
}

export function useDeleteStep(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stepId: string) => {
      const { error } = await supabase.from("workflow_steps").delete().eq("id", stepId);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc, designId),
  });
}

export function useUpdateStep(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { stepId: string; patch: Partial<Omit<WorkflowStep, "id" | "workflowId">> }) => {
      const p = v.patch;
      const dbPatch: Record<string, unknown> = {};
      if (p.operationId !== undefined) dbPatch.operation_id = p.operationId;
      if (p.sequence !== undefined) dbPatch.sequence = p.sequence;
      if (p.label !== undefined) dbPatch.label = p.label;
      if (p.status !== undefined) dbPatch.status = p.status;
      if (p.assignedTo !== undefined) dbPatch.assigned_to = p.assignedTo;
      if (p.inputQuantity !== undefined) dbPatch.input_quantity = p.inputQuantity;
      if (p.outputQuantity !== undefined) dbPatch.output_quantity = p.outputQuantity;
      if (p.wastageQuantity !== undefined) dbPatch.wastage_quantity = p.wastageQuantity;
      if (p.startDate !== undefined) dbPatch.start_date = p.startDate;
      if (p.endDate !== undefined) dbPatch.end_date = p.endDate;
      if (p.remarks !== undefined) dbPatch.remarks = p.remarks;
      if (p.startedAt !== undefined) dbPatch.started_at = p.startedAt;
      if (p.completedAt !== undefined) dbPatch.completed_at = p.completedAt;
      if (p.durationSeconds !== undefined) dbPatch.duration_seconds = p.durationSeconds;
      if (p.hourlyRate !== undefined) dbPatch.hourly_rate = p.hourlyRate;
      if (p.garmentPart !== undefined) dbPatch.garment_part = p.garmentPart;
      if (p.workArea !== undefined) dbPatch.work_area = p.workArea;
      if (p.customArea !== undefined) dbPatch.custom_area = p.customArea;
      const { error } = await (
        supabase.from("workflow_steps") as unknown as {
          update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
        }
      )
        .update(dbPatch)
        .eq("id", v.stepId);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc, designId),
  });
}

export function useReorderSteps(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Two-phase resequence to avoid unique conflicts if any (no unique on seq, but stay safe).
      // Set sequence values 1..N.
      await Promise.all(
        orderedIds.map((id, i) =>
          supabase
            .from("workflow_steps")
            .update({ sequence: i + 1 })
            .eq("id", id),
        ),
      );
    },
    onSuccess: () => invalidate(qc, designId),
  });
}

export function useApproveSample(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("approve_sample", { _design_id: designId });
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc, designId),
  });
}

// Reverse of approve_sample (above) — Withdraw Approval undoes a completed
// sample approval so it can be edited and resubmitted. This calls a
// SECURITY DEFINER RPC (supabase/migrations/..._revert_sample_approval.sql)
// rather than issuing the sample_approvals/design_workflows/designs writes
// directly from the client, for two concrete reasons found while
// debugging "Could not update sample":
//   1. sample_approvals has no client-facing DELETE (or UPDATE) RLS policy
//      at all — it was dropped in 20260721153518 and never recreated by
//      the later role-based policy migration, so a direct client delete
//      silently affects 0 rows.
//   2. design_workflows/designs writes are gated on the 'designs.edit'
//      permission, which the roles that actually record sample approvals
//      (e.g. production_manager, via 'approvals.create'/'approvals.edit')
//      do not hold — so those roles could never actually withdraw an
//      approval they themselves recorded.
// Running as SECURITY DEFINER with its own explicit permission check
// (mirroring how approve_sample already does this for the forward
// transition) fixes both gaps atomically instead of widening client RLS,
// and the RPC re-validates design.status === 'sample_approved' server-side
// so withdrawal is refused once production has actually started, matching
// the UI guard in sample-development.$code.tsx.
export function useReturnSampleToDevelopment(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.rpc("revert_sample_approval", { _design_id: designId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(qc, designId);
      qc.invalidateQueries({ queryKey: ["sample-approvals", designId] });
    },
  });
}

export function useStartBulkProduction(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("start_bulk_production", { _design_id: designId });
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc, designId),
  });
}

export function stepLabel(step: WorkflowStep, allSteps: WorkflowStep[], operationName: string): string {
  if (step.label) return step.label;
  const sameOp = allSteps.filter((s) => s.operationId === step.operationId);
  if (sameOp.length > 1) {
    const round = sameOp.findIndex((s) => s.id === step.id) + 1;
    return `${operationName} · Round ${round}`;
  }
  return operationName;
}
