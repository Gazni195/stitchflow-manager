import { Link } from "@tanstack/react-router";
import { ArrowRight, Plus, Filter } from "lucide-react";
import { AppShell } from "./AppShell";
import { WORKFLOW, type WorkflowStage } from "@/lib/workflow";

type Props = {
  stageId: string;
  emptyHint?: string;
};

export function StagePage({ stageId, emptyHint }: Props) {
  const index = WORKFLOW.findIndex((s) => s.id === stageId);
  const stage = WORKFLOW[index]!;
  const prev = WORKFLOW[index - 1];
  const next = WORKFLOW[index + 1];
  const Icon = stage.icon;

  return (
    <AppShell
      title={stage.title}
      subtitle={`Step ${stage.step} of ${WORKFLOW.length} · ${stage.phase}`}
      action={
        <button className="hidden items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 sm:inline-flex">
          <Plus className="h-4 w-4" /> New
        </button>
      }
    >
      <div className="grid gap-5">
        {/* Stage hero */}
        <section className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary-soft via-background to-background p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <Icon className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Stage {stage.step}
              </p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {stage.title}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {stage.description}
              </p>
            </div>
          </div>
        </section>

        {/* Toolbar */}
        <section className="flex flex-wrap items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm">
            <Plus className="h-4 w-4" /> Add Entry
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground">
            <Filter className="h-4 w-4" /> Filter
          </button>
        </section>

        {/* Empty state */}
        <section className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold">No records yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {emptyHint ?? `Entries for ${stage.title.toLowerCase()} will appear here.`}
          </p>
        </section>

        {/* Prev / Next stage nav */}
        <section className="grid gap-3 sm:grid-cols-2">
          <StageNavCard label="Previous stage" stage={prev} direction="prev" />
          <StageNavCard label="Next stage" stage={next} direction="next" />
        </section>
      </div>
    </AppShell>
  );
}

function StageNavCard({
  label,
  stage,
  direction,
}: {
  label: string;
  stage: WorkflowStage | undefined;
  direction: "prev" | "next";
}) {
  if (!stage) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-4 text-sm text-muted-foreground">
        {direction === "prev" ? "Start of workflow" : "End of workflow"}
      </div>
    );
  }
  const Icon = stage.icon;
  return (
    <Link
      to={stage.to}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-bold">{stage.title}</p>
      </div>
      <ArrowRight
        className={
          "h-5 w-5 shrink-0 text-muted-foreground transition group-hover:text-primary " +
          (direction === "prev" ? "rotate-180" : "")
        }
      />
    </Link>
  );
}
