import { createFileRoute, Link } from "@tanstack/react-router";
import { Filter, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DESIGNS, STATUS_TONE, type Design } from "@/lib/designs";

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
  return (
    <AppShell
      title="Designs"
      subtitle={`${DESIGNS.length} styles across all customers`}
      action={
        <button className="hidden items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 sm:inline-flex">
          <Plus className="h-4 w-4" /> New Design
        </button>
      }
    >
      <div className="grid gap-5">
        {/* Toolbar */}
        <section className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by code, name or customer…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium">
            <Filter className="h-4 w-4" /> Filter
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm sm:hidden">
            <Plus className="h-4 w-4" /> New
          </button>
        </section>

        {/* Grid */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {DESIGNS.map((d) => (
            <DesignCard key={d.code} design={d} />
          ))}
        </section>
      </div>
    </AppShell>
  );
}

function DesignCard({ design }: { design: Design }) {
  return (
    <Link
      to="/designs/$code"
      params={{ code: design.code }}
      className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-primary-soft">
        <img
          src={design.image}
          alt={design.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 rounded-lg bg-background/90 px-2 py-1 text-[11px] font-bold tracking-wider text-foreground backdrop-blur">
          {design.code}
        </div>
        <div
          className={
            "absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur " +
            STATUS_TONE[design.status]
          }
        >
          {design.status}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="truncate text-base font-bold">{design.name}</p>
          <p className="truncate text-xs text-muted-foreground">{design.customer}</p>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Order Qty
            </p>
            <p className="text-lg font-extrabold tracking-tight">
              {design.quantity.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Progress
            </p>
            <p className="text-lg font-extrabold tracking-tight text-primary">
              {design.progress}%
            </p>
          </div>
        </div>

        <ProgressBar value={design.progress} />
      </div>
    </Link>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
