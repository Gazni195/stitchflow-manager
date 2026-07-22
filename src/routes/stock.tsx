import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Warehouse, PackageCheck, Info } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DesignImage } from "@/components/DesignImage";
import { useReadyStock, type StockRecord } from "@/lib/api/stock";

export const Route = createFileRoute("/stock")({ component: ReadyStockPage });

function ReadyStockPage() {
  const [query, setQuery] = useState("");
  const { data, isLoading } = useReadyStock();

  const items = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.designCode.toLowerCase().includes(q) ||
        r.designName.toLowerCase().includes(q) ||
        r.customer.toLowerCase().includes(q),
    );
  }, [data, query]);

  const totalFinished = (data ?? []).reduce((s, r) => s + r.finishedQuantity, 0);

  return (
    <AppShell title="Ready Stock" subtitle="Finished goods from completed production">
      <div className="grid gap-5">
        <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary via-primary to-primary-glow p-5 text-primary-foreground shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                Ready Stock
              </p>
              <p className="mt-1 text-2xl font-extrabold">{totalFinished} pcs</p>
              <p className="text-xs opacity-80">
                {(data ?? []).length} completed production order{(data ?? []).length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <Warehouse className="h-7 w-7" />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by PO, design code, name, or customer"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="mt-4 grid gap-3">
            {isLoading ? (
              <EmptyState icon={<PackageCheck className="h-6 w-6" />} title="Loading stock…" />
            ) : items.length === 0 ? (
              <EmptyState
                icon={<PackageCheck className="h-6 w-6" />}
                title="No stock records available."
                subtitle={
                  (data ?? []).length === 0
                    ? "Stock appears here once a production order is marked complete."
                    : "No records match your search."
                }
              />
            ) : (
              items.map((r) => <StockCard key={r.productionOrderId} record={r} />)
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">Coming soon</p>
              <p className="mt-1">
                Warehouse allocation, dispatch tracking, and ERPNext sync require
                warehouse and stock-movement tables that aren't part of the workflow
                yet. Only real completed production is shown here.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function StockCard({ record }: { record: StockRecord }) {
  const completed = record.completedAt
    ? new Date(record.completedAt).toLocaleDateString()
    : "—";
  return (
    <article className="flex gap-3 rounded-2xl border border-border bg-background p-3">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
        <DesignImage path={record.imagePath} alt={record.designName} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold text-foreground">
            {record.designCode || record.code}
          </p>
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">
            Ready
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{record.designName}</p>
        <p className="truncate text-xs text-muted-foreground">{record.customer}</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
          <Stat label="PO" value={record.code} />
          <Stat label="Finished" value={`${record.finishedQuantity}`} />
          <Stat label="Completed" value={completed} />
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-1">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-xs font-bold text-foreground">{value}</p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}
