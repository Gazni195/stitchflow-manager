// Supabase-backed workflow CRUD with react-query hooks.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Shirt,
  FlaskConical,
  Layers,
  Hammer,
  Calculator,
  ShieldCheck,
  Scissors,
  Hand,
  Sparkles,
  QrCode,
  PackageCheck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { DesignStatus } from "@/lib/designs";

export type WorkflowStage = {
  id: string;
  step: number;
  phase: string;
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
};

export const WORKFLOW: WorkflowStage[] = [
  { id: "sample-creation", step: 1, phase: "Sampling", title: "Sample Creation", description: "Kick off a new style with a sample request.", to: "/samples", icon: Shirt },
  { id: "material-selection", step: 2, phase: "Sampling", title: "Material Selection", description: "Pick fabrics, trims and consumption.", to: "/materials", icon: Layers },
  { id: "sample-making", step: 3, phase: "Sampling", title: "Sample Making", description: "Produce the physical sample.", to: "/sample-making", icon: FlaskConical },
  { id: "costing", step: 4, phase: "Sampling", title: "Costing", description: "Compute per-piece costs.", to: "/costing", icon: Calculator },
  { id: "sample-approval", step: 5, phase: "Sampling", title: "Sample Approval", description: "Collect sign-offs before production.", to: "/approvals", icon: ShieldCheck },
  { id: "cutting", step: 6, phase: "Production", title: "Bulk Cutting", description: "Cut fabric per size breakdown.", to: "/cutting", icon: Scissors },
  { id: "handwork", step: 7, phase: "Production", title: "Hand Work", description: "Manual embellishments.", to: "/handwork", icon: Hand },
  { id: "stitching", step: 8, phase: "Production", title: "Bulk Stitching", description: "Assemble garments on the line.", to: "/stitching", icon: Hammer },
  { id: "qc", step: 9, phase: "Production", title: "Quality Check", description: "Inspect finished garments.", to: "/qc", icon: Sparkles },
  { id: "packing", step: 10, phase: "Finishing", title: "Packing", description: "Fold, tag and pack the order.", to: "/packing", icon: PackageCheck },
  { id: "barcode", step: 11, phase: "Finishing", title: "Barcode", description: "Generate and apply barcodes.", to: "/barcode", icon: QrCode },
  { id: "stock", step: 12, phase: "Finishing", title: "Ready Stock", description: "Move finished goods to stock.", to: "/stock", icon: Warehouse },
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

// Reverse of Design Approval a stage later — Return to Sample Development
// undoes a completed sample approval so it can be edited and resubmitted.
// Blocked once production has actually started: start_production flips
// designs.status to "in_production" the instant a Production Order is
// created (supabase/migrations/..._5e36e6ac...sql), so that one status
// value already covers both "converted into a PO" and "production work has
// started" — the UI guards on it (see canReturn in
// sample-development.$code.tsx) and this mutation never runs otherwise.
// Clears the existing sample_approvals sign-offs so the approval process
// must genuinely be redone (otherwise ApprovalPanel's auto-approve effect
// would instantly re-approve the moment status flips back to unlocked),
// unlocks the sample workflow for editing again, and removes the bulk
// workflow that approve_sample auto-generated as a point-in-time snapshot
// (workflow_steps cascade-delete with it — it holds no real production
// data since production never started). Design materials/costing and the
// sample workflow's own steps/history are untouched.
export function useReturnSampleToDevelopment(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error: approvalsErr } = await supabase.from("sample_approvals").delete().eq("design_id", designId);
      if (approvalsErr) throw approvalsErr;

      const { error: unlockErr } = await supabase
        .from("design_workflows")
        .update({ locked: false })
        .eq("design_id", designId)
        .eq("kind", "sample");
      if (unlockErr) throw unlockErr;

      const { error: bulkErr } = await supabase
        .from("design_workflows")
        .delete()
        .eq("design_id", designId)
        .eq("kind", "bulk");
      if (bulkErr) throw bulkErr;

      const { error: statusErr } = await supabase
        .from("designs")
        .update({ status: "sampling" as DesignStatus })
        .eq("id", designId);
      if (statusErr) throw statusErr;
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
