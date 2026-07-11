import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Search, QrCode, Printer, RefreshCw, CheckCircle2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  SectionHeader, MiniStat, NumField, OrderPicker, SAMPLE_ORDERS,
} from "@/components/production/ui";
import { useStageChrome, NextStepButton, StageTimelineCard } from "@/components/production/stage-chrome";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/barcode")({ component: BarcodePage });

type Status = "Pending" | "Generated" | "Printed";

function BarcodePage() {
  const [query, setQuery] = useState("MG001");
  const [selectedCode, setSelectedCode] = useState("MG001");
  const [labels, setLabels] = useState(180);
  const [status, setStatus] = useState<Status>("Generated");
  const [seed, setSeed] = useState(1);

  const order = SAMPLE_ORDERS.find((o) => o.code === selectedCode) ?? SAMPLE_ORDERS[0];
  const sampleCode = `${order.code}-${String(seed).padStart(4, "0")}`;

  const bars = useMemo(() => {
    let h = 0;
    for (let i = 0; i < sampleCode.length; i++) h = (h * 31 + sampleCode.charCodeAt(i)) >>> 0;
    return Array.from({ length: 48 }, (_, i) => {
      h = (h * 1103515245 + 12345) >>> 0;
      const w = (h % 3) + 1;
      const dark = h % 5 !== 0;
      return { w, dark, k: i };
    });
  }, [sampleCode]);

  return (
    <AppShell title="Barcode" subtitle={`Step 11 of ${WORKFLOW.length} · Finishing`}>
      <div className="grid gap-5">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<Search className="h-4 w-4" />} title="Production Order" />
          <OrderPicker orders={SAMPLE_ORDERS} selectedCode={selectedCode} onSelect={setSelectedCode} query={query} onQuery={setQuery} />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="Customer" value={order.customer} />
            <MiniStat label="Design" value={order.code} tone="primary" />
            <MiniStat label="Order Qty" value={String(order.quantity)} />
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<QrCode className="h-4 w-4" />} title="Barcode Setup" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <NumField label="Number of Labels" value={labels} onChange={setLabels} tone="primary" />
            <div className="rounded-2xl border border-border bg-background p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Barcode Status</p>
              <span className={cn(
                "mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
                status === "Pending" && "bg-warning/20 text-warning-foreground",
                status === "Generated" && "bg-primary-soft text-primary",
                status === "Printed" && "bg-success/15 text-success",
              )}>
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  status === "Pending" && "bg-warning",
                  status === "Generated" && "bg-primary",
                  status === "Printed" && "bg-success",
                )} />
                {status}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<QrCode className="h-4 w-4" />} title="Barcode Preview" hint="Sample label" />
          <div className="mt-4 grid place-items-center rounded-2xl border-2 border-dashed border-border bg-background p-6">
            <div className="w-full max-w-xs rounded-2xl border border-border bg-white p-5 shadow-sm">
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Fawri Lifestyle</p>
                <p className="mt-1 text-sm font-extrabold text-slate-900">{order.customer}</p>
              </div>
              <div className="mt-4 flex h-20 items-end justify-center gap-[2px]">
                {bars.map((b) => (
                  <span key={b.k} className={cn(
                    "h-full",
                    b.dark ? "bg-slate-900" : "bg-white",
                  )} style={{ width: `${b.w}px` }} />
                ))}
              </div>
              <p className="mt-3 text-center font-mono text-sm font-bold tracking-widest text-slate-900">{sampleCode}</p>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-500">
                <span>Design {order.code}</span>
                <span>Qty {order.quantity}</span>
              </div>
            </div>
          </div>
          <button onClick={() => setSeed((s) => s + 1)}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary">
            <RefreshCw className="h-3.5 w-3.5" /> Preview next label
          </button>
        </section>

        <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary via-primary to-primary-glow p-5 text-primary-foreground shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Barcode Batch</p>
              <p className="mt-1 text-2xl font-extrabold">{labels} Labels</p>
              <p className="text-xs opacity-80">Status: {status}</p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <QrCode className="h-7 w-7" />
            </div>
          </div>
        </section>

        <section className="grid gap-2 sm:grid-cols-3">
          <button onClick={() => setStatus("Generated")}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90">
            <QrCode className="h-4 w-4" /> Generate
          </button>
          <button onClick={() => setStatus("Printed")}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-bold text-foreground shadow-sm hover:bg-accent">
            <Printer className="h-4 w-4" /> Print
          </button>
          <Link to="/stock" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-success px-4 py-3.5 text-sm font-bold text-white shadow-sm hover:opacity-90">
            Continue to Ready Stock <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<FileText className="h-4 w-4" />} title="Production Timeline" />
          <ProductionTimeline steps={buildTimeline("Barcode")} currentIcon={QrCode} />
        </section>
      </div>
    </AppShell>
  );
}
