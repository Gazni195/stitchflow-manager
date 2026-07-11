import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Copy,
  Plus,
  Trash2,
  Ban,
  RotateCcw,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getDesign } from "@/lib/designs";
import {
  useDesignWorkflow,
  addStep,
  removeStep,
  moveStep,
  duplicateStep,
  toggleSkip,
  renameStep,
  updateStep,
  stepLabel,
  type WorkflowStep,
} from "@/lib/design-workflow";
import { OPERATIONS, getOperation, type OperationId } from "@/lib/operations";

export const Route = createFileRoute("/designs/$code/workflow")({
  loader: ({ params }) => {
    const design = getDesign(params.code);
    if (!design) throw notFound();
    return { code: design.code, name: design.name, customer: design.customer };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Configure Workflow · ${loaderData.code} — Fawri Lifestyle`
          : "Configure Workflow — Fawri Lifestyle",
      },
    ],
  }),
  component: WorkflowConfigurator,
});

function WorkflowConfigurator() {
  const { code, name, customer } = Route.useLoaderData();
  const wf = useDesignWorkflow(code);
  const [picker, setPicker] = useState<OperationId>("stitching");

  return (
    <AppShell title="Configure Workflow" subtitle={`${code} · ${name}`}>
      <div className="grid gap-5">
        <Link
          to="/designs/$code"
          params={{ code }}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to design
        </Link>

        <section className="rounded-3xl border border-border bg-gradient-to-br from-primary-soft to-background p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
            Production Manager · Dynamic Workflow
          </p>
          <h2 className="mt-1 text-xl font-extrabold">
            {wf.steps.length} step{wf.steps.length === 1 ? "" : "s"} for {customer}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reorder, repeat, rename or skip any operation. The same operation can appear
            multiple times — production modules always pick the next non-skipped step.
          </p>
        </section>

        {/* Add step */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-bold">Add operation</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={picker}
              onChange={(e) => setPicker(e.target.value as OperationId)}
              className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
            >
              {OPERATIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.repeatable ? "· repeatable" : ""}
                </option>
              ))}
            </select>
            <button
              onClick={() => addStep(code, picker)}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Add to end
            </button>
          </div>
        </section>

        {/* Steps */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-bold">Workflow steps</h3>
          <ol className="mt-3 grid gap-2">
            {wf.steps.map((step, idx) => (
              <StepRow
                key={step.stepId}
                code={code}
                step={step}
                index={idx}
                total={wf.steps.length}
                displayName={stepLabel(step, wf)}
              />
            ))}
            {wf.steps.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
                No steps yet. Add an operation above to start the workflow.
              </li>
            )}
          </ol>
        </section>
      </div>
    </AppShell>
  );
}

function StepRow({
  code,
  step,
  index,
  total,
  displayName,
}: {
  code: string;
  step: WorkflowStep;
  index: number;
  total: number;
  displayName: string;
}) {
  const op = getOperation(step.operationId);
  const Icon = op.icon;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const skipped = step.status === "skipped";

  return (
    <li
      className={
        "grid gap-3 rounded-2xl border p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center " +
        (skipped
          ? "border-dashed border-border bg-background opacity-70"
          : step.status === "in-progress"
            ? "border-primary bg-primary-soft"
            : step.status === "completed"
              ? "border-primary/30 bg-primary/5"
              : "border-border bg-background")
      }
    >
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-xs font-extrabold text-muted-foreground">
          {step.sequence}
        </span>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                renameStep(code, step.stepId, draft);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  renameStep(code, step.stepId, draft);
                  setEditing(false);
                }
                if (e.key === "Escape") setEditing(false);
              }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
            />
          </div>
        ) : (
          <button
            onClick={() => {
              setDraft(displayName);
              setEditing(true);
            }}
            className={
              "truncate text-left text-sm font-bold " + (skipped ? "line-through" : "")
            }
          >
            {displayName}
          </button>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>{op.category}</span>
          <span>·</span>
          <select
            value={step.status}
            onChange={(e) =>
              updateStep(code, step.stepId, {
                status: e.target.value as WorkflowStep["status"],
              })
            }
            className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
          >
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="skipped">Skipped</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1">
        <IconBtn
          title="Move up"
          disabled={index === 0}
          onClick={() => moveStep(code, step.stepId, -1)}
        >
          <ArrowUp className="h-4 w-4" />
        </IconBtn>
        <IconBtn
          title="Move down"
          disabled={index === total - 1}
          onClick={() => moveStep(code, step.stepId, 1)}
        >
          <ArrowDown className="h-4 w-4" />
        </IconBtn>
        <IconBtn title="Duplicate" onClick={() => duplicateStep(code, step.stepId)}>
          <Copy className="h-4 w-4" />
        </IconBtn>
        <IconBtn
          title={skipped ? "Un-skip" : "Skip"}
          onClick={() => toggleSkip(code, step.stepId)}
        >
          {skipped ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
        </IconBtn>
        <IconBtn
          title="Remove"
          tone="danger"
          onClick={() => removeStep(code, step.stepId)}
        >
          <Trash2 className="h-4 w-4" />
        </IconBtn>
      </div>
    </li>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  title,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={
        "grid h-9 w-9 place-items-center rounded-xl border border-border bg-background transition disabled:opacity-40 " +
        (tone === "danger"
          ? "hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          : "hover:border-primary/40 hover:bg-primary-soft hover:text-primary")
      }
    >
      {children}
    </button>
  );
}
