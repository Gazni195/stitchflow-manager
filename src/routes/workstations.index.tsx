import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Factory, User, Package, Loader2, RefreshCw, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useWorkstationCards, type WorkstationCard, type WorkstationStatus } from "@/lib/api/workstations";
import { ACTIVITY_OP_NAME } from "@/lib/api/production-activities";

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
  pending: "bg-amber-100 text-amber-700",
  running: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
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
          <span className="truncate">{card.current?.assignedTo ?? "Unassigned"}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Package className="h-3.5 w-3.5" />
          <span className="truncate">
            {card.current?.productionOrderCode
              ? `${card.current.productionOrderCode} · ${card.current.designCode ?? "—"}`
              : "No job running"}
          </span>
        </div>
        {card.current && <div className="text-xs text-muted-foreground">Operation: {ACTIVITY_OP_NAME[card.current.operationId]}</div>}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-2 text-center">
        <div>
          <div className="text-xs text-muted-foreground">Pending Queue</div>
          <div className="text-sm font-semibold text-amber-600">{card.pendingCount}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Completed Today</div>
          <div className="text-sm font-semibold text-emerald-600">{card.completedTodayCount}</div>
        </div>
      </div>
    </Link>
  );
}

function WorkstationsPage() {
  const { data: cards = [], isLoading, isFetching, error, refetch } = useWorkstationCards();
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const visibleCards = q
    ? cards.filter((c) => c.workstationId.toLowerCase().includes(q) || c.typeLabel.toLowerCase().includes(q))
    : cards;

  const groups = visibleCards.reduce<Record<string, { label: string; items: WorkstationCard[] }>>((acc, c) => {
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

        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by workstation or type…"
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm"
            />
          </label>
          <button
            onClick={() => refetch()}
            title="Refresh"
            className="rounded-xl border border-border bg-background p-2.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RefreshCw className={"h-4 w-4 " + (isFetching ? "animate-spin" : "")} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading workstations…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center">
            <p className="text-sm text-destructive">
              Failed to load workstations. {error instanceof Error ? error.message : ""}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-accent"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No workstations configured yet.{" "}
            <Link to="/settings/workstations" className="text-primary hover:underline">
              Set them up
            </Link>
            .
          </div>
        ) : visibleCards.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No workstations match your search.
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
