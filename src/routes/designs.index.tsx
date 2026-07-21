import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Filter, Plus, Search, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/hooks/use-auth";
import { STATUS_TONE, STATUS_LABEL, type Design } from "@/lib/designs";
import { useDesigns } from "@/lib/api/designs";
import { useWorkflows } from "@/lib/api/workflows";
import { DesignWizard } from "@/components/DesignWizard";
import { DesignImage } from "@/components/DesignImage";

export const Route = createFileRoute("/designs/")({
  head: () => ({
    meta: [
      { title: "Designs — Fawri Lifestyle" },
      { name: "description", content: "Browse all garment designs in production." },
    ],
  }),
  component: DesignsList,
});

function DesignsList() {
  useRequireAuth();
  const [query, setQuery] = useState("");
  const [wizard, setWizard] = useState(false);
  const { data: designs = [], isLoading } = useDesigns();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return designs;
    return designs.filter(
      (d) =>
        d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q) || d.customer.toLowerCase().includes(q),
    );
  }, [designs, query]);

  return (
    <AppShell
      title="Designs"
      subtitle={`${designs.length} ${designs.length === 1 ? "style" : "styles"}`}
      action={
        <button
          onClick={() => setWizard(true)}
          className="hidden items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 sm:inline-flex"
        >
          <Plus className="h-4 w-4" /> New Design
        </button>
      }
    >
      <div className="grid gap-5">
        <section className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by code, name or customer…"
              className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium">
            <Filter className="h-4 w-4" /> Filter
          </button>
        </section>

        {isLoading ? (
          <div className="grid place-items-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-lg font-bold">No designs yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first design to start a production workflow.
            </p>
            <button
              onClick={() => setWizard(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Create Design
            </button>
          </div>
        ) : (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((d) => (
              <DesignCard key={d.id} design={d} />
            ))}
          </section>
        )}
      </div>

      {/* Mobile-only floating action button, replacing the old inline
          toolbar "New" button — matches the Dashboard's floating button
          style. Desktop keeps the existing top-bar "New Design" action
          (the `action` prop above) unchanged. */}
      <button
        type="button"
        onClick={() => setWizard(true)}
        className="fixed bottom-20 right-5 z-30 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/30 hover:opacity-90 sm:hidden"
      >
        <Plus className="h-3.5 w-3.5" /> New Design
      </button>

      <DesignWizard open={wizard} onClose={() => setWizard(false)} />
    </AppShell>
  );
}

function DesignCard({ design }: { design: Design }) {
  const { data: wfs } = useWorkflows(design.id);
  const bulk = wfs?.find((w) => w.kind === "bulk");
  const sample = wfs?.find((w) => w.kind === "sample");
  const active = bulk ?? sample;
  const total = active?.steps.length ?? 0;
  const done = active?.steps.filter((s) => s.status === "completed").length ?? 0;
  const progress = total ? Math.round((done / total) * 100) : 0;

  return (
    <Link
      to="/designs/$code"
      params={{ code: design.code }}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition hover:border-primary/40 hover:shadow-md"
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-primary-soft">
        <DesignImage path={design.imagePath} alt={design.name} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[11px] font-bold tracking-wider text-muted-foreground">{design.code}</p>
          <span className={"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold " + STATUS_TONE[design.status]}>
            {STATUS_LABEL[design.status]}
          </span>
        </div>
        <p className="truncate text-sm font-bold">{design.name}</p>
        <p className="truncate text-xs text-muted-foreground">{design.customer}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
            Qty {design.orderQuantity.toLocaleString()}
          </span>
          <div
            className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-9 shrink-0 text-right text-[11px] font-bold text-muted-foreground">{progress}%</span>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
