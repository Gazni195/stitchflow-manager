// Helpers each production module uses to plug into the design's real,
// saved Bulk Production workflow (subtitle, timeline, next-step link).
// Source of truth: design_workflows / workflow_steps (kind = 'bulk'),
// configured via Start Production → Configure Workflow. No hardcoded
// operation sequence lives here anymore.
import { Link, useSearch } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDesignByCode } from "@/lib/api/designs";
import { useWorkflows, type WorkflowStep } from "@/lib/api/workflows";
import { useOperationCatalog } from "@/lib/api/operations";
import {
  ProductionTimeline,
  buildTimelineFromWorkflow,
  SectionHeader,
} from "./ui";

export type StageChrome = {
  designCode: string;
  steps: WorkflowStep[];
  step: WorkflowStep | undefined;
  sequence: number;
  total: number;
  subtitle: string;
  timeline: ReturnType<typeof buildTimelineFromWorkflow>;
  next: WorkflowStep | undefined;
  isLoading: boolean;
};

function resolveStep(
  steps: WorkflowStep[],
  operationId: string,
  stepIdParam?: string,
): WorkflowStep | undefined {
  if (stepIdParam) {
    const byId = steps.find((s) => s.id === stepIdParam);
    if (byId) return byId;
  }
  return steps.find((s) => s.operationId === operationId);
}

function getCurrentStep(steps: WorkflowStep[]): WorkflowStep | undefined {
  return steps.find((s) => s.status !== "completed" && s.status !== "skipped");
}

function getNextStep(
  steps: WorkflowStep[],
  fromStepId: string | undefined,
): WorkflowStep | undefined {
  if (!fromStepId) return getCurrentStep(steps);
  const idx = steps.findIndex((s) => s.id === fromStepId);
  if (idx < 0) return undefined;
  for (let i = idx + 1; i < steps.length; i++) {
    if (steps[i].status !== "skipped") return steps[i];
  }
  return undefined;
}

export function useStageChrome(
  designCode: string,
  operationId: string,
): StageChrome {
  const { data: design, isLoading: designLoading } = useDesignByCode(designCode);
  const { data: workflows = [], isLoading: wfLoading } = useWorkflows(design?.id);
  const { data: catalog = [], isLoading: catalogLoading } = useOperationCatalog();
  const bulk = workflows.find((w) => w.kind === "bulk");
  const steps = bulk?.steps ?? [];

  // Optional deep-link ?step=<uuid> (real workflow_steps.id)
  let stepId: string | undefined;
  try {
    const search = useSearch({ strict: false }) as { step?: string };
    stepId = search?.step;
  } catch {
    stepId = undefined;
  }

  const isLoading = designLoading || wfLoading || catalogLoading;
  const step = resolveStep(steps, operationId, stepId);
  const op = catalog.find((o) => o.id === operationId);
  const total = steps.length;
  const sequence = step?.sequence ?? 0;

  const subtitle = isLoading
    ? "Loading workflow…"
    : !design
      ? `No design found for ${designCode}`
      : !bulk
        ? `No Bulk Production workflow started for ${designCode}`
        : step
          ? `Step ${sequence} of ${total} · ${op?.category ?? ""}`
          : `${op?.name ?? operationId} not configured for ${designCode}`;

  const timeline = buildTimelineFromWorkflow(steps, catalog, step?.id);
  const next = getNextStep(steps, step?.id);

  return { designCode, steps, step, sequence, total, subtitle, timeline, next, isLoading };
}

export function NextStepButton({ next }: { next: WorkflowStep | undefined }) {
  const { data: catalog = [] } = useOperationCatalog();

  if (!next) {
    return (
      <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-4 py-3.5 text-sm font-bold text-muted-foreground">
        <CheckCircle2 className="h-4 w-4" /> Workflow complete
      </div>
    );
  }
  const op = catalog.find((o) => o.id === next.operationId);
  if (!op) {
    return (
      <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-4 py-3.5 text-sm font-bold text-muted-foreground">
        <CheckCircle2 className="h-4 w-4" /> Next step not in operation catalog
      </div>
    );
  }
  return (
    <Link
      to={op.route}
      search={{ step: next.id }}
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
        hint={`${chrome.total} steps configured for ${chrome.designCode}`}
      />
      <ProductionTimeline steps={chrome.timeline} currentIcon={currentIcon} />
    </section>
  );
}
