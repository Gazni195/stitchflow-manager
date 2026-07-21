import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, ArrowRight, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DesignImage } from "@/components/DesignImage";
import { DesignWizard } from "@/components/DesignWizard";
import { useDesigns } from "@/lib/api/designs";
import { STATUS_LABEL, STATUS_TONE, type Design } from "@/lib/designs";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Dashboard — Fawri Lifestyle" }, { name: "description", content: "Your samples at a glance." }],
  }),
  component: Dashboard,
});

type Filter = "in_progress" | "completed" | "on_hold";

const FILTERS: { id: Filter; label: string; tone: string }[] = [
  { id: "in_progress", label: "In Progress", tone: "bg-primary-soft text-primary" },
  { id: "completed", label: "Completed", tone: "bg-success/15 text-success" },
  { id: "on_hold", label: "On Hold", tone: "bg-warning/15 text-warning" },
];

// Deterministic mock "designer" + progress for UI-first pass.
function mockMeta(d: Design, i: number) {
  const designers = ["Rifa", "Sameer", "Rifa", "Anaya", "Rohan"];
  const progresses = [45, 100, 20, 65, 80, 30];
  return {
    designer: designers[i % designers.length],
    progress: d.status === "completed" ? 100 : progresses[i % progresses.length],
  };
}

function bucketOf(d: Design): Filter {
  if (d.status === "completed") return "completed";
  if (d.status === "draft") return "on_hold";
  return "in_progress";
}

function Dashboard() {
  const { data: designs = [], isLoading } = useDesigns();
  const [filter, setFilter] = useState<Filter>("in_progress");
  const [wizard, setWizard] = useState(false);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { in_progress: 0, completed: 0, on_hold: 0 };
    designs.forEach((d) => (c[bucketOf(d)] += 1));
    // Ensure at least the mockup-ish presence even with sparse data
    return {
      in_progress: c.in_progress || 7,
      completed: c.completed || 18,
      on_hold: c.on_hold || 3,
    };
  }, [designs]);

  const filtered = designs.filter((d) => bucketOf(d) === filter);

  return (
    <AppShell title="Dashboard" subtitle="Fawri Lifestyle">
      <div className="grid gap-6">
        {/* Greeting */}
        <section>
          <h2 className="text-2xl font-extrabold tracking-tight">
            Hello, Rawana <span aria-hidden>👋</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Here's what's happening today</p>
        </section>

        {/* Status filter chips */}
        <section className="grid grid-cols-3 gap-3">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={
                  "rounded-2xl border p-3 text-left transition " +
                  (active
                    ? "border-primary bg-primary-soft shadow-sm"
                    : "border-border bg-card hover:border-primary/30")
                }
              >
                <span className={"inline-block rounded-full px-2 py-0.5 text-[10px] font-bold " + f.tone}>
                  {f.label}
                </span>
                <p className="mt-2 text-2xl font-extrabold tracking-tight">{counts[f.id]}</p>
              </button>
            );
          })}
        </section>

        {/* My Samples */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h3 className="text-lg font-bold tracking-tight">My Samples</h3>
            <Link to="/sample-development" className="text-xs font-semibold text-primary hover:underline">
              View All
            </Link>
          </div>

          {isLoading ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
              <p className="text-sm text-muted-foreground">No samples in this bucket yet.</p>
              <Link
                to="/designs"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Go to Designs <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <ul className="grid gap-3">
              {filtered.map((d, i) => {
                const meta = mockMeta(d, i);
                return (
                  <li key={d.id}>
                    <Link
                      to="/sample-development/$code"
                      params={{ code: d.code }}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition hover:border-primary/40 hover:shadow-md"
                    >
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-primary-soft">
                        <DesignImage path={d.imagePath} alt={d.name} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[11px] font-bold tracking-wider text-muted-foreground">
                            {d.code}
                          </p>
                        </div>
                        <p className="truncate text-base font-extrabold">{d.name}</p>
                        <p className="truncate text-xs text-muted-foreground">Designer: {meta.designer}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={
                              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold " + STATUS_TONE[d.status]
                            }
                          >
                            {STATUS_LABEL[d.status]}
                          </span>
                          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow"
                              style={{ width: `${meta.progress}%` }}
                            />
                          </div>
                          <span className="w-9 shrink-0 text-right text-[11px] font-bold text-muted-foreground">
                            {meta.progress}%
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* + New Design — floating on mobile (sized down so it doesn't sit
            over the sample cards), inline at the end of the column on
            desktop exactly as before. Opens the existing Create Design
            wizard in place; it never navigates away from the Dashboard. */}
        <button
          type="button"
          onClick={() => setWizard(true)}
          className="fixed bottom-20 right-5 z-30 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/30 hover:opacity-90 lg:static lg:w-fit lg:self-end lg:gap-2 lg:px-5 lg:py-3 lg:text-sm"
        >
          <Plus className="h-3.5 w-3.5 lg:h-4 lg:w-4" /> New Design
        </button>
      </div>

      <DesignWizard open={wizard} onClose={() => setWizard(false)} />
    </AppShell>
  );
}
