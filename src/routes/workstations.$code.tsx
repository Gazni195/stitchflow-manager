import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Factory, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useWorkstationCards, useWorkstationHistory } from "@/lib/api/workstations";

export const Route = createFileRoute("/workstations/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Workstation ${params.code} — Fawri Lifestyle` },
      { name: "description", content: `Activity history for workstation ${params.code}.` },
      { property: "og:title", content: `Workstation ${params.code} — Fawri Lifestyle` },
      { property: "og:description", content: `Activity history for workstation ${params.code}.` },
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

function WorkstationDetail() {
  const { code } = Route.useParams();
  const { data: cards = [] } = useWorkstationCards();
  const card = cards.find((c) => c.workstationId === code);
  const { data: history = [], isLoading } = useWorkstationHistory(code);

  return (
    <AppShell title={`Workstation ${code}`}>
      <div className="mx-auto max-w-3xl space-y-6 p-4">
        <Link to="/workstations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All workstations
        </Link>

        <header className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Factory className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold tracking-tight">{code}</h1>
              <div className="text-sm text-muted-foreground">{card?.typeLabel ?? "—"}</div>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize">
              {card?.status ?? "idle"}
            </span>
          </div>

          {card && card.status !== "idle" && (
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Info label="Employee" value={card.employee ?? "—"} />
              <Info label="Order" value={card.productionOrderCode ?? "—"} />
              <Info label="Design" value={card.designCode ?? "—"} />
              <Info label="Operation" value={card.operationId ?? "—"} />
              <Info label="Assigned" value={String(card.assignedQty)} />
              <Info label="Completed" value={String(card.completedQty)} />
              <Info label="Pending" value={String(card.pendingQty)} />
            </div>
          )}
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">History</h2>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : history.length === 0 ? (
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
                    <span className="capitalize">Op: {h.operation_id}</span>
                    <span>Employee: {h.assigned_to}</span>
                    <span>Issued: {h.issued_qty}</span>
                    <span>Returned: {h.returned_qty ?? 0}</span>
                    <span>Started: {new Date(h.started_at).toLocaleString()}</span>
                    {h.completed_at && <span>Completed: {new Date(h.completed_at).toLocaleString()}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
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
