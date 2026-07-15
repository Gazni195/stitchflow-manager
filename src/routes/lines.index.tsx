// Line module — read-only view onto Production. Each line lists the
// Production Orders currently assigned to it. Never creates or duplicates
// production data.
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Factory, PlayCircle, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/hooks/use-auth";
import { useProductionOrders } from "@/lib/api/production";
import { PRODUCTION_LINES } from "@/lib/lines";

export const Route = createFileRoute("/lines/")({
  head: () => ({ meta: [{ title: "Production Lines — Fawri Lifestyle" }] }),
  component: LinesHome,
});

function LinesHome() {
  useRequireAuth();
  const running = useProductionOrders("running");
  const completed = useProductionOrders("completed");

  const byLineRunning = new Map<string, number>();
  const byLineCompleted = new Map<string, number>();
  (running.data ?? []).forEach((o) => {
    if (!o.assignedLine) return;
    byLineRunning.set(o.assignedLine, (byLineRunning.get(o.assignedLine) ?? 0) + 1);
  });
  (completed.data ?? []).forEach((o) => {
    if (!o.assignedLine) return;
    byLineCompleted.set(o.assignedLine, (byLineCompleted.get(o.assignedLine) ?? 0) + 1);
  });

  const unassignedRunning = (running.data ?? []).filter((o) => !o.assignedLine).length;

  return (
    <AppShell title="Production Lines" subtitle="Execution view of Production Orders">
      <div className="grid gap-5">
        {unassignedRunning > 0 && (
          <div className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm font-semibold text-warning">
            {unassignedRunning} running order{unassignedRunning === 1 ? "" : "s"} still have no line assigned.{" "}
            <Link to="/production" className="underline">Assign from Production →</Link>
          </div>
        )}

        <ul className="grid gap-3 sm:grid-cols-2">
          {PRODUCTION_LINES.map((l) => {
            const r = byLineRunning.get(l.name) ?? 0;
            const c = byLineCompleted.get(l.name) ?? 0;
            return (
              <li key={l.slug}>
                <Link
                  to="/lines/$line"
                  params={{ line: l.slug }}
                  className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Factory className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-extrabold">{l.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{l.description}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 font-bold text-primary">
                        <PlayCircle className="h-3 w-3" /> {r} running
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3" /> {c} completed
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="mt-3 h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
