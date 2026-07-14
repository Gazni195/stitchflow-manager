// Helpers each production module uses to plug into the design's
// configured workflow (subtitle, timeline, next-step link).
import { Link, useSearch } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useDesignWorkflow,
  resolveStep,
  getNextStep,
  stepLabel,
  type WorkflowStep,
  type DesignWorkflow,
} from "@/lib/design-workflow";
import { getOperation, type OperationId } from "@/lib/operations";
import {
  ProductionTimeline,
  buildTimelineFromWorkflow,
  SectionHeader,
} from "./ui";

export type StageChrome = {
  wf: DesignWorkflow;
  step: WorkflowStep | undefined;
  sequence: number;
  total: number;
  subtitle: string;
  timeline: ReturnType<typeof buildTimelineFromWorkflow>;
  next: WorkflowStep | undefined;
};

export function useStageChrome(
  designCode: string,
  operationId: OperationId,
): StageChrome {
  const wf = useDesignWorkflow(designCode);
  // Optional deep-link ?step=<uuid>
  let stepId: string | undefined;
  try {
    const search = useSearch({ strict: false }) as { step?: string };
    stepId = search?.step;
  } catch {
    stepId = undefined;
  }
  const step = resolveStep(wf, operationId, stepId);
  const op = getOperation(operationId);
  const total = wf.steps.length;
  const sequence = step?.sequence ?? 0;
  const subtitle = step
    ? `Step ${sequence} of ${total} · ${op.category}`
    : `${op.name} not configured for ${designCode}`;
  const timeline = buildTimelineFromWorkflow(wf, step?.stepId);
  const next = getNextStep(wf, step?.stepId);
  return { wf, step, sequence, total, subtitle, timeline, next };
}

export function NextStepButton({ next }: { next: WorkflowStep | undefined }) {
  if (!next) {
    return (
      <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-4 py-3.5 text-sm font-bold text-muted-foreground">
        <CheckCircle2 className="h-4 w-4" /> Workflow complete
      </div>
    );
  }
  const op = getOperation(next.operationId);
  return (
    <Link
      to={op.route}
      search={{ step: next.stepId } as Record<string, string>}
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
    >
      Continue to {op.short} <ArrowRight className="h-4 w-4" />
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
        hint={`${chrome.total} steps configured for ${chrome.wf.designCode}`}
      />
      <ProductionTimeline steps={chrome.timeline} currentIcon={currentIcon} />
    </section>
  );
}

export function stepDisplayName(step: WorkflowStep, wf: DesignWorkflow) {
  return stepLabel(step, wf);
}
