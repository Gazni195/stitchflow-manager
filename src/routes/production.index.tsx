import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Factory,
  Loader2,
  PlayCircle,
  Clock,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DesignImage } from "@/components/DesignImage";
import { useRequireAuth } from "@/hooks/use-auth";
import {
  usePendingProduction,
  useProductionOrders,
  useStartProduction,
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

  return (
    <AppShell title="Production" subtitle="Pending, Running & Completed orders">
      <div className="grid gap-8">
        <Section
          title="Pending Production"
          count={pending.data?.length ?? 0}
          empty="No approved samples awaiting production."
          loading={pending.isLoading}
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {(pending.data ?? []).map((d) => (
              <PendingCard key={d.id} d={d} onStart={() => setStartFor(d)} />
            ))}
          </ul>
        </Section>

        <Section
          title="Running Production"
          count={running.data?.length ?? 0}
          empty="No production orders are running."
          loading={running.isLoading}
        >
          <OrdersTable orders={running.data ?? []} />
        </Section>

        <Section
          title="Completed Production"
          count={completed.data?.length ?? 0}
          empty="No completed production orders yet."
          loading={completed.isLoading}
        >
          <OrdersTable orders={completed.data ?? []} completed />
        </Section>
      </div>

      {startFor && <StartProductionDialog design={startFor} onClose={() => setStartFor(null)} />}
    </AppShell>
  );
}

function Section({
  title,
  count,
  empty,
  loading,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">{title}</h2>
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
          {count}
        </span>
      </div>
      {loading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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

function PendingCard({ d, onStart }: { d: PendingDesign; onStart: () => void }) {
  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[16/9] w-full bg-primary-soft">
        <DesignImage path={d.imagePath} alt={d.name} />
        <span className="absolute right-2 top-2 rounded-full bg-success/90 px-2.5 py-1 text-[11px] font-bold text-success-foreground shadow-sm">
          Sample Approved
        </span>
      </div>
      <div className="grid gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold tracking-widest text-muted-foreground">{d.code}</p>
          <p className="truncate text-base font-extrabold">{d.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{d.customer}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-border bg-background p-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Order Qty</dt>
            <dd className="mt-0.5 font-bold">{d.orderQuantity.toLocaleString()} Pcs</dd>
          </div>
          <div className="rounded-lg border border-border bg-background p-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Approved</dt>
            <dd className="mt-0.5 inline-flex items-center gap-1 font-bold">
              <CheckCircle2 className="h-3 w-3 text-success" />
              {d.approvedAt ? new Date(d.approvedAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—"}
            </dd>
          </div>
        </dl>
        <div className="flex justify-end">
          <button
            onClick={onStart}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
          >
            <PlayCircle className="h-3.5 w-3.5" /> Start Production
          </button>
        </div>
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
              const pct = computeProgress(o.processes);
              const stage = currentStage(o.processes);
              return (
                <tr key={o.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-bold text-foreground">
                    <Link
                      to="/production/$po"
                      params={{ po: o.code }}
                      className="hover:text-primary"
                    >
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
                        (o.status === "completed"
                          ? "bg-success/15 text-success"
                          : "bg-primary-soft text-primary")
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

function StartProductionDialog({ design, onClose }: { design: PendingDesign; onClose: () => void }) {
  const [quantity, setQuantity] = useState<number>(design.orderQuantity);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [supervisor, setSupervisor] = useState<string>("");
  const start = useStartProduction();

  async function submit() {
    if (!quantity || quantity < 1) return;
    await start.mutateAsync({
      designId: design.id,
      orderQuantity: quantity,
      startDate,
      supervisor: supervisor.trim(),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-base font-bold">Start Production</h3>
            <p className="text-xs text-muted-foreground">Create a new Production Order</p>
          </div>
          <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 p-5">
          <Field label="Production Order">
            <input
              disabled
              value="Auto-generated (PO###)"
              className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
            />
          </Field>
          <Field label="Design">
            <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <span className="font-bold">{design.code}</span>{" "}
              <span className="text-muted-foreground">· {design.name}</span>
            </div>
          </Field>
          <Field label="Order Quantity">
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Production Start Date">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Supervisor (optional)">
            <input
              value={supervisor}
              onChange={(e) => setSupervisor(e.target.value)}
              placeholder="e.g. Ramesh K."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          {start.error && (
            <p className="text-xs text-destructive">
              {(start.error as Error).message ?? "Could not start production"}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={start.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {start.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
            Start Production
          </button>
        </div>
      </div>
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
