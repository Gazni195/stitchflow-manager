import { createFileRoute, Link } from "@tanstack/react-router";
import { Factory, User, Package, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useWorkstationCards, type WorkstationCard, type WorkstationStatus } from "@/lib/api/workstations";

export const Route = createFileRoute("/workstations/")({
  head: () => ({
    meta: [
      { title: "Workstations — Fawri Lifestyle" },
      { name: "description", content: "Live status of every production workstation." },
      { property: "og:title", content: "Workstations — Fawri Lifestyle" },
      { property: "og:description", content: "Live status of every production workstation." },
    ],
  }),
  component: WorkstationsPage,
});

const STATUS_STYLES: Record<WorkstationStatus, string> = {
  idle: "bg-muted text-muted-foreground",
  running: "bg-emerald-100 text-emerald-700",
  completed: "bg-violet-100 text-violet-700",
};

function StatusBadge({ status }: { status: WorkstationStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function Card({ card }: { card: WorkstationCard }) {
  return (
    <Link
      to="/workstations/$code"
      params={{ code: card.workstationId }}
      className="block rounded-2xl border bg-card p-4 shadow-sm transition hover:shadow-md hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
              <Factory className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight">{card.workstationId}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{card.typeLabel}</div>
        </div>
        <StatusBadge status={card.status} />
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          <span className="truncate">{card.employee ?? "Unassigned"}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Package className="h-3.5 w-3.5" />
          <span className="truncate">
            {card.productionOrderCode ? `${card.productionOrderCode} · ${card.designCode ?? "—"}` : "No active order"}
          </span>
        </div>
        {card.operationId && (
          <div className="text-xs text-muted-foreground capitalize">Operation: {card.operationId}</div>
        )}
      </div>

      {card.status !== "idle" && (
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Assigned</div>
            <div className="text-sm font-semibold">{card.assignedQty}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Completed</div>
            <div className="text-sm font-semibold text-emerald-600">{card.completedQty}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Pending</div>
            <div className="text-sm font-semibold text-amber-600">{card.pendingQty}</div>
          </div>
        </div>
      )}
    </Link>
  );
}

function WorkstationsPage() {
  const { data: cards = [], isLoading } = useWorkstationCards();

  const groups = cards.reduce<Record<string, { label: string; items: WorkstationCard[] }>>((acc, c) => {
    if (!acc[c.typeKey]) acc[c.typeKey] = { label: c.typeLabel, items: [] };
    acc[c.typeKey].items.push(c);
    return acc;
  }, {});

  return (
    <AppShell title="Workstations">
      <div className="mx-auto max-w-6xl space-y-6 p-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Workstations</h1>
            <p className="text-sm text-muted-foreground">Live floor status across every workstation.</p>
          </div>
          <Link to="/settings/workstations" className="text-sm text-primary hover:underline">
            Configure
          </Link>
        </header>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading workstations…
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No workstations configured yet.{" "}
            <Link to="/settings/workstations" className="text-primary hover:underline">
              Set them up
            </Link>
            .
          </div>
        ) : (
          Object.entries(groups).map(([key, group]) => (
            <section key={key} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label} <span className="text-muted-foreground/60">({group.items.length})</span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((c) => (
                  <Card key={c.workstationId} card={c} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </AppShell>
  );
}
