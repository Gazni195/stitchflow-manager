// Line details — orders assigned to a specific production line. All data
// comes from the Production module (production_orders + processes +
// activities); this page never writes production state.
import { createFileRoute, Link, useParams, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Factory, Loader2, PlayCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DesignImage } from "@/components/DesignImage";
import { useRequireAuth } from "@/hooks/use-auth";
import {
  computeProgress,
  currentStage,
  useOrdersByLine,
  type ProductionOrder,
} from "@/lib/api/production";
import {
  useProductionActivities,
  currentProductionStage,
} from "@/lib/api/production-activities";
import { lineBySlug } from "@/lib/lines";
import { formatHMS, elapsedSeconds } from "@/lib/factory-clock";

export const Route = createFileRoute("/lines/$line")({
  head: ({ params }) => {
    const line = lineBySlug(params.line);
    return { meta: [{ title: `${line?.name ?? "Line"} — Production Line` }] };
  },
  beforeLoad: ({ params }) => {
    if (!lineBySlug(params.line)) throw notFound();
  },
  component: LineDetails,
  notFoundComponent: () => (
    <AppShell title="Line not found">
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Unknown production line.{" "}
        <Link to="/lines" className="text-primary underline">Back to Lines</Link>
      </div>
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell title="Line">
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error.message}
      </div>
    </AppShell>
  ),
});

function LineDetails() {
  useRequireAuth();
  const { line: slug } = useParams({ from: "/lines/$line" });
  const line = lineBySlug(slug)!;
  const { data: orders = [], isLoading } = useOrdersByLine(line.name);

  const running = orders.filter((o) => o.status === "running");
  const completed = orders.filter((o) => o.status === "completed");

  return (
    <AppShell
      title={line.name}
      subtitle={line.description}
      action={
        <Link
          to="/lines"
          aria-label="Back to lines"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">All Lines</span>
        </Link>
      }
    >
      <div className="grid gap-6">
        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Running Orders</h2>
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
              {running.length}
            </span>
          </div>
          {isLoading ? (
            <div className="grid place-items-center rounded-2xl border border-border bg-card p-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : running.length === 0 ? (
            <EmptyState label={`No running orders on ${line.name}.`} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {running.map((o) => (
                <RunningOrderCard key={o.id} order={o} />
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Completed Orders</h2>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {completed.length}
            </span>
          </div>
          {completed.length === 0 ? (
            <EmptyState label="No completed orders yet." />
          ) : (
            <ul className="grid gap-2">
              {completed.map((o) => (
                <CompletedRow key={o.id} order={o} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <Factory className="mx-auto h-6 w-6 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function RunningOrderCard({ order }: { order: ProductionOrder }) {
  const { data: activities = [] } = useProductionActivities(order.id);
  const activeStage = currentProductionStage(activities);
  const stageLabel = activeStage.label !== "Not started" ? activeStage.label : currentStage(order.processes);
  const pct = computeProgress(order.processes);
  const running = activities.find((a) => a.status === "running");

  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[16/9] w-full bg-primary-soft">
        <DesignImage path={order.imagePath ?? null} alt={order.designName ?? ""} />
        <span className="absolute right-2 top-2 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-sm">
          Running
        </span>
      </div>
      <div className="grid gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold tracking-widest text-muted-foreground">{order.code}</p>
          <p className="truncate text-base font-extrabold">{order.designCode} · {order.designName}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{order.customer}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <Fact label="Current Operation" value={stageLabel} icon={<Clock className="h-3 w-3" />} />
          <Fact label="Progress" value={`${pct}%`} />
          <Fact
            label="Started"
            value={running ? new Date(running.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
          />
          <LiveTimeFact startedAt={running?.startedAt} />
        </dl>
        <div className="flex justify-end">
          <Link
            to="/production/$po"
            params={{ po: order.code }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
          >
            Open Production Order <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </li>
  );
}

function CompletedRow({ order }: { order: ProductionOrder }) {
  return (
    <li>
      <Link
        to="/production/$po"
        params={{ po: order.code }}
        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/40"
      >
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-success/15 text-success">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            {order.code} · {order.designCode} — {order.designName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {order.customer} · {order.orderQuantity.toLocaleString()} pcs
            {order.completedAt ? ` · ${new Date(order.completedAt).toLocaleDateString()}` : ""}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </li>
  );
}

function Fact({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background p-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 inline-flex items-center gap-1 font-bold">
        {icon}
        {value}
      </dd>
    </div>
  );
}

function LiveTimeFact({ startedAt }: { startedAt: string | undefined }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const value = startedAt ? formatHMS(elapsedSeconds(new Date(startedAt), now)) : "—";
  return (
    <div className="rounded-lg border border-border bg-background p-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Live Working Time</dt>
      <dd className="mt-0.5 inline-flex items-center gap-1 font-bold tabular-nums">
        <PlayCircle className="h-3 w-3 text-primary" />
        {value}
      </dd>
    </div>
  );
}
