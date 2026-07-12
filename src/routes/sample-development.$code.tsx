import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  FileCheck2,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Scissors,
  Sparkles,
  Trash2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { AppShell } from "@/components/AppShell";
import { DesignImage } from "@/components/DesignImage";
import { Switch } from "@/components/ui/switch";
import { useRequireAuth } from "@/hooks/use-auth";
import { useDesignByCode } from "@/lib/api/designs";
import { useOperationCatalog, type CatalogOperation } from "@/lib/api/operations";
import { useUpdateStep, useWorkflows, type WorkflowStep } from "@/lib/api/workflows";
import { supabase } from "@/integrations/supabase/client";
import type { Design } from "@/lib/designs";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/designs";

export const Route = createFileRoute("/sample-development/$code")({
  head: ({ params }) => ({
    meta: [{ title: `Sample · ${params.code} — Fawri Lifestyle` }],
  }),
  component: DesignSamplePage,
});

type TabId = "status" | "materials" | "making" | "costing" | "approval";

const TABS: {
  id: TabId;
  label: string;
  icon: LucideIcon;
}[] = [
  {
    id: "status",
    label: "Sample Status",
    icon: Sparkles,
  },
  {
    id: "materials",
    label: "Material Selection",
    icon: Layers,
  },
  {
    id: "making",
    label: "Sample Making",
    icon: Scissors,
  },
  {
    id: "costing",
    label: "Costing",
    icon: Coins,
  },
  {
    id: "approval",
    label: "Approval",
    icon: FileCheck2,
  },
];

