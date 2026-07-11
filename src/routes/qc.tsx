import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search, ShieldCheck, User, Calendar, Save, CheckCircle2, Plus, Trash2, AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  SectionHeader, MiniStat, Field, SelectField, NumField, ReadStat, BigStat,
  OrderPicker, SAMPLE_ORDERS,
} from "@/components/production/ui";
import { useStageChrome, NextStepButton, StageTimelineCard } from "@/components/production/stage-chrome";
import { getOrderParts, getPartFabric } from "@/lib/production-parts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/qc")({ component: QualityCheckPage });

const INSPECTORS = ["Anita Sharma", "Vikram Rao", "Neha Iyer", "Rakesh Gupta"];

const REASONS = ["Stitch Issue", "Measurement Issue", "Fabric Defect", "Hand Work Defect", "Other"] as const;
const DECISIONS = ["Pass", "Rework", "Reject"] as const;

type QCRow = {
  id: string;
  part: string;
  checked: number;
  passed: number;
  rejected: number;
  reason: (typeof REASONS)[number];
  decision: (typeof DECISIONS)[number];
};

const INITIAL: QCRow[] = [
  { id: "r1", part: "Front Body", checked: 60, passed: 55, rejected: 2, reason: "Stitch Issue", decision: "Pass" },
  { id: "r2", part: "Sleeve", checked: 60, passed: 52, rejected: 4, reason: "Measurement Issue", decision: "Rework" },
  { id: "r3", part: "Dupatta", checked: 40, passed: 38, rejected: 1, reason: "Fabric Defect", decision: "Pass" },
];

function QualityCheckPage() {
  const [query, setQuery] = useState("MG001");
  const [selectedCode, setSelectedCode] = useState("MG001");
  const [inspector, setInspector] = useState(INSPECTORS[0]);
  const [date, setDate] = useState("2026-07-11");
  const [rows, setRows] = useState<QCRow[]>(INITIAL);

  const order = SAMPLE_ORDERS.find((o) => o.code === selectedCode) ?? SAMPLE_ORDERS[0];
  const totalChecked = rows.reduce((s, r) => s + r.checked, 0);
  const totalPassed = rows.reduce((s, r) => s + r.passed, 0);
  const totalRejected = rows.reduce((s, r) => s + r.rejected, 0);
  const rework = rows.filter((r) => r.decision === "Rework").reduce((s, r) => s + (r.checked - r.passed - r.rejected), 0);
  const passPct = totalChecked ? Math.round((totalPassed / totalChecked) * 100) : 0;
  const rejPct = totalChecked ? Math.round((totalRejected / totalChecked) * 100) : 0;

  const update = (id: string, patch: Partial<QCRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));
  const add = () =>
    setRows((rs) => [
      ...rs,
      { id: `r${Date.now()}`, part: PARTS[0], checked: 0, passed: 0, rejected: 0, reason: "Stitch Issue", decision: "Pass" },
    ]);
  const chrome = useStageChrome(selectedCode, "qc");

  return (
    <AppShell title="Quality Check" subtitle={chrome.subtitle}>
      <div className="grid gap-5">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<Search className="h-4 w-4" />} title="Production Order" hint="Search by design code" />
          <OrderPicker orders={SAMPLE_ORDERS} selectedCode={selectedCode} onSelect={setSelectedCode} query={query} onQuery={setQuery} />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="Customer" value={order.customer} />
            <MiniStat label="Design" value={order.code} tone="primary" />
            <MiniStat label="Order Qty" value={String(order.quantity)} />
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<ShieldCheck className="h-4 w-4" />} title="Inspection Info" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SelectField icon={<User className="h-4 w-4" />} label="QC Inspector" value={inspector} options={INSPECTORS} onChange={setInspector} />
            <Field icon={<Calendar className="h-4 w-4" />} label="Inspection Date" type="date" value={date} onChange={setDate} />
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<ShieldCheck className="h-4 w-4" />} title="Part Inspection" hint={`${rows.length} entries`} />
          <div className="mt-3 grid gap-3">
            {rows.map((r) => {
              const pending = Math.max(0, r.checked - r.passed - r.rejected);
              return (
                <div key={r.id} className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-center gap-2">
                    <select value={r.part} onChange={(e) => update(r.id, { part: e.target.value })}
                      className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold outline-none focus:border-primary">
                      {PARTS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button onClick={() => remove(r.id)} className="grid h-9 w-9 place-items-center rounded-xl border border-border text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <NumField label="Checked" value={r.checked} onChange={(v) => update(r.id, { checked: v })} tone="primary" />
                    <NumField label="Passed" value={r.passed} onChange={(v) => update(r.id, { passed: v })} tone="success" />
                    <NumField label="Rejected" value={r.rejected} onChange={(v) => update(r.id, { rejected: v })} tone="danger" />
                    <ReadStat label="Pending" value={pending} tone="warning" />
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <AlertTriangle className="h-4 w-4" /> Reject Reason
                      </span>
                      <select value={r.reason} onChange={(e) => update(r.id, { reason: e.target.value as QCRow["reason"] })}
                        className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold outline-none focus:border-primary">
                        {REASONS.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </label>
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Decision</p>
                      <div className="flex gap-2">
                        {DECISIONS.map((d) => {
                          const active = r.decision === d;
                          const tone = d === "Pass" ? "success" : d === "Rework" ? "warning" : "danger";
                          return (
                            <button key={d} onClick={() => update(r.id, { decision: d })}
                              className={cn(
                                "flex-1 rounded-xl border px-3 py-2.5 text-sm font-bold transition",
                                active && tone === "success" && "border-success bg-success text-white",
                                active && tone === "warning" && "border-warning bg-warning text-warning-foreground",
                                active && tone === "danger" && "border-destructive bg-destructive text-white",
                                !active && "border-border bg-card text-foreground hover:border-primary/40",
                              )}>
                              {d}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <button onClick={add}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary">
              <Plus className="h-4 w-4" /> Add Part
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary via-primary to-primary-glow p-5 text-primary-foreground shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">QC Summary</p>
              <p className="mt-1 text-2xl font-extrabold">{passPct}% Pass Rate</p>
              <p className="text-xs opacity-80">{totalChecked} pieces inspected</p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <ShieldCheck className="h-7 w-7" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            <BigStat label="Checked" value={totalChecked} />
            <BigStat label="Passed" value={totalPassed} />
            <BigStat label="Rejected" value={totalRejected} />
            <BigStat label="Rework" value={rework} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <BigStat label="Pass %" value={`${passPct}%`} />
            <BigStat label="Reject %" value={`${rejPct}%`} />
          </div>
        </section>

        <section className="grid gap-2 sm:grid-cols-3">
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-bold text-foreground shadow-sm hover:bg-accent">
            <Save className="h-4 w-4" /> Save
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-success px-4 py-3.5 text-sm font-bold text-white shadow-sm hover:opacity-90">
            <CheckCircle2 className="h-4 w-4" /> Complete QC
          </button>
          <NextStepButton next={chrome.next} />
        </section>

        <StageTimelineCard chrome={chrome} currentIcon={ShieldCheck} />

      </div>
    </AppShell>
  );
}
