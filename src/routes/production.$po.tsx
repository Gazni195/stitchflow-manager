import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Lock,
  Loader2,
  Package,
  PlayCircle,
  User,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DesignImage } from "@/components/DesignImage";
import { useRequireAuth } from "@/hooks/use-auth";
import {
  useCompleteProcess,
  useIssueBundle,
  useProductionOrder,
  computeProgress,
  OP_NAME,
  type ProcessOperationId,
  type ProductionProcess,
  type WorkerType,
} from "@/lib/api/production";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/production/$po")({
  head: ({ params }) => ({ meta: [{ title: `${params.po} — Production` }] }),
  component: ProductionDetails,
});

const WORKER_TYPES: { id: WorkerType; label: string }[] = [
  { id: "hand_worker", label: "Hand Worker" },
  { id: "machine_operator", label: "Machine Operator" },
  { id: "vendor", label: "Vendor" },
];

function ProductionDetails() {
  useRequireAuth();
  const { po } = Route.useParams();
  const { data: order, isLoading } = useProductionOrder(po);
  const [issueFor, setIssueFor] = useState<ProductionProcess | null>(null);
  const [completeFor, setCompleteFor] = useState<ProductionProcess | null>(null);

  if (isLoading) {
    return (
      <AppShell title={po}>
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }
  if (!order) {
    return (
      <AppShell title={po}>
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Production Order not found.</p>
          <Link to="/production" className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-primary">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Production
          </Link>
        </div>
      </AppShell>
    );
  }

  const pct = computeProgress(order.processes);

  return (
    <AppShell
      title={order.code}
      subtitle={`${order.designCode} · ${order.designName}`}
      action={
        <Link to="/production" className="hidden items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground sm:inline-flex">
          <ArrowLeft className="h-3.5 w-3.5" /> All Orders
        </Link>
      }
    >
      <div className="grid gap-5">
        {/* Header */}
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
            <div className="grid gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-widest text-muted-foreground">{order.code}</p>
                <h2 className="text-xl font-extrabold">{order.designName}</h2>
                <p className="text-xs text-muted-foreground">
                  {order.customer} · Started {new Date(order.startDate).toLocaleDateString()}
                  {order.supervisor ? ` · Supervisor ${order.supervisor}` : ""}
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="Order Qty" value={`${order.orderQuantity} Pcs`} />
                <Stat label="Progress" value={`${pct}%`} />
                <Stat label="Status" value={order.status === "completed" ? "Completed" : "Running"} />
              </dl>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="relative aspect-square w-full max-w-[180px] overflow-hidden rounded-2xl bg-primary-soft sm:ml-auto">
              <DesignImage path={order.imagePath ?? null} alt={order.designName ?? ""} />
            </div>
          </div>
        </section>

        {/* Operations */}
        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">Operations</h3>
            <span className="text-xs text-muted-foreground">Bundle-based · Sequential unlock</span>
          </div>
          <ul className="grid gap-3">
            {(order.processes ?? []).map((p) => (
              <ProcessRow
                key={p.id}
                p={p}
                onIssue={() => setIssueFor(p)}
                onComplete={() => setCompleteFor(p)}
              />
            ))}
          </ul>
        </section>
      </div>

      {issueFor && (
        <IssueBundleDialog process={issueFor} poCode={order.code} onClose={() => setIssueFor(null)} />
      )}
      {completeFor && (
        <CompleteProcessDialog process={completeFor} poCode={order.code} onClose={() => setCompleteFor(null)} />
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold">{value}</dd>
    </div>
  );
}

function ProcessRow({
  p,
  onIssue,
  onComplete,
}: {
  p: ProductionProcess;
  onIssue: () => void;
  onComplete: () => void;
}) {
  const opName = OP_NAME[p.operationId as ProcessOperationId] ?? p.operationId;
  return (
    <li
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-sm",
        p.status === "completed" ? "border-success/40" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <StageBadge status={p.status} sequence={p.sequence} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold">{opName}</p>
            <StatusPill status={p.status} />
          </div>
          {p.status !== "locked" && p.status !== "pending" && (
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <Meta label="Worker" value={p.assignedTo ?? "—"} icon={<User className="h-3 w-3" />} />
              <Meta
                label="Worker Type"
                value={
                  p.workerType === "hand_worker"
                    ? "Hand Worker"
                    : p.workerType === "machine_operator"
                    ? "Machine Op."
                    : p.workerType === "vendor"
                    ? "Vendor"
                    : "—"
                }
              />
              <Meta label="Issued" value={p.issuedQty != null ? `${p.issuedQty} pcs` : "—"} />
              <Meta label="Returned" value={p.returnedQty != null ? `${p.returnedQty} pcs` : "—"} />
            </dl>
          )}
          {p.notes && <p className="mt-2 rounded-lg bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">{p.notes}</p>}
        </div>
        <div className="shrink-0">
          {p.status === "locked" && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-3 py-2 text-xs font-bold text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Locked
            </span>
          )}
          {p.status === "pending" && (
            <button
              onClick={onIssue}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
            >
              <PlayCircle className="h-3.5 w-3.5" /> Start Process
            </button>
          )}
          {p.status === "issued" && (
            <button
              onClick={onComplete}
              className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-xs font-bold text-success-foreground hover:opacity-90"
            >
              <Package className="h-3.5 w-3.5" /> Complete Process
            </button>
          )}
          {p.status === "completed" && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-success/15 px-3 py-2 text-xs font-bold text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Done
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function StageBadge({ status, sequence }: { status: ProductionProcess["status"]; sequence: number }) {
  return (
    <div
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black",
        status === "completed"
          ? "bg-success text-success-foreground"
          : status === "issued"
          ? "bg-primary text-primary-foreground"
          : status === "pending"
          ? "bg-primary-soft text-primary"
          : "bg-muted text-muted-foreground",
      )}
    >
      {status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : sequence}
    </div>
  );
}

function StatusPill({ status }: { status: ProductionProcess["status"] }) {
  const map: Record<ProductionProcess["status"], string> = {
    locked: "bg-muted text-muted-foreground",
    pending: "bg-primary-soft text-primary",
    issued: "bg-warning/15 text-warning",
    completed: "bg-success/15 text-success",
  };
  const label: Record<ProductionProcess["status"], string> = {
    locked: "Locked",
    pending: "Pending",
    issued: "Issued",
    completed: "Completed",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", map[status])}>
      {label[status]}
    </span>
  );
}

function Meta({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md bg-background/60 px-2 py-1">
      <dt className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 inline-flex items-center gap-1 font-semibold">{icon}{value}</dd>
    </div>
  );
}

// --------- Dialogs ---------
function IssueBundleDialog({
  process,
  poCode,
  onClose,
}: {
  process: ProductionProcess;
  poCode: string;
  onClose: () => void;
}) {
  const opName = OP_NAME[process.operationId as ProcessOperationId] ?? process.operationId;
  const [workerType, setWorkerType] = useState<WorkerType>("hand_worker");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [qty, setQty] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const issue = useIssueBundle(poCode);

  async function submit() {
    if (!assignedTo.trim() || qty < 1) return;
    await issue.mutateAsync({
      processId: process.id,
      workerType,
      assignedTo: assignedTo.trim(),
      issuedQty: qty,
      notes: notes.trim(),
    });
    onClose();
  }

  return (
    <DialogShell title="Start Process" subtitle="Issue a bundle for this operation" onClose={onClose}>
      <div className="grid gap-4 p-5">
        <Field label="Operation">
          <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-bold">{opName}</div>
        </Field>
        <Field label="Worker Type">
          <div className="grid grid-cols-3 gap-2">
            {WORKER_TYPES.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWorkerType(w.id)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs font-bold",
                  workerType === w.id ? "border-primary bg-primary-soft text-primary" : "border-border bg-background text-foreground hover:bg-accent",
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Assign To">
          <input
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="e.g. HW-07 / Vendor Name"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Issue Quantity">
          <input
            type="number"
            min={1}
            value={qty || ""}
            onChange={(e) => setQty(Number(e.target.value))}
            placeholder="e.g. 40"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any instructions or remarks"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        {issue.error && <p className="text-xs text-destructive">{(issue.error as Error).message}</p>}
      </div>
      <DialogFooter onCancel={onClose}>
        <button
          onClick={submit}
          disabled={issue.isPending || !assignedTo.trim() || qty < 1}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {issue.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Issue Bundle
        </button>
      </DialogFooter>
    </DialogShell>
  );
}

function CompleteProcessDialog({
  process,
  poCode,
  onClose,
}: {
  process: ProductionProcess;
  poCode: string;
  onClose: () => void;
}) {
  const opName = OP_NAME[process.operationId as ProcessOperationId] ?? process.operationId;
  const [returned, setReturned] = useState<number>(process.issuedQty ?? 0);
  const complete = useCompleteProcess(poCode);

  async function submit() {
    await complete.mutateAsync({ processId: process.id, returnedQty: returned });
    onClose();
  }

  return (
    <DialogShell title="Complete Process" subtitle={opName} onClose={onClose}>
      <div className="grid gap-4 p-5">
        <div className="rounded-xl bg-muted/50 p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Assigned To</span>
            <span className="font-bold">{process.assignedTo ?? "—"}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">Issued Qty</span>
            <span className="font-bold">{process.issuedQty ?? 0} pcs</span>
          </div>
        </div>
        <Field label="Return Quantity">
          <input
            type="number"
            min={0}
            value={returned}
            onChange={(e) => setReturned(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        {complete.error && <p className="text-xs text-destructive">{(complete.error as Error).message}</p>}
      </div>
      <DialogFooter onCancel={onClose}>
        <button
          onClick={submit}
          disabled={complete.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-success px-4 py-2 text-xs font-bold text-success-foreground hover:opacity-90 disabled:opacity-60"
        >
          {complete.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Complete Process
        </button>
      </DialogFooter>
    </DialogShell>
  );
}

function DialogShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-base font-bold">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DialogFooter({ onCancel, children }: { onCancel: () => void; children: React.ReactNode }) {
  return (
    <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
      <button
        onClick={onCancel}
        className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-accent"
      >
        Cancel
      </button>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
