import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search, Warehouse, Calendar, Save, CheckCircle2, RefreshCw, FileText, MapPin,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  SectionHeader, MiniStat, Field, SelectField, NumField, BigStat,
  OrderPicker, SAMPLE_ORDERS,
} from "@/components/production/ui";
import { useStageChrome, StageTimelineCard } from "@/components/production/stage-chrome";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/stock")({ component: ReadyStockPage });

const WAREHOUSES = ["Mumbai · WH-01", "Delhi · WH-02", "Bengaluru · WH-03", "Surat · WH-04"];
const STATUSES = ["In Warehouse", "Ready for Dispatch", "Dispatched"] as const;

function ReadyStockPage() {
  const [query, setQuery] = useState("MG001");
  const [selectedCode, setSelectedCode] = useState("MG001");
  const [warehouse, setWarehouse] = useState(WAREHOUSES[0]);
  const [finished, setFinished] = useState(230);
  const [available, setAvailable] = useState(210);
  const [readyDate, setReadyDate] = useState("2026-07-12");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("Ready for Dispatch");
  const [syncing, setSyncing] = useState(false);
  const [notes, setNotes] = useState("Reserved 20 pcs for showroom display.");

  const order = SAMPLE_ORDERS.find((o) => o.code === selectedCode) ?? SAMPLE_ORDERS[0];
  const qcPassed = Math.round(finished * 0.96);
  const packed = Math.round(finished * 0.92);

  const sync = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 1200);
  };

  const chrome = useStageChrome(selectedCode, "ready-stock");

  return (
    <AppShell title="Ready Stock" subtitle={chrome.subtitle}>
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
          <SectionHeader icon={<Warehouse className="h-4 w-4" />} title="Warehouse & Quantities" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SelectField icon={<MapPin className="h-4 w-4" />} label="Warehouse" value={warehouse} options={WAREHOUSES} onChange={setWarehouse} />
            <Field icon={<Calendar className="h-4 w-4" />} label="Ready Date" type="date" value={readyDate} onChange={setReadyDate} />
            <NumField label="Finished Quantity" value={finished} onChange={setFinished} tone="primary" />
            <NumField label="Available Quantity" value={available} onChange={setAvailable} tone="success" />
          </div>

          <div className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => {
                const active = status === s;
                return (
                  <button key={s} onClick={() => setStatus(s)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-semibold transition",
                      active ? "border-primary bg-primary text-primary-foreground shadow-sm"
                             : "border-border bg-background text-foreground hover:border-primary/40",
                    )}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<FileText className="h-4 w-4" />} title="Notes" />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="mt-3 w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" />
        </section>

        <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary via-primary to-primary-glow p-5 text-primary-foreground shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Ready Stock Summary</p>
              <p className="mt-1 text-2xl font-extrabold">{available} Available</p>
              <p className="text-xs opacity-80">{warehouse} · {status}</p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <Warehouse className="h-7 w-7" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <BigStat label="Total Produced" value={finished} />
            <BigStat label="QC Passed" value={qcPassed} />
            <BigStat label="Packed" value={packed} />
            <BigStat label="Ready Stock" value={available} />
          </div>
        </section>

        <section className="grid gap-2 sm:grid-cols-3">
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-bold text-foreground shadow-sm hover:bg-accent">
            <Save className="h-4 w-4" /> Save
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-success px-4 py-3.5 text-sm font-bold text-white shadow-sm hover:opacity-90">
            <CheckCircle2 className="h-4 w-4" /> Complete Production
          </button>
          <button onClick={sync} disabled={syncing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-60">
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Sync with ERPNext"}
          </button>
        </section>

        <p className="-mt-2 text-center text-[11px] text-muted-foreground">
          ERPNext sync is a placeholder — API integration coming soon.
        </p>

        <StageTimelineCard chrome={chrome} currentIcon={Warehouse} />

      </div>
    </AppShell>
  );
}
