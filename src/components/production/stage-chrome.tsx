// Helpers each production module uses to plug into the REAL saved bulk
// production workflow (the one configured in Start Production → Step 2).
//
// The workflow is read from `production_processes` for the design's
// production order — never from a hardcoded operation sequence.
import { Link, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  type WorkflowStep,
  type DesignWorkflow,
  type StepStatus,
  operationName,
  operationShort,
  operationRoute,
  stepLabel,
} from "@/lib/production-workflow";
import {
  ProductionTimeline,
  buildTimelineFromWorkflow,
  SectionHeader,
} from "./ui";

export type { StepStatus, WorkflowStep, DesignWorkflow } from "@/lib/production-workflow";
export { operationName, stepLabel } from "@/lib/production-workflow";

function mapStatus(dbStatus: string): StepStatus {
  if (dbStatus === "completed") return "completed";
  if (dbStatus === "issued") return "in-progress";
  return "pending";
}

/** Loads the saved bulk production workflow for a design code. */
export function useProductionWorkflow(designCode: string): {
  workflow: DesignWorkflow;
  isLoading: boolean;
  hasOrder: boolean;
} {
  const q = useQuery({
    queryKey: ["production", "workflow", designCode],
    enabled: !!designCode,
    queryFn: async (): Promise<WorkflowStep[] | null> => {
      const { data: po, error } = await supabase
        .from("production_orders")
        .select("id, created_at, designs!inner(code)")
        .eq("designs.code", designCode)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!po) return null;
      const { data: procs, error: pErr } = await supabase
        .from("production_processes")
        .select("id, operation_id, sequence, status")
        .eq("production_order_id", (po as { id: string }).id)
        .order("sequence", { ascending: true });
      if (pErr) throw pErr;
      return (procs ?? []).map((p) => ({
        stepId: p.id as string,
        operationId: p.operation_id as string,
        sequence: p.sequence as number,
        status: mapStatus(p.status as string),
      }));
    },
  });

  return {
    workflow: { designCode, steps: q.data ?? [] },
    isLoading: q.isLoading,
    hasOrder: !!q.data,
  };
}

/** First incomplete step of the saved workflow. */
export function getCurrentStep(wf: DesignWorkflow): WorkflowStep | undefined {
  return wf.steps.find((s) => s.status !== "completed" && s.status !== "skipped");
}

export function resolveStep(
  wf: DesignWorkflow,
  operationId: string,
  stepIdParam?: string,
): WorkflowStep | undefined {
  if (stepIdParam) {
    const byId = wf.steps.find((s) => s.stepId === stepIdParam);
    if (byId) return byId;
  }
  return (
    wf.steps.find((s) => s.operationId === operationId && s.status !== "completed") ??
    wf.steps.find((s) => s.operationId === operationId)
  );
}

export function getNextStep(
  wf: DesignWorkflow,
  fromStepId: string | undefined,
): WorkflowStep | undefined {
  if (!fromStepId) return getCurrentStep(wf);
  const idx = wf.steps.findIndex((s) => s.stepId === fromStepId);
  if (idx < 0) return undefined;
  for (let i = idx + 1; i < wf.steps.length; i++) {
    if (wf.steps[i].status !== "skipped") return wf.steps[i];
  }
  return undefined;
}

export type StageChrome = {
  wf: DesignWorkflow;
  step: WorkflowStep | undefined;
  sequence: number;
  total: number;
  subtitle: string;
  timeline: ReturnType<typeof buildTimelineFromWorkflow>;
  next: WorkflowStep | undefined;
  current: WorkflowStep | undefined;
  isLoading: boolean;
};

export function useStageChrome(
  designCode: string,
  operationId: string,
): StageChrome {
  const { workflow: wf, isLoading, hasOrder } = useProductionWorkflow(designCode);
  // Optional deep-link ?step=<uuid>
  let stepId: string | undefined;
  try {
    const search = useSearch({ strict: false }) as { step?: string };
    stepId = search?.step;
  } catch {
    stepId = undefined;
  }
  const step = resolveStep(wf, operationId, stepId);
  const total = wf.steps.length;
  const sequence = step?.sequence ?? 0;
  const subtitle = isLoading
    ? "Loading workflow…"
    : !hasOrder
      ? `No production workflow saved for ${designCode}`
      : step
        ? `Step ${sequence} of ${total} · ${stepLabel(step, wf)}`
        : `${operationName(operationId)} not configured for ${designCode}`;
  const current = getCurrentStep(wf);
  const timeline = buildTimelineFromWorkflow(wf, step?.stepId ?? current?.stepId);
  const next = getNextStep(wf, step?.stepId);
  return { wf, step, sequence, total, subtitle, timeline, next, current, isLoading };
}

export function NextStepButton({ next }: { next: WorkflowStep | undefined }) {
  const route = next ? operationRoute(next.operationId) : undefined;
  if (!next || !route) {
    return (
      <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-4 py-3.5 text-sm font-bold text-muted-foreground">
        <CheckCircle2 className="h-4 w-4" /> Workflow complete
      </div>
    );
  }
  return (
    <Link
      to={route}
      search={{ step: next.stepId } as Record<string, string>}
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
    >
      Continue to {operationShort(next.operationId)} <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export function StageTimelineCard({
  chrome,
  currentIcon,
}: {
  chrome: StageChrome;
  currentIcon?: LucideIcon;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <SectionHeader
        icon={<CheckCircle2 className="h-4 w-4" />}
        title="Production Timeline"
        hint={
          chrome.total
            ? `${chrome.total} steps configured for ${chrome.wf.designCode}`
            : `No workflow saved for ${chrome.wf.designCode}`
        }
      />
      <ProductionTimeline steps={chrome.timeline} currentIcon={currentIcon} />
    </section>
  );
}

export function stepDisplayName(step: WorkflowStep, wf: DesignWorkflow) {
  return stepLabel(step, wf);
}
