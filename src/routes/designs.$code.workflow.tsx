import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
  Copy,
  GripVertical,
  Loader2,
  Lock,
  Plus,
  Save,
  Settings2,
  Trash2,
  User,
  Calendar,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/hooks/use-auth";
import { useDesignByCode } from "@/lib/api/designs";
import {
  useAddStep,
  useDeleteStep,
  useReorderSteps,
  useUpdateStep,
  useWorkflows,
  stepLabel,
  type StepStatus,
  type WorkflowStep,
  type WorkflowKind,
} from "@/lib/api/workflows";
import { useOperationCatalog, type CatalogOperation } from "@/lib/api/operations";
import { cn } from "@/lib/utils";

type WorkflowSearch = { kind?: WorkflowKind };

export const Route = createFileRoute("/designs/$code/workflow")({
  validateSearch: (search: Record<string, unknown>): WorkflowSearch => {
    const k = search.kind;
    return { kind: k === "sample" || k === "bulk" ? k : undefined };
  },
  head: ({ params }) => ({
    meta: [{ title: `Configure Workflow — ${params.code}` }],
  }),
  component: WorkflowConfigurator,
});

function WorkflowConfigurator() {
  useRequireAuth();
  const { code } = Route.useParams();
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const { data: design, isLoading: designLoading } = useDesignByCode(code);
  const { data: workflows = [], isLoading: wfLoading } = useWorkflows(design?.id);
  const { data: catalog = [] } = useOperationCatalog();

  const preferred: WorkflowKind = searchParams.kind ?? (workflows.some((w) => w.kind === "bulk") ? "bulk" : "sample");
  const [kind, setKind] = useState<WorkflowKind>(preferred);
  const wf = workflows.find((w) => w.kind === kind);

  if (designLoading || wfLoading) {
    return (
      <AppShell title="Configure Workflow">
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!design) {
    return (
      <AppShell title="Design not found">
        <Link to="/designs" className="text-sm font-semibold text-primary">Back to designs</Link>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Configure Workflow"
      subtitle={`${design.code} · ${design.name}`}
      action={
        <Link
          to="/designs/$code" params={{ code: design.code }}
          className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-accent sm:inline-flex"
        >
          <ArrowLeft className="h-4 w-4" /> Back to design
        </Link>
      }
    >
      <div className="grid gap-5">
        <Link to="/designs/$code" params={{ code: design.code }}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground sm:hidden">
          <ArrowLeft className="h-4 w-4" /> Back to design
        </Link>

        <div className="inline-flex rounded-2xl border border-border bg-card p-1">
          {(["sample", "bulk"] as const).map((k) => {
            const exists = workflows.some((w) => w.kind === k);
            const active = kind === k;
            return (
              <button
                key={k}
                disabled={!exists}
                onClick={() => {
                  setKind(k);
                  navigate({ to: ".", params: { code: design.code }, search: { kind: k } });
                }}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  !exists && "opacity-40",
                )}
              >
                {k === "sample" ? "Sample Workflow" : "Bulk Workflow"}
              </button>
            );
          })}
        </div>

        {!wf ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {kind === "bulk"
              ? "Bulk workflow is generated when the sample is approved."
              : "No workflow yet."}
          </p>
        ) : (
          <>
            {wf.locked && (
              <div className="flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
                <Lock className="h-4 w-4" />
                This workflow is locked and can no longer be edited.
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <StepsColumn designId={design.id} kind={wf.kind} steps={wf.steps} locked={wf.locked} catalog={catalog} />
              <OperationPalette designId={design.id} workflowId={wf.id} nextSequence={wf.steps.length + 1} locked={wf.locked} catalog={catalog} />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

// ---------- Steps column ----------

function StepsColumn({
  designId,
  steps,
  locked,
  catalog,
}: {
  designId: string;
  kind: WorkflowKind;
  steps: WorkflowStep[];
  locked: boolean;
  catalog: CatalogOperation[];
}) {
  const reorder = useReorderSteps(designId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = steps.map((s) => s.id);

  function onDragEnd(e: DragEndEvent) {
    if (locked) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(ids, oldIdx, newIdx);
    reorder.mutate(next);
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-primary" />
        <h3 className="text-base font-bold">Workflow Steps</h3>
        <span className="ml-auto text-xs text-muted-foreground">{steps.length} steps</span>
      </div>

      {steps.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Add operations from the right to build this workflow.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="mt-4 grid gap-3">
              {steps.map((step) => (
                <StepRow key={step.id} designId={designId} step={step} allSteps={steps} locked={locked} catalog={catalog} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

const STATUS_OPTIONS: StepStatus[] = ["pending", "in-progress", "completed", "skipped"];

function StepRow({
  designId,
  step,
  allSteps,
  locked,
  catalog,
}: {
  designId: string;
  step: WorkflowStep;
  allSteps: WorkflowStep[];
  locked: boolean;
  catalog: CatalogOperation[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const update = useUpdateStep(designId);
  const del = useDeleteStep(designId);
  const add = useAddStep(designId);
  const op = catalog.find((o) => o.id === step.operationId);
  const [expand, setExpand] = useState(false);
  const [draft, setDraft] = useState({
    label: step.label ?? "",
    assignedTo: step.assignedTo ?? "",
    inputQuantity: step.inputQuantity ?? 0,
    outputQuantity: step.outputQuantity ?? 0,
    wastageQuantity: step.wastageQuantity ?? 0,
    startDate: step.startDate ?? "",
    endDate: step.endDate ?? "",
    remarks: step.remarks ?? "",
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  } as React.CSSProperties;

  const Icon = op?.icon;

  function save() {
    update.mutate({
      stepId: step.id,
      patch: {
        label: draft.label.trim() || null,
        assignedTo: draft.assignedTo.trim() || null,
        inputQuantity: draft.inputQuantity || null,
        outputQuantity: draft.outputQuantity || null,
        wastageQuantity: draft.wastageQuantity || null,
        startDate: draft.startDate || null,
        endDate: draft.endDate || null,
        remarks: draft.remarks.trim() || null,
      },
    });
    setExpand(false);
  }

  function duplicate() {
    add.mutate({
      workflowId: step.workflowId,
      operationId: step.operationId,
      sequence: step.sequence + 0.5, // will be resequenced via next reorder; add at end otherwise
    });
  }

  return (
    <li ref={setNodeRef} style={style} className="rounded-2xl border border-border bg-background">
      <div className="flex items-center gap-2 p-3">
        <button
          {...attributes}
          {...listeners}
          disabled={locked}
          aria-label="Drag to reorder"
          className="cursor-grab rounded-lg p-1.5 text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          {Icon ? <Icon className="h-4 w-4" /> : <span className="text-xs font-bold">{step.sequence}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            <span className="mr-1 text-muted-foreground">{step.sequence}.</span>
            {stepLabel(step, allSteps, op?.name ?? step.operationId)}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {op?.category ?? "—"} · {step.assignedTo || "Unassigned"}
          </p>
        </div>

        <select
          value={step.status}
          disabled={locked}
          onChange={(e) => update.mutate({ stepId: step.id, patch: { status: e.target.value as StepStatus } })}
          className={cn(
            "rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-semibold outline-none",
            step.status === "completed" && "text-success",
            step.status === "in-progress" && "text-primary",
            step.status === "skipped" && "text-muted-foreground line-through",
          )}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "in-progress" ? "In progress" : s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>

        <button
          onClick={() => setExpand((v) => !v)}
          className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-semibold hover:bg-accent"
        >
          {expand ? "Close" : "Edit"}
        </button>
      </div>

      {expand && (
        <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2">
          <Text label="Custom Label" placeholder={op?.name ?? ""} value={draft.label}
            onChange={(v) => setDraft({ ...draft, label: v })} />
          <Text icon={<User className="h-3.5 w-3.5" />} label="Assigned Team / Worker" value={draft.assignedTo}
            onChange={(v) => setDraft({ ...draft, assignedTo: v })} />
          <Num label="Input Qty" value={draft.inputQuantity} onChange={(v) => setDraft({ ...draft, inputQuantity: v })} />
          <Num label="Output Qty" value={draft.outputQuantity} onChange={(v) => setDraft({ ...draft, outputQuantity: v })} />
          <Num label="Wastage / Rework" value={draft.wastageQuantity} onChange={(v) => setDraft({ ...draft, wastageQuantity: v })} />
          <Text icon={<Calendar className="h-3.5 w-3.5" />} label="Start Date" type="date"
            value={draft.startDate} onChange={(v) => setDraft({ ...draft, startDate: v })} />
          <Text icon={<Calendar className="h-3.5 w-3.5" />} label="End Date" type="date"
            value={draft.endDate} onChange={(v) => setDraft({ ...draft, endDate: v })} />
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Remarks</span>
            <textarea rows={2} value={draft.remarks} onChange={(e) => setDraft({ ...draft, remarks: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
          </label>

          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <button onClick={save} disabled={locked}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50">
              <Save className="h-3.5 w-3.5" /> Save
            </button>
            <button onClick={duplicate} disabled={locked}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold hover:bg-accent disabled:opacity-50">
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </button>
            <button onClick={() => del.mutate(step.id)} disabled={locked}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/20 disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// ---------- Palette ----------

function OperationPalette({
  designId,
  workflowId,
  nextSequence,
  locked,
  catalog,
}: {
  designId: string;
  workflowId: string;
  nextSequence: number;
  locked: boolean;
  catalog: CatalogOperation[];
}) {
  const add = useAddStep(designId);
  const grouped: Record<string, CatalogOperation[]> = { Sample: [], Bulk: [], Finishing: [] };
  for (const op of catalog) grouped[op.category].push(op);

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <Plus className="h-4 w-4 text-primary" />
        <h3 className="text-base font-bold">Add Operation</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Tap any operation to append it to the workflow. Repeat as many times as needed.
      </p>
      <div className="mt-4 grid gap-4">
        {(["Sample", "Bulk", "Finishing"] as const).map((cat) => (
          <div key={cat}>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{cat}</p>
            <div className="mt-2 grid gap-2">
              {grouped[cat].map((op) => {
                const Icon = op.icon;
                return (
                  <button
                    key={op.id}
                    disabled={locked || add.isPending}
                    onClick={() => add.mutate({ workflowId, operationId: op.id, sequence: nextSequence })}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3 text-left transition hover:border-primary/40 hover:bg-primary-soft/40 disabled:opacity-50"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{op.name}</p>
                      {op.repeatable && (
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Repeatable</p>
                      )}
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- form helpers ----------

function Text({ label, value, onChange, placeholder, type = "text", icon }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </span>
      <input type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold outline-none focus:border-primary" />
    </label>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <input type="number" min={0} value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-extrabold outline-none focus:border-primary" />
    </label>
  );
}
