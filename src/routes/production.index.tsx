import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Factory,
  Loader2,
  PlayCircle,
  Clock,
  RefreshCw,
  Search,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DesignImage } from "@/components/DesignImage";
import { useRequireAuth } from "@/hooks/use-auth";
import { StartProductionWizard } from "@/components/production/StartProductionWizard";
import {
  usePendingProduction,
  useProductionOrders,
  computeProgress,
  currentStage,
  type PendingDesign,
  type ProductionOrder,
} from "@/lib/api/production";

export const Route = createFileRoute("/production/")({
  head: () => ({ meta: [{ title: "Production — Fawri Lifestyle" }] }),
  component: ProductionHome,
});

function ProductionHome() {
  useRequireAuth();
  const pending = usePendingProduction();
  const running = useProductionOrders("running");
  const completed = useProductionOrders("completed");
  const [startFor, setStartFor] = useState<PendingDesign | null>(null);
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const filteredPending = useMemo(
    () =>
      q
        ? (pending.data ?? []).filter(
            (d) =>
              d.code.toLowerCase().includes(q) ||
              d.name.toLowerCase().includes(q) ||
              d.customer.toLowerCase().includes(q),
          )
        : (pending.data ?? []),
    [pending.data, q],
  );
  const matchesOrder = (o: ProductionOrder) =>
    o.code.toLowerCase().includes(q) ||
    (o.designCode ?? "").toLowerCase().includes(q) ||
    (o.designName ?? "").toLowerCase().includes(q) ||
    (o.customer ?? "").toLowerCase().includes(q);
  const filteredRunning = useMemo(
    () => (q ? (running.data ?? []).filter(matchesOrder) : (running.data ?? [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [running.data, q],
  );
  const filteredCompleted = useMemo(
    () => (q ? (completed.data ?? []).filter(matchesOrder) : (completed.data ?? [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [completed.data, q],
  );

  const isFetching = pending.isFetching || running.isFetching || completed.isFetching;
  function refreshAll() {
    pending.refetch();
    running.refetch();
    completed.refetch();
  }

  return (
    <AppShell title="Production" subtitle="Pending, Running & Completed orders">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by PO, design, or customer…"
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm"
            />
          </label>
          <button
            onClick={refreshAll}
            title="Refresh"
            className="rounded-xl border border-border bg-background p-2.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RefreshCw className={"h-4 w-4 " + (isFetching ? "animate-spin" : "")} />
          </button>
        </div>

        <div className="grid gap-8">
          <Section
            title="Pending Production"
            count={filteredPending.length}
            empty={q ? "No pending designs match your search." : "No approved samples awaiting production."}
            loading={pending.isLoading}
            error={pending.error}
            onRetry={() => pending.refetch()}
          >
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPending.map((d) => (
                <PendingCard key={d.id} d={d} onStart={() => setStartFor(d)} />
              ))}
            </ul>
          </Section>

          <Section
            title="Running Production"
            count={filteredRunning.length}
            empty={q ? "No running orders match your search." : "No production orders are running."}
            loading={running.isLoading}
            error={running.error}
            onRetry={() => running.refetch()}
          >
            <OrdersTable orders={filteredRunning} />
          </Section>

          <Section
            title="Completed Production"
            count={filteredCompleted.length}
            empty={q ? "No completed orders match your search." : "No completed production orders yet."}
            loading={completed.isLoading}
            error={completed.error}
            onRetry={() => completed.refetch()}
          >
            <OrdersTable orders={filteredCompleted} completed />
          </Section>
        </div>
      </div>

      {startFor && <StartProductionWizard design={startFor} onClose={() => setStartFor(null)} />}
    </AppShell>
  );
}

function Section({
  title,
  count,
  empty,
  loading,
  error,
  onRetry,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  loading: boolean;
  error?: unknown;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">{title}</h2>
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{count}</span>
      </div>
      {loading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
          <p className="mt-2 text-sm text-destructive">
            Failed to load. {error instanceof Error ? error.message : "Please try again."}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-accent"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          )}
        </div>
      ) : count === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <Factory className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

// Compact layout matching the Sample Development card exactly (same p-3
// container, h-16 w-16 thumbnail, same code/name/customer typography) —
// only the extra row (Qty/Approved/Start Production) is new, since Pending
// cards need fields Sample cards don't.
function PendingCard({ d, onStart }: { d: PendingDesign; onStart: () => void }) {
  return (
    <li className="rounded-2xl border border-border bg-card p-3 shadow-sm transition hover:border-primary/40 hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-primary-soft">
          <DesignImage path={d.imagePath} alt={d.name} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold tracking-wider text-muted-foreground">{d.code}</p>
          <p className="truncate text-sm font-bold">{d.name}</p>
          <p className="truncate text-xs text-muted-foreground">{d.customer}</p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2.5">
        <div className="flex min-w-0 items-center gap-3 text-xs text-muted-foreground">
          <span className="font-bold text-foreground">{d.orderQuantity.toLocaleString()} Pcs</span>
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-success" />
            {d.approvedAt
              ? new Date(d.approvedAt).toLocaleDateString(undefined, {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "—"}
          </span>
        </div>
        <button
          onClick={onStart}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
        >
          <PlayCircle className="h-3.5 w-3.5" /> Start Production
        </button>
      </div>
    </li>
  );
}

function OrdersTable({ orders, completed = false }: { orders: ProductionOrder[]; completed?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">PO</th>
              <th className="px-4 py-3 text-left">Design</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-left">{completed ? "Finished" : "Current Stage"}</th>
              <th className="px-4 py-3 text-left">Progress</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((o) => {
              // A completed order is always 100% regardless of what the
              // (unused-by-the-live-workflow) production_processes.status
              // rows happen to say.
              const pct = o.status === "completed" ? 100 : computeProgress(o.processes);
              const stage = currentStage(o.processes);
              return (
                <tr key={o.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-bold text-foreground">
                    <Link to="/production/$po" params={{ po: o.code }} className="hover:text-primary">
                      {o.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold">{o.designCode}</span>
                      <span className="truncate text-xs text-muted-foreground">{o.designName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{o.customer}</td>
                  <td className="px-4 py-3 text-right font-semibold">{o.orderQuantity}</td>
                  <td className="px-4 py-3">
                    {completed ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        {o.completedAt ? new Date(o.completedAt).toLocaleDateString() : "—"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                        <Clock className="h-3 w-3" /> {stage}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-muted-foreground">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[11px] font-bold " +
                        (o.status === "completed" ? "bg-success/15 text-success" : "bg-primary-soft text-primary")
                      }
                    >
                      {o.status === "completed" ? "Completed" : "Running"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/production/$po"
                      params={{ po: o.code }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                    >
                      Open <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