function DesignSamplePage() {
  useRequireAuth();

  const { code } = Route.useParams();

  const { data: design, isLoading } = useDesignByCode(code);

  if (isLoading) {
    return (
      <AppShell title="Sample Development">
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!design) {
    return (
      <AppShell title="Design not found" subtitle={code}>
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No design with code <span className="font-semibold">{code}</span>.
          </p>

          <Link
            to="/designs"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to designs
          </Link>
        </div>
      </AppShell>
    );
  }

  return <DesignSample key={design.id} design={design} />;
}

function DesignSample({ design }: { design: Design }) {
  const [tab, setTab] = useState<TabId>("status");

  const { data: workflows, isLoading: wfLoading } = useWorkflows(design.id);

  const sample = workflows?.find((workflow) => workflow.kind === "sample");

  const bulk = workflows?.find((workflow) => workflow.kind === "bulk");

  const queryClient = useQueryClient();

  const creatingRef = useRef(false);

  useEffect(() => {
    if (wfLoading || !workflows) return;
    if (sample || bulk) return;
    if (creatingRef.current) return;

    creatingRef.current = true;

    async function createSampleWorkflow() {
      const { error } = await supabase.from("design_workflows").insert({
        design_id: design.id,
        kind: "sample",
        locked: false,
      });

      if (!error) {
        queryClient.invalidateQueries({
          queryKey: ["workflows", design.id],
        });
      }

      creatingRef.current = false;
    }

    createSampleWorkflow();
  }, [wfLoading, workflows, sample, bulk, design.id, queryClient]);

  const stage: "In Development" | "Ready for Review" | "Approved" = bulk
    ? "Approved"
    : sample &&
        sample.steps.length > 0 &&
        sample.steps.every((step) => step.status === "completed" || step.status === "skipped")
      ? "Ready for Review"
      : "In Development";

  return (
    <AppShell
      title={`Sample · ${design.name}`}
      subtitle={`${design.code} · ${design.customer}`}
      action={
        <Link
          to="/designs/$code"
          params={{ code: design.code }}
          aria-label="Back to design"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2.5 sm:text-sm sm:font-semibold sm:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />

          <span className="hidden sm:inline">Design</span>
        </Link>
      }
    >
      <div className="grid gap-5">
        <Link
          to="/sample-development"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All samples
        </Link>

        <SampleHeader design={design} stage={stage} />

        <section>
          <div className="flex gap-2 overflow-x-auto border-b border-border">
            {TABS.map((item) => {
              const Icon = item.icon;

              const active = tab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={
                    "inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition " +
                    (active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground")
                  }
                >
                  <Icon className="h-4 w-4" />

                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="pt-5">
            {tab === "status" && <StatusPanel design={design} stage={stage} />}

            {tab === "materials" && <MaterialsPanel design={design} onCompleted={() => setTab("making")} />}

            {tab === "making" && <SampleMakingPanel design={design} onContinueToCosting={() => setTab("costing")} />}

            {tab === "costing" && <CostingPanel design={design} />}

            {tab === "approval" && <ApprovalPanel design={design} />}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/* =========================================================
   STATUS
========================================================= */

function StatusPanel({ design, stage }: { design: Design; stage: "In Development" | "Ready for Review" | "Approved" }) {
  const steps: {
    id: string;
    label: string;
    icon: LucideIcon;
  }[] = [
    {
      id: "Requested",
      label: "Requested",
      icon: Sparkles,
    },
    {
      id: "In Development",
      label: "In Development",
      icon: Clock,
    },
    {
      id: "Ready for Review",
      label: "Ready for Review",
      icon: FileCheck2,
    },
    {
      id: "Approved",
      label: "Approved",
      icon: CheckCircle2,
    },
  ];

  const currentIndex = steps.findIndex((step) => step.id === stage);

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">Sample lifecycle</h3>

        <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">{stage}</span>
      </div>

      <ol className="mt-5 space-y-4">
        {steps.map((step, index) => {
          const completed = index < currentIndex || stage === "Approved";

          const current = index === currentIndex && stage !== "Approved";

          const Icon = step.icon;

          return (
            <li key={step.id} className="flex items-start gap-3">
              <div
                className={
                  "grid h-9 w-9 shrink-0 place-items-center rounded-xl " +
                  (completed
                    ? "bg-primary text-primary-foreground"
                    : current
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground")
                }
              >
                <Icon className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-semibold">{step.label}</p>

                <p className="text-xs text-muted-foreground">
                  {completed ? "Completed" : current ? "In progress" : "Pending"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {design.notes && (
        <div className="mt-5 rounded-2xl border border-border bg-background p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Notes</p>

          <p className="mt-1 text-sm">{design.notes}</p>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   MATERIAL SELECTION
========================================================= */

type MaterialSource = "manual" | "erpnext";

type MaterialRowState = {
  id: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  unit: string;
  source: MaterialSource;
  editing: boolean;
};

type MaterialGroupState = {
  id: string;
  name: string;
  enabled: boolean;
  expanded: boolean;
  rows: MaterialRowState[];
};

const UNIT_OPTIONS = ["Meter", "Pcs", "Yard", "Kg", "Set", "Roll"];

function newGroup(name: string, enabled: boolean, expanded = false): MaterialGroupState {
  return {
    id: crypto.randomUUID(),
    name,
    enabled,
    expanded,
    rows: [],
  };
}

function newRow(): MaterialRowState {
  return {
    id: crypto.randomUUID(),
    materialCode: "",
    materialName: "",
    quantity: 0,
    unit: "Meter",
    source: "manual",
    editing: true,
  };
}

function initialGroups(): MaterialGroupState[] {
  return [
    newGroup("Top", true, true),
    newGroup("Pant", true),
    newGroup("Shawl", true),
    newGroup("Lining", false),
    newGroup("Lace", false),
    newGroup("Accessories", false),
  ];
}

function MaterialsPanel({ design, onCompleted }: { design: Design; onCompleted: () => void }) {
  const [groups, setGroups] = useState<MaterialGroupState[]>(initialGroups);

  const [customName, setCustomName] = useState("");

  const { data: workflows } = useWorkflows(design.id);

  const updateStep = useUpdateStep(design.id);

  function updateGroup(id: string, patch: Partial<MaterialGroupState>) {
    setGroups((previous) => previous.map((group) => (group.id === id ? { ...group, ...patch } : group)));
  }

  function addGroup(name: string) {
    const trimmed = name.trim();

    if (!trimmed) return;

    setGroups((previous) => {
      const exists = previous.some((group) => group.name.toLowerCase() === trimmed.toLowerCase());

      if (exists) return previous;

      return [...previous, newGroup(trimmed, true, true)];
    });
  }

  function addRow(groupId: string) {
    setGroups((previous) =>
      previous.map((group) =>
        group.id === groupId
          ? {
              ...group,
              expanded: true,
              rows: [...group.rows, newRow()],
            }
          : group,
      ),
    );
  }

  function updateRow(groupId: string, rowId: string, patch: Partial<MaterialRowState>) {
    setGroups((previous) =>
      previous.map((group) =>
        group.id === groupId
          ? {
              ...group,
              rows: group.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
            }
          : group,
      ),
    );
  }

  function removeRow(groupId: string, rowId: string) {
    setGroups((previous) =>
      previous.map((group) =>
        group.id === groupId
          ? {
              ...group,
              rows: group.rows.filter((row) => row.id !== rowId),
            }
          : group,
      ),
    );
  }

  const enabledGroups = groups.filter((group) => group.enabled);

  const allRequiredMaterialsSaved =
    enabledGroups.length > 0 &&
    enabledGroups.every((group) => group.rows.length > 0 && group.rows.every((row) => !row.editing));

  async function completeMaterialSelection() {
    const sample = workflows?.find((workflow) => workflow.kind === "sample");

    const step = sample?.steps.find((item) => item.operationId === "fabric-selection");

    if (step && step.status !== "completed") {
      await updateStep.mutateAsync({
        stepId: step.id,
        patch: {
          status: "completed",
        },
      });
    }

    onCompleted();
  }

  return (
    <div className="grid gap-2">
      {groups.map((group) => (
        <MaterialGroupCard
          key={group.id}
          group={group}
          onToggleExpanded={() =>
            updateGroup(group.id, {
              expanded: !group.expanded,
            })
          }
          onToggleEnabled={(enabled) => updateGroup(group.id, { enabled })}
          onAddRow={() => addRow(group.id)}
          onUpdateRow={(rowId, patch) => updateRow(group.id, rowId, patch)}
          onRemoveRow={(rowId) => removeRow(group.id, rowId)}
        />
      ))}

      <div className="rounded-2xl border border-dashed border-border bg-card p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">+ Add Material Group</p>

        <div className="mt-2 flex gap-2">
          <input
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                addGroup(customName);
                setCustomName("");
              }
            }}
            placeholder="Custom group e.g. Interlining, Embroidery"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />

          <button
            onClick={() => {
              addGroup(customName);
              setCustomName("");
            }}
            disabled={!customName.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      {allRequiredMaterialsSaved ? (
        <div className="rounded-2xl border border-success/30 bg-success/5 p-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-bold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Material Selection Completed
          </span>

          <button
            onClick={completeMaterialSelection}
            disabled={updateStep.isPending}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground"
          >
            {updateStep.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Complete Material Selection & Continue
          </button>
        </div>
      ) : (
        <p className="text-center text-[11px] text-muted-foreground">
          Save at least one material in every enabled group to continue.
        </p>
      )}
    </div>
  );
}

function MaterialGroupCard({
  group,
  onToggleExpanded,
  onToggleEnabled,
  onAddRow,
  onUpdateRow,
  onRemoveRow,
}: {
  group: MaterialGroupState;
  onToggleExpanded: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onAddRow: () => void;
  onUpdateRow: (rowId: string, patch: Partial<MaterialRowState>) => void;
  onRemoveRow: (rowId: string) => void;
}) {
  return (
    <div
      className={
        "overflow-hidden rounded-2xl border border-border bg-card transition-opacity " +
        (group.enabled ? "" : "opacity-60")
      }
    >
      <div className="flex h-12 items-center gap-2 px-3">
        <button onClick={onToggleExpanded} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronDown
            className={
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform " + (group.expanded ? "rotate-180" : "")
            }
          />

          <span className="truncate text-sm font-semibold">{group.name}</span>

          <span className="shrink-0 text-xs text-muted-foreground">
            ({group.rows.length} Material
            {group.rows.length === 1 ? "" : "s"})
          </span>
        </button>

        <Switch
          checked={group.enabled}
          onCheckedChange={onToggleEnabled}
          onClick={(event) => event.stopPropagation()}
          aria-label={group.enabled ? `Disable ${group.name}` : `Enable ${group.name}`}
        />
      </div>

      {group.expanded && group.enabled && (
        <div className="grid gap-2 border-t border-border p-3">
          {group.rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
              No materials added yet.
            </p>
          ) : (
            group.rows.map((row) => (
              <MaterialRowItem
                key={row.id}
                row={row}
                onChange={(patch) => onUpdateRow(row.id, patch)}
                onDelete={() => onRemoveRow(row.id)}
              />
            ))
          )}

          <button
            onClick={onAddRow}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-background py-2 text-xs font-semibold text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Material
          </button>
        </div>
      )}
    </div>
  );
}

function MaterialRowItem({
  row,
  onChange,
  onDelete,
}: {
  row: MaterialRowState;
  onChange: (patch: Partial<MaterialRowState>) => void;
  onDelete: () => void;
}) {
  const valid = row.materialCode.trim() !== "" && row.materialName.trim() !== "" && row.quantity > 0;

  if (!row.editing) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{row.materialName}</p>

          <p className="truncate text-[11px] text-muted-foreground">
            {row.materialCode} · {row.quantity} {row.unit}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange({ editing: true })}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          <button onClick={onDelete} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary-soft/30 p-2.5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CompactField
          label="Material Code"
          value={row.materialCode}
          placeholder="MAT-1001"
          onChange={(value) => onChange({ materialCode: value })}
        />

        <CompactField
          label="Material Name"
          value={row.materialName}
          placeholder="Silk Chanderi"
          onChange={(value) => onChange({ materialName: value })}
        />

        <label className="block min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Quantity</span>

          <input
            type="number"
            min={0}
            step={0.25}
            value={row.quantity || ""}
            onChange={(event) =>
              onChange({
                quantity: Math.max(0, Number(event.target.value) || 0),
              })
            }
            placeholder="0.00"
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
          />
        </label>

        <label className="block min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Unit</span>

          <select
            value={row.unit}
            onChange={(event) =>
              onChange({
                unit: event.target.value,
              })
            }
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
          >
            {UNIT_OPTIONS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          onClick={() => onChange({ editing: false })}
          disabled={!valid}
          className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          Save
        </button>

        <button
          onClick={onDelete}
          className="shrink-0 rounded-xl border border-border bg-background px-3 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CompactField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
      />
    </label>
  );
}

/* =========================================================
   SAMPLE MAKING
========================================================= */

const WORKERS = ["Ameen", "Suresh", "Fathima", "Anwar", "Vikas", "Meera"];

type OperationSession = {
  worker: string;
  estimatedMinutes: string;
  remarks: string;
  startedAt: Date | null;
};

function emptySession(): OperationSession {
  return {
    worker: "",
    estimatedMinutes: "",
    remarks: "",
    startedAt: null,
  };
}

function formatClock(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatElapsed(startedAt: Date) {
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));

  const pad = (value: number) => String(value).padStart(2, "0");

  const hours = Math.floor(seconds / 3600);

  const minutes = Math.floor((seconds % 3600) / 60);

  const remainingSeconds = seconds % 60;

  return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`;
}

function SampleMakingPanel({ design, onContinueToCosting }: { design: Design; onContinueToCosting: () => void }) {
  const { data: workflows, isLoading } = useWorkflows(design.id);

  const { data: catalog = [] } = useOperationCatalog();

  const updateStep = useUpdateStep(design.id);

  const sample = workflows?.find((workflow) => workflow.kind === "sample");

  const ordered = sample ? [...sample.steps].sort((a, b) => a.sequence - b.sequence) : [];

  const currentIndex = ordered.findIndex((step) => step.status !== "completed" && step.status !== "skipped");

  const step = currentIndex >= 0 ? ordered[currentIndex] : undefined;

  const [sessions, setSessions] = useState<Record<string, OperationSession>>({});

  const [, forceTick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      forceTick((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!step) return;

    if (step.status !== "in-progress") return;

    setSessions((previous) => {
      if (previous[step.id]?.startedAt) {
        return previous;
      }

      return {
        ...previous,
        [step.id]: {
          ...(previous[step.id] ?? emptySession()),
          worker: step.assignedTo ?? "",
          startedAt: new Date(),
        },
      };
    });
  }, [step?.id, step?.status, step?.assignedTo]);

  function patchSession(stepId: string, patch: Partial<OperationSession>) {
    setSessions((previous) => ({
      ...previous,
      [stepId]: {
        ...(previous[stepId] ?? emptySession()),
        ...patch,
      },
    }));
  }

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!sample || sample.steps.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No sample workflow steps configured yet.</p>

        <Link
          to="/designs/$code/workflow"
          params={{ code: design.code }}
          search={{ kind: "sample" }}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Configure Workflow
        </Link>
      </div>
    );
  }

  if (!step) {
    return (
      <div className="grid gap-4">
        <WorkflowTimeline steps={ordered} catalog={catalog} />

        <div className="rounded-3xl border border-success/30 bg-success/5 p-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-9 w-9" />
          </div>

          <h3 className="mt-4 text-xl font-extrabold tracking-tight">Sample Making Completed</h3>

          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            All sample workflow operations have been completed successfully.
          </p>

          <button
            onClick={onContinueToCosting}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-sm hover:opacity-90 sm:w-auto"
          >
            Continue to Costing
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  const previous = currentIndex > 0 ? ordered[currentIndex - 1] : undefined;

  const previousOperation = previous ? catalog.find((operation) => operation.id === previous.operationId) : undefined;

  const previousName = previous ? previous.label || previousOperation?.name || previous.operationId : undefined;

  const operation = catalog.find((item) => item.id === step.operationId);

  const operationName = step.label || operation?.name || step.operationId;

  const OperationIcon = operation?.icon;

  const session = sessions[step.id] ?? emptySession();

  const inProgress = step.status === "in-progress";

  const heading = previous?.status === "completed" ? "Next Operation" : "Current Operation";

  const currentStep = step;

  function startOperation() {
    if (!session.worker) return;

    const startedAt = new Date();

    patchSession(currentStep.id, {
      startedAt,
    });

    updateStep.mutate({
      stepId: currentStep.id,
      patch: {
        status: "in-progress",
        assignedTo: session.worker,
        remarks: session.remarks.trim() || null,
        startDate: startedAt.toISOString().slice(0, 10),
      },
    });
  }

  function completeOperation() {
    const endedAt = new Date();

    updateStep.mutate({
      stepId: currentStep.id,
      patch: {
        status: "completed",
        endDate: endedAt.toISOString().slice(0, 10),
      },
    });
  }

  return (
    <div className="grid gap-4">
      <WorkflowTimeline steps={ordered} catalog={catalog} currentStepId={step.id} />

      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        {previous?.status === "completed" && (
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-bold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {previousName} Completed
          </div>
        )}

        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{heading}</p>

        <div className="mt-2 flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            {OperationIcon ? <OperationIcon className="h-5 w-5" /> : <Scissors className="h-5 w-5" />}
          </div>

          <h3 className="truncate text-xl font-extrabold tracking-tight">{operationName}</h3>
        </div>

        {inProgress ? (
          <div className="mt-5 grid gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatusTile label="Status" value="In Progress" />

              <StatusTile label="Worker" value={step.assignedTo || session.worker || "—"} />

              <StatusTile label="Start Time" value={session.startedAt ? formatClock(session.startedAt) : "—"} />

              <StatusTile
                label="Elapsed Time"
                value={session.startedAt ? formatElapsed(session.startedAt) : "—"}
                mono
              />
            </div>

            <button
              onClick={completeOperation}
              disabled={updateStep.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-success px-4 py-4 text-base font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {updateStep.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle2 className="h-5 w-5" />
              Complete Operation
            </button>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Assigned Worker
                </span>

                <select
                  value={session.worker}
                  onChange={(event) =>
                    patchSession(step.id, {
                      worker: event.target.value,
                    })
                  }
                  className="mt-1.5 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
                >
                  <option value="">Select Worker</option>

                  {WORKERS.map((worker) => (
                    <option key={worker} value={worker}>
                      {worker}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Estimated Time (Optional)
                </span>

                <input
                  type="number"
                  min={0}
                  placeholder="Minutes"
                  value={session.estimatedMinutes}
                  onChange={(event) =>
                    patchSession(step.id, {
                      estimatedMinutes: event.target.value,
                    })
                  }
                  className="mt-1.5 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Remarks (Optional)
              </span>

              <textarea
                rows={2}
                value={session.remarks}
                onChange={(event) =>
                  patchSession(step.id, {
                    remarks: event.target.value,
                  })
                }
                className="mt-1.5 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </label>

            <button
              onClick={startOperation}
              disabled={!session.worker || updateStep.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updateStep.isPending && <Loader2 className="h-4 w-4 animate-spin" />}▶ Start Operation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function WorkflowTimeline({
  steps,
  catalog,
  currentStepId,
}: {
  steps: WorkflowStep[];
  catalog: CatalogOperation[];
  currentStepId?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card p-3">
      <ol className="flex min-w-max items-start gap-1">
        {steps.map((step, index) => {
          const operation = catalog.find((item) => item.id === step.operationId);

          const label = step.label || operation?.short || operation?.name || step.operationId;

          const completed = step.status === "completed" || step.status === "skipped";

          const current = step.id === currentStepId;

          return (
            <li key={step.id} className="flex items-start gap-1">
              <div className="flex w-16 flex-col items-center gap-1">
                <span
                  className={
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold " +
                    (completed
                      ? "bg-primary text-primary-foreground"
                      : current
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/20"
                        : "bg-muted text-muted-foreground")
                  }
                >
                  {completed ? "✓" : index + 1}
                </span>

                <span
                  className={
                    "max-w-[64px] truncate text-center text-[9px] font-semibold " +
                    (current ? "text-primary" : "text-muted-foreground")
                  }
                >
                  {label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <span className={"mt-3.5 h-0.5 w-4 shrink-0 rounded-full " + (completed ? "bg-primary" : "bg-muted")} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StatusTile({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>

      <p className={"mt-1 truncate text-sm font-bold " + (mono ? "font-mono tabular-nums" : "")}>{value}</p>
    </div>
  );
}

/* =========================================================
   COSTING
========================================================= */

function CostingPanel({ design }: { design: Design }) {
  const [costs, setCosts] = useState([
    {
      id: "c1",
      label: "Material (est.)",
      category: "Material",
      amount: 0,
    },
    {
      id: "c2",
      label: "Stitching",
      category: "Labor",
      amount: 0,
    },
    {
      id: "c3",
      label: "Overheads",
      category: "Overhead",
      amount: 0,
    },
  ]);

  const perPiece = costs.reduce((total, item) => total + item.amount, 0);

  const orderTotal = perPiece * design.orderQuantity;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Cost Item</th>

              <th className="p-3 text-left">Category</th>

              <th className="p-3 text-right">Amount (₹/pc)</th>
            </tr>
          </thead>

          <tbody>
            {costs.map((cost) => (
              <tr key={cost.id} className="border-t border-border">
                <td className="p-3 font-semibold">{cost.label}</td>

                <td className="p-3 text-muted-foreground">{cost.category}</td>

                <td className="p-3 text-right">
                  <input
                    type="number"
                    min={0}
                    value={cost.amount || ""}
                    onChange={(event) =>
                      setCosts((previous) =>
                        previous.map((item) =>
                          item.id === cost.id
                            ? {
                                ...item,
                                amount: Math.max(0, Number(event.target.value) || 0),
                              }
                            : item,
                        ),
                      )
                    }
                    className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-right"
                  />
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t border-border bg-primary-soft">
              <td className="p-3 font-bold" colSpan={2}>
                Total per piece
              </td>

              <td className="p-3 text-right text-lg font-extrabold text-primary">₹{perPiece.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary to-primary-glow p-5 text-primary-foreground shadow-md">
        <p className="text-[11px] font-bold uppercase tracking-widest opacity-85">Order total</p>

        <p className="mt-1 text-3xl font-extrabold">₹{orderTotal.toLocaleString()}</p>

        <p className="mt-1 text-xs opacity-85">
          {design.orderQuantity} pcs × ₹{perPiece.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   APPROVAL
========================================================= */

type ApprovalRow = {
  id: string;
  role: string;
  name: string;
  status: "Pending" | "Approved" | "Rejected";
};

function ApprovalPanel({ design }: { design: Design }) {
  const [approvals, setApprovals] = useState<ApprovalRow[]>([
    {
      id: "a1",
      role: "Designer",
      name: "—",
      status: "Pending",
    },
    {
      id: "a2",
      role: "Merchandiser",
      name: "—",
      status: "Pending",
    },
    {
      id: "a3",
      role: "Production Head",
      name: "—",
      status: "Pending",
    },
    {
      id: "a4",
      role: "Customer",
      name: design.customer || "—",
      status: "Pending",
    },
  ]);

  function setStatus(id: string, status: ApprovalRow["status"]) {
    setApprovals((previous) => previous.map((approval) => (approval.id === id ? { ...approval, status } : approval)));
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {approvals.map((approval) => (
        <li key={approval.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase text-muted-foreground">{approval.role}</p>

          <p className="mt-1 font-bold">{approval.name}</p>

          <p className="mt-2 text-sm">{approval.status}</p>

          {approval.status === "Pending" && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setStatus(approval.id, "Approved")}
                className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
              >
                Approve
              </button>

              <button
                onClick={() => setStatus(approval.id, "Rejected")}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold"
              >
                <XCircle className="mr-1 inline h-3.5 w-3.5" />
                Reject
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/* =========================================================
   SAMPLE HEADER
========================================================= */

function SampleHeader({
  design,
  stage,
}: {
  design: Design;
  stage: "In Development" | "Ready for Review" | "Approved";
}) {
  const targetCostPerPc = 1250;

  const estimatedMargin = "25%";

  const designer = "Rifa";

  const createdOn = new Date(design.createdAt).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const total = 7;

  const currentIndex = stage === "Approved" ? total : stage === "Ready for Review" ? 5 : 3;

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[16/10] w-full bg-primary-soft">
        <DesignImage path={design.imagePath} alt={design.name} />

        <span
          className={
            "absolute right-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold shadow-sm " +
            STATUS_TONE[design.status]
          }
        >
          {STATUS_LABEL[design.status]}
        </span>
      </div>

      <div className="grid gap-4 p-3 sm:p-5">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-muted-foreground">{design.code}</p>

          <h2 className="text-xl font-extrabold sm:text-2xl">{design.name}</h2>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Fact label="Order Qty (Planned)" value={`${design.orderQuantity.toLocaleString()} Pcs`} />

          <Fact label="Category" value={design.category || "—"} />

          <Fact label="Target Cost (Per Pc)" value={`₹${targetCostPerPc.toLocaleString()}`} />

          <Fact label="Est. Margin" value={estimatedMargin} />

          <Fact label="Created On" value={createdOn} />

          <Fact label="Designer" value={designer} />
        </div>

        <div className="rounded-2xl border border-border bg-background p-3">
          <div className="flex justify-between">
            <p className="text-sm font-bold">Workflow Progress</p>

            <p className="text-[11px] font-semibold text-muted-foreground">
              Step {Math.min(currentIndex, total)} of {total}
            </p>
          </div>

          <ol className="mt-3 flex items-center gap-1">
            {Array.from({ length: total }, (_, index) => index + 1).map((number) => {
              const completed = number < currentIndex;

              const current = number === currentIndex;

              return (
                <li key={number} className="flex min-w-0 flex-1 items-center gap-1">
                  <span
                    className={
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold " +
                      (completed
                        ? "bg-primary text-primary-foreground"
                        : current
                          ? "bg-primary text-primary-foreground ring-2 ring-primary/20"
                          : "bg-muted text-muted-foreground")
                    }
                  >
                    {completed ? "✓" : number}
                  </span>

                  {number < total && (
                    <span className={"h-0.5 min-w-0 flex-1 rounded-full " + (completed ? "bg-primary" : "bg-muted")} />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <Link
          to="/designs/$code/workflow"
          params={{ code: design.code }}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
        >
          View Workflow
        </Link>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>

      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}
