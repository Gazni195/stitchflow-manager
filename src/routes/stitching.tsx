import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search, Shirt, Users, Cog, Calendar, Save, CheckCircle2, FileText,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  SectionHeader, MiniStat, Field, SelectField, NumField, ReadStat, BigStat,
  OrderPicker, SAMPLE_ORDERS,
} from "@/components/production/ui";
import { useStageChrome, NextStepButton, StageTimelineCard } from "@/components/production/stage-chrome";
import { getOrderParts, getPartFabric } from "@/lib/production-parts";

export const Route = createFileRoute("/stitching")({ component: BulkStitchingPage });


const LINES = ["Line A", "Line B", "Line C", "Line D"];
const TAILORS = ["Team A · Ramesh", "Team B · Salim", "Team C · Anil", "Team D · Farid"];
const MACHINES = ["Juki DDL-8700", "Brother S-7220C", "Singer 4432", "Overlock JUKI MO-6714"];

function BulkStitchingPage() {
  const [query, setQuery] = useState("MG001");
  const [selectedCode, setSelectedCode] = useState("MG001");
  const [part, setPart] = useState<string>("Front Body");
  const [customPart, setCustomPart] = useState("");
  const [line, setLine] = useState(LINES[0]);
  const [tailor, setTailor] = useState(TAILORS[0]);
  const [machine, setMachine] = useState(MACHINES[0]);
  const [date, setDate] = useState("2026-07-11");
  const [received, setReceived] = useState(240);
  const [stitched, setStitched] = useState(148);
  const [rework, setRework] = useState(6);
  const [notes, setNotes] = useState("Double-check seam allowance on side panels.");

  const pending = Math.max(0, received - stitched - rework);
  const balance = Math.max(0, received - stitched);
  const pct = received ? Math.min(100, Math.round((stitched / received) * 100)) : 0;
  const order = SAMPLE_ORDERS.find((o) => o.code === selectedCode) ?? SAMPLE_ORDERS[0];
  const orderParts = getOrderParts(selectedCode);
  const partFabric = part === "Custom" ? "—" : getPartFabric(selectedCode, part);
  const chrome = useStageChrome(selectedCode, "stitching");


  return (
    <AppShell title="Bulk Stitching" subtitle={chrome.subtitle}>
      <div className="grid gap-5">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<Search className="h-4 w-4" />} title="Select Production Order" hint="Search by design code" />
          <OrderPicker orders={SAMPLE_ORDERS} selectedCode={selectedCode} onSelect={setSelectedCode} query={query} onQuery={setQuery} />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="Customer" value={order.customer} />
            <MiniStat label="Order Qty" value={String(order.quantity)} />
            <MiniStat label="Progress" value={`${order.progress}%`} tone="primary" />
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<Shirt className="h-4 w-4" />} title="Select Part" hint={`Fabric: ${partFabric}`} />
          <div className="mt-3 flex flex-wrap gap-2">
            {orderParts.map((p) => {
              const active = part === p.name;
              return (
                <button
                  key={p.name}
                  onClick={() => setPart(p.name)}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    active ? "border-primary bg-primary text-primary-foreground shadow-sm"
                           : "border-border bg-background text-foreground hover:border-primary/40"
                  }`}
                >
                  <span>{p.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? "bg-white/20 text-primary-foreground" : "bg-primary-soft text-primary"}`}>
                    {p.fabric}
                  </span>
                </button>
              );
            })}
            <button
              onClick={() => setPart("Custom")}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                part === "Custom" ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                   : "border-border bg-background text-foreground hover:border-primary/40"
              }`}
            >
              Custom
            </button>
          </div>
          {part === "Custom" && (
            <input value={customPart} onChange={(e) => setCustomPart(e.target.value)}
              placeholder="Enter custom part name"
              className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary" />
          )}
        </section>


        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<Cog className="h-4 w-4" />} title="Stitching Details" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SelectField icon={<Cog className="h-4 w-4" />} label="Stitching Line" value={line} options={LINES} onChange={setLine} />
            <SelectField icon={<Users className="h-4 w-4" />} label="Tailor / Team" value={tailor} options={TAILORS} onChange={setTailor} />
            <SelectField icon={<Cog className="h-4 w-4" />} label="Machine" value={machine} options={MACHINES} onChange={setMachine} />
            <Field icon={<Calendar className="h-4 w-4" />} label="Date" type="date" value={date} onChange={setDate} />
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<Shirt className="h-4 w-4" />} title="Quantity Tracking" />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <NumField label="Received" value={received} onChange={setReceived} tone="primary" />
            <NumField label="Stitched" value={stitched} onChange={setStitched} tone="success" />
            <NumField label="Rework" value={rework} onChange={setRework} tone="warning" />
            <ReadStat label="Pending" value={pending} tone="warning" />
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Completion</p>
              <p className="text-xs font-bold text-primary">{pct}%</p>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all" style={{ width: `${pct}%` }} />
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
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Stitching Summary</p>
              <p className="mt-1 text-2xl font-extrabold">{pct}% Complete</p>
              <p className="text-xs opacity-80">{part} · {partFabric} · {line}</p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <Shirt className="h-7 w-7" />
            </div>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            <BigStat label="Received" value={received} />
            <BigStat label="Completed" value={stitched} />
            <BigStat label="Balance" value={balance} />
            <BigStat label="Progress" value={`${pct}%`} />
          </div>
        </section>

        <section className="grid gap-2 sm:grid-cols-3">
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-bold text-foreground shadow-sm hover:bg-accent">
            <Save className="h-4 w-4" /> Save Draft
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-success px-4 py-3.5 text-sm font-bold text-white shadow-sm hover:opacity-90">
            <CheckCircle2 className="h-4 w-4" /> Complete Stitching
          </button>
          <NextStepButton next={chrome.next} />
        </section>

        <StageTimelineCard chrome={chrome} currentIcon={Shirt} />

      </div>
    </AppShell>
  );
}
