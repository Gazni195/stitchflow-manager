import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Pause,
  Phone,
  Play,
  Upload,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/hooks/use-auth";
import { useDesignByCode } from "@/lib/api/designs";
import { useUpdateStep, useWorkflows, stepLabel, type WorkflowStep } from "@/lib/api/workflows";
import { useOperationCatalog } from "@/lib/api/operations";
import { useWorkers, hourlyRate, type Worker } from "@/lib/api/workers";
import { supabase } from "@/integrations/supabase/client";
import type { Design } from "@/lib/designs";

export const Route = createFileRoute("/sample-development/$code/step/$stepId")({
  head: ({ params }) => ({
    meta: [{ title: `Work · ${params.code} — Fawri Lifestyle` }],
  }),
  component: StepPage,
});

function StepPage() {
  useRequireAuth();
  const { code } = Route.useParams();
  const { data: design, isLoading } = useDesignByCode(code);

  if (isLoading) {
    return (
      <AppShell title="Work">
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }
  if (!design) {
    return (
      <AppShell title="Design not found" subtitle={code}>
        <p className="text-sm text-muted-foreground">No design with code {code}.</p>
      </AppShell>
    );
  }
  return <StepDetail design={design} />;
}

function StepDetail({ design }: { design: Design }) {
  const { stepId } = Route.useParams();
  const { data: workflows = [], isLoading: wfLoading } = useWorkflows(design.id);
  const { data: catalog = [] } = useOperationCatalog();
  const { data: workers = [] } = useWorkers();
  const sample = workflows.find((w) => w.kind === "sample");
  const step = sample?.steps.find((s) => s.id === stepId);

  if (wfLoading) {
    return (
      <AppShell title="Work">
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }
  if (!sample || !step) {
    return (
      <AppShell title="Step not found" subtitle={design.code}>
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            This process step no longer exists.
          </p>
          <Link
            to="/sample-development/$code"
            params={{ code: design.code }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to sample
          </Link>
        </div>
      </AppShell>
    );
  }

  const op = catalog.find((o) => o.id === step.operationId);
  const opName = op?.name ?? step.operationId;
  const label = stepLabel(step, sample.steps, opName);
  const assignedWorker = workers.find((w) => w.id === step.assignedWorkerId);

  return (
    <AppShell
      title={label}
      subtitle={`${design.code} · ${design.name}`}
      action={
        <Link
          to="/sample-development/$code"
          params={{ code: design.code }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Sample
        </Link>
      }
    >
      {step.status === "pending" && (
        <AssignAndStart design={design} step={step} workers={workers} opName={opName} />
      )}
      {step.status === "in-progress" && (
        <WorkInProgress design={design} step={step} worker={assignedWorker} />
      )}
      {step.status === "completed" && (
        <WorkCompleted design={design} sample={sample} step={step} opName={opName} worker={assignedWorker} catalog={catalog} />
      )}
    </AppShell>
  );
}

/* ---------- Assign & Start Work ---------- */

function AssignAndStart({
  design,
  step,
  workers,
  opName,
}: {
  design: Design;
  step: WorkflowStep;
  workers: Worker[];
  opName: string;
}) {
  const update = useUpdateStep(design.id);
  const [workerId, setWorkerId] = useState(step.assignedWorkerId ?? "");
  const [notes, setNotes] = useState(step.remarks ?? "");
  const [uploading, setUploading] = useState(false);

  const worker = workers.find((w) => w.id === workerId);
  const hourly = worker ? hourlyRate(worker.dailyWage) : 0;

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const path = `${uid}/workflow-files/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("design-images").upload(path, file, { upsert: false });
      if (error) throw error;
      update.mutate({
        stepId: step.id,
        patch: { referenceFilePath: path, referenceFileName: file.name, referenceFileSize: file.size },
      });
    } finally {
      setUploading(false);
    }
  }

  async function previewFile() {
    if (!step.referenceFilePath) return;
    const { data } = await supabase.storage
      .from("design-images")
      .createSignedUrl(step.referenceFilePath, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  function startWork() {
    if (!worker) return;
    update.mutate({
      stepId: step.id,
      patch: {
        assignedWorkerId: worker.id,
        assignedTo: worker.name,
        remarks: notes,
        status: "in-progress",
        startedAt: new Date().toISOString(),
        isPaused: false,
      },
    });
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-extrabold">{opName}</h2>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          Pending
        </span>
      </div>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Assign Worker
        </h3>
        <div className="mt-2 flex items-center gap-2">
          <select
            value={workerId}
            onChange={(e) => setWorkerId(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-background px-3 py-3 text-sm font-semibold outline-none focus:border-primary"
          >
            <option value="">Select a worker…</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} · {w.role}
              </option>
            ))}
          </select>
          {worker?.phone && (
            <a
              href={`tel:${worker.phone}`}
              aria-label={`Call ${worker.name}`}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-background text-primary hover:bg-accent"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Work Details
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Fact label="Start Time" value="On start" />
          <Fact label="Daily Wage" value={worker ? `₹${worker.dailyWage.toLocaleString()}` : "—"} />
          <Fact label="Hourly Rate (Auto)" value={worker ? `₹${hourly.toFixed(2)}/hr` : "—"} />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Reference / Design File
        </h3>
        {step.referenceFilePath ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-background p-3">
            <FileText className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{step.referenceFileName}</p>
              <p className="text-xs text-muted-foreground">
                {step.referenceFileSize ? `${(step.referenceFileSize / 1024 / 1024).toFixed(1)} MB` : ""}
              </p>
            </div>
            <button aria-label="Preview file" onClick={previewFile} className="text-muted-foreground hover:text-primary">
              <Eye className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background p-4 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload reference file
            <input
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
              }}
            />
          </label>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Add any additional notes…"
          className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </section>

      <button
        disabled={!worker || update.isPending}
        onClick={startWork}
        className="inline-flex w-fit items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-105 disabled:opacity-50"
      >
        {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        <Play className="h-4 w-4" /> Start Work
      </button>
    </div>
  );
}

/* ---------- Work In Progress ---------- */

function WorkInProgress({
  design,
  step,
  worker,
}: {
  design: Design;
  step: WorkflowStep;
  worker: Worker | undefined;
}) {
  const update = useUpdateStep(design.id);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (step.isPaused) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [step.isPaused]);

  const startedMs = step.startedAt ? new Date(step.startedAt).getTime() : nowMs;
  const liveSeconds =
    step.accumulatedSeconds + (step.isPaused ? 0 : Math.max(0, Math.floor((nowMs - startedMs) / 1000)));
  const hourly = worker ? hourlyRate(worker.dailyWage) : 0;
  const laborCost = (liveSeconds / 3600) * hourly;

  function pause() {
    update.mutate({
      stepId: step.id,
      patch: { isPaused: true, accumulatedSeconds: liveSeconds },
    });
  }

  function resume() {
    update.mutate({
      stepId: step.id,
      patch: { isPaused: false, startedAt: new Date().toISOString() },
    });
  }

  function complete() {
    update.mutate({
      stepId: step.id,
      patch: {
        status: "completed",
        completedAt: new Date().toISOString(),
        accumulatedSeconds: liveSeconds,
        isPaused: false,
        costPerPiece: laborCost,
      },
    });
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
          {step.isPaused ? "Paused" : "In Progress"}
        </span>
      </div>

      <section className="grid place-items-center gap-2 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-5xl font-extrabold tabular-nums tracking-tight text-primary">
          {formatDuration(liveSeconds)}
        </p>
        <p className="text-xs text-muted-foreground">
          Started at {step.startedAt ? formatTime(step.startedAt) : "—"}
        </p>
        <div className="mt-4 flex gap-2">
          {step.isPaused ? (
            <button
              onClick={resume}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
            >
              <Play className="h-4 w-4" /> Resume
            </button>
          ) : (
            <button
              onClick={pause}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-bold hover:bg-accent"
            >
              <Pause className="h-4 w-4" /> Pause
            </button>
          )}
          <button
            onClick={complete}
            className="inline-flex items-center gap-2 rounded-xl bg-success px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90"
          >
            <CheckCircle2 className="h-4 w-4" /> Complete
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Work Summary
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Fact label="Start Time" value={step.startedAt ? formatTime(step.startedAt) : "—"} />
          <Fact label="Daily Wage" value={worker ? `₹${worker.dailyWage.toLocaleString()}` : "—"} />
          <Fact label="Hourly Rate" value={worker ? `₹${hourly.toFixed(2)}/hr` : "—"} />
          <Fact label="Total Time" value={formatDuration(liveSeconds)} />
          <Fact label="Labor Cost (Approx.)" value={`₹${laborCost.toFixed(2)}`} />
        </div>
      </section>
    </div>
  );
}

/* ---------- Work Completed ---------- */

function WorkCompleted({
  design,
  sample,
  step,
  opName,
  worker,
  catalog,
}: {
  design: Design;
  sample: { steps: WorkflowStep[] };
  step: WorkflowStep;
  opName: string;
  worker: Worker | undefined;
  catalog: ReturnType<typeof useOperationCatalog>["data"];
}) {
  const navigate = useNavigate();
  const next = useMemo(
    () =>
      [...sample.steps]
        .filter((s) => s.id !== step.id && s.status === "pending")
        .sort((a, b) => a.sequence - b.sequence)[0],
    [sample.steps, step.id],
  );
  const nextOpName = next
    ? catalog?.find((o) => o.id === next.operationId)?.name ?? next.operationId
    : null;

  function continueNext() {
    if (next) {
      navigate({
        to: "/sample-development/$code/step/$stepId",
        params: { code: design.code, stepId: next.id },
      });
    } else {
      navigate({ to: "/sample-development/$code/cost", params: { code: design.code } });
    }
  }

  return (
    <div className="grid place-items-center gap-4 py-6 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-success/15 text-success">
        <CheckCircle2 className="h-10 w-10" />
      </div>
      <div>
        <h2 className="text-xl font-extrabold">{opName} Completed!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Completed by {worker?.name ?? step.assignedTo ?? "—"}
          {step.completedAt ? ` · ${formatTime(step.completedAt)}` : ""}
        </p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 text-left shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          What's Next?
        </p>
        <button
          onClick={continueNext}
          className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl bg-background px-3 py-3 text-left hover:bg-accent"
        >
          <span className="text-sm font-semibold">{nextOpName ?? "Cost Summary"}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <button
        onClick={continueNext}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-105"
      >
        Continue <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ---------- Shared ---------- */

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
