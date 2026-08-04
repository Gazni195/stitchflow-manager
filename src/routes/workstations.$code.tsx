import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Factory, Loader2, PlayCircle, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useWorkstationCards, useWorkstationHistory, type WorkstationJobRef } from "@/lib/api/workstations";
import { ACTIVITY_OP_NAME, useBeginActivity, type ProductionActivity } from "@/lib/api/production-activities";
import { RunningActivityCard, CompleteActivityDialog } from "@/routes/production.$po";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/workstations/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Workstation ${params.code} — Fawri Lifestyle` },
      { name: "description", content: `Live queue for workstation ${params.code}.` },
      { property: "og:title", content: `Workstation ${params.code} — Fawri Lifestyle` },
      { property: "og:description", content: `Live queue for workstation ${params.code}.` },
    ],
  }),
  component: WorkstationDetail,
  notFoundComponent: () => (
    <AppShell title="Workstation">
      <div className="p-6 text-sm text-muted-foreground">Workstation not found.</div>
    </AppShell>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <AppShell title="Workstation">
        <div className="space-y-3 p-6">
          <p className="text-sm text-destructive">Failed to load workstation: {error.message}</p>
          <button
            onClick={() => {
              reset();
              router.invalidate();
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            Retry
          </button>
        </div>
      </AppShell>
    );
  },
});

const STATUS_LABEL: Record<string, string> = {
  idle: "Idle",
  pending: "Pending",
  running: "Running",
  paused: "Paused",
};
const STATUS_STYLES: Record<string, string> = {
  idle: "bg-muted text-muted-foreground",
  pending: "bg-amber-100 text-amber-700",
  running: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
};

function WorkstationDetail() {
  const { code } = Route.useParams();
  const cardsQuery = useWorkstationCards();
  const cards = cardsQuery.data ?? [];
  const card = cards.find((c) => c.workstationId === code);
  const historyQuery = useWorkstationHistory(code);
  const history = historyQuery.data ?? [];
  const isLoading = historyQuery.isLoading;
  const isFetching = historyQuery.isFetching || cardsQuery.isFetching;
  const [completeFor, setCompleteFor] = useState<ProductionActivity | null>(null);
  const begin = useBeginActivity();

  function refresh() {
    cardsQuery.refetch();
    historyQuery.refetch();
  }

  const running = history.find((h) => h.status === "running" || h.status === "paused") ?? null;
  // FIFO by assignment time — the numbered order shown here is a guide,
  // not a hard lock: any pending job can be started once the station is
  // free, in case the "next" one's materials aren't actually ready yet.
  const pendingQueue = [...history].filter((h) => h.status === "pending").sort((a, b) => a.assignedAt.localeCompare(b.assignedAt));
  const today = new Date().toISOString().slice(0, 10);
  const completedToday = history.filter((h) => h.status === "completed" && (h.completedAt ?? "").slice(0, 10) === today);

  return (
    <AppShell title={`Workstation ${code}`}>
      <div className="mx-auto max-w-3xl space-y-6 p-4">
        <div className="flex items-center justify-between gap-2">
          <Link to="/workstations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All workstations
          </Link>
          <button
            onClick={refresh}
            title="Refresh"
            className="rounded-lg border border-border bg-background p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RefreshCw className={"h-4 w-4 " + (isFetching ? "animate-spin" : "")} />
          </button>
        </div>

        <header className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Factory className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold tracking-tight">{code}</h1>
              <div className="text-sm text-muted-foreground">{card?.typeLabel ?? "—"}</div>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium",
                STATUS_STYLES[card?.status ?? "idle"],
              )}
            >
              {STATUS_LABEL[card?.status ?? "idle"]}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Info label="Pending Queue" value={String(pendingQueue.length)} />
            <Info label="Completed Today" value={String(completedToday.length)} />
            <Info label="Current Job" value={running ? ACTIVITY_OP_NAME[running.operationId] : "None"} />
          </div>
        </header>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Running Job</h2>
              {running ? (
                <div className="max-w-sm">
                  <RunningActivityCard activity={running} onComplete={() => setCompleteFor(running)} />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nothing running right now.
                  {pendingQueue.length > 0 && " Start a job from the Pending Queue below."}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pending Queue</h2>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                  {pendingQueue.length}
                </span>
              </div>
              {pendingQueue.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No jobs queued at this workstation.
                </div>
              ) : (
                <ul className="space-y-2">
                  {pendingQueue.map((p, i) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-700">
                            {i + 1}
                          </span>
                          <span className="truncate font-semibold">{ACTIVITY_OP_NAME[p.operationId]}</span>
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {p.productionOrderCode ?? "—"} · {p.designCode ?? "—"} · {p.assignedTo} · {p.issuedQty} pcs
                        </div>
                      </div>
                      <button
                        onClick={() => begin.mutate(p)}
                        disabled={begin.isPending || !!running}
                        title={running ? "Finish the running job first" : undefined}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <PlayCircle className="h-3.5 w-3.5" /> Start
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Completed Today</h2>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  {completedToday.length}
                </span>
              </div>
              {completedToday.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nothing completed at this workstation today.
                </div>
              ) : (
                <ul className="space-y-2">
                  {completedToday.map((h) => (
                    <CompletedRow key={h.id} job={h} />
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">All History</h2>
              {history.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No activity recorded on this workstation yet.
                </div>
              ) : (
                <ul className="space-y-2">
                  {history.map((h) => (
                    <li key={h.id} className="rounded-xl border bg-card p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">
                          {h.productionOrderCode ?? "—"} · <span className="text-muted-foreground">{h.designCode ?? "—"}</span>
                        </div>
                        <span className="text-xs capitalize text-muted-foreground">{h.status}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Op: {ACTIVITY_OP_NAME[h.operationId]}</span>
                        <span>Employee: {h.assignedTo}</span>
                        <span>Issued: {h.issuedQty}</span>
                        <span>Returned: {h.returnedQty ?? 0}</span>
                        <span>Assigned: {new Date(h.assignedAt).toLocaleString()}</span>
                        {h.startedAt && <span>Started: {new Date(h.startedAt).toLocaleString()}</span>}
                        {h.completedAt && <span>Completed: {new Date(h.completedAt).toLocaleString()}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      {completeFor && <CompleteActivityDialog activity={completeFor} onClose={() => setCompleteFor(null)} />}
    </AppShell>
  );
}

function CompletedRow({ job }: { job: WorkstationJobRef }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm">
      <div className="min-w-0">
        <span className="truncate font-semibold">{ACTIVITY_OP_NAME[job.operationId]}</span>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {job.productionOrderCode ?? "—"} · {job.designCode ?? "—"} · {job.assignedTo}
        </div>
      </div>
      <div className="shrink-0 text-right text-xs text-muted-foreground">
        <div>
          📦 {job.issuedQty} → 📥 {job.returnedQty ?? 0}
        </div>
        {job.completedAt && <div>{new Date(job.completedAt).toLocaleTimeString()}</div>}
      </div>
    </li>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  );
}
