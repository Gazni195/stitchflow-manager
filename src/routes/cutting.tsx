import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Search,
  Scissors,
  Barcode,
  Calendar,
  User,
  Wrench,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Check,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useStageChrome, NextStepButton, StageTimelineCard } from "@/components/production/stage-chrome";
import { cn } from "@/lib/utils";
import { getOrderParts } from "@/lib/production-parts";

export const Route = createFileRoute("/cutting")({ component: BulkCuttingPage });

type Order = {
  code: string;
  customer: string;
  quantity: number;
  status: string;
};

const ORDERS: Order[] = [
  { code: "MG001", customer: "Aanya Couture", quantity: 240, status: "Sample Approved" },
  { code: "MG002", customer: "House of Meher", quantity: 500, status: "Sample Approved" },
  { code: "MG003", customer: "Riya Boutique", quantity: 120, status: "Ready for Cutting" },
  { code: "MG004", customer: "Studio Verve", quantity: 90, status: "Sample Approved" },
];

type Part = {
  id: string;
  name: string;
  fabric: string;
  planned: number;
  cut: number;
  remarks: string;
};

function buildInitialParts(code: string, orderQty: number): Part[] {
  return getOrderParts(code).map((p, i) => ({
    id: `p-${code}-${i}`,
    name: p.name,
    fabric: p.fabric,
    planned: orderQty,
    cut: 0,
    remarks: "",
  }));
}


const TIMELINE = [
  "Sample Approved",
  "Bulk Cutting",
  "Bulk Hand Work",
  "Bulk Stitching",
  "QC",
  "Packing",
  "Barcode",
  "Ready Stock",
];

function BulkCuttingPage() {
  const [query, setQuery] = useState("MG001");
  const [selectedCode, setSelectedCode] = useState("MG001");
  const [fabricBarcode, setFabricBarcode] = useState("FB-2411-A");
  const [cuttingDate, setCuttingDate] = useState("2026-07-11");
  const [master, setMaster] = useState("Ramesh K.");
  const [machine, setMachine] = useState("Auto-Cut #3");
  const [parts, setParts] = useState<Part[]>(INITIAL_PARTS);
  const [showAdd, setShowAdd] = useState(false);
  const [customPart, setCustomPart] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ORDERS;
    return ORDERS.filter(
      (o) => o.code.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q),
    );
  }, [query]);

  const order = ORDERS.find((o) => o.code === selectedCode) ?? ORDERS[0];

  const totals = parts.reduce(
    (a, p) => {
      a.planned += p.planned;
      a.cut += p.cut;
      return a;
    },
    { planned: 0, cut: 0 },
  );
  const balance = Math.max(0, totals.planned - totals.cut);
  const pct = totals.planned ? Math.round((totals.cut / totals.planned) * 100) : 0;

  function updatePart(id: string, patch: Partial<Part>) {
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function removePart(id: string) {
    setParts((prev) => prev.filter((p) => p.id !== id));
  }
  function addPart(name: string) {
    if (!name.trim()) return;
    setParts((prev) => [
      ...prev,
      { id: `p${Date.now()}`, name: name.trim(), planned: 0, cut: 0, remarks: "" },
    ]);
    setShowAdd(false);
    setCustomPart("");
  }

  const chrome = useStageChrome(selectedCode, "cutting");

  return (
    <AppShell
      title="Bulk Cutting"
      subtitle={chrome.subtitle}
    >
      <div className="grid gap-5">
        {/* 1. Select Production Order */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader
            icon={<Search className="h-4 w-4" />}
            title="Select Production Order"
            hint="Search by design code or customer"
          />
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. MG001"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="mt-3 grid gap-2">
            {results.slice(0, 3).map((o) => {
              const active = o.code === selectedCode;
              return (
                <button
                  key={o.code}
                  onClick={() => setSelectedCode(o.code)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3 text-left transition",
                    active
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-background hover:border-primary/40",
                  )}
                >
                  <div
                    className={cn(
                      "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-black",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary-soft text-primary",
                    )}
                  >
                    {o.code.slice(-2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold">{o.code}</p>
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                        {o.status}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {o.customer} · Qty {o.quantity}
                    </p>
                  </div>
                  {active && <Check className="h-5 w-5 shrink-0 text-primary" />}
                </button>
              );
            })}
            {results.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No orders found
              </p>
            )}
          </div>

          {/* Selected order summary */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="Customer" value={order.customer} />
            <MiniStat label="Order Qty" value={String(order.quantity)} />
            <MiniStat label="Status" value={order.status} tone="success" />
          </div>
        </section>

        {/* 2. Cutting Details */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader
            icon={<Scissors className="h-4 w-4" />}
            title="Cutting Details"
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field icon={<Scissors className="h-4 w-4" />} label="Fabric Type" value={order.fabric} readOnly />
            <Field
              icon={<Barcode className="h-4 w-4" />}
              label="Fabric Barcode"
              value={fabricBarcode}
              onChange={setFabricBarcode}
            />
            <Field
              icon={<Calendar className="h-4 w-4" />}
              label="Cutting Date"
              type="date"
              value={cuttingDate}
              onChange={setCuttingDate}
            />
            <Field
              icon={<User className="h-4 w-4" />}
              label="Cutting Master"
              value={master}
              onChange={setMaster}
            />
            <div className="sm:col-span-2">
              <Field
                icon={<Wrench className="h-4 w-4" />}
                label="Machine (Optional)"
                value={machine}
                onChange={setMachine}
              />
            </div>
          </div>
        </section>

        {/* 3 & 4. Cutting Parts */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <SectionHeader
              icon={<Scissors className="h-4 w-4" />}
              title="Cutting Parts"
              hint={`${parts.length} parts`}
            />
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Add Part
            </button>
          </div>

          {showAdd && (
            <div className="mt-3 rounded-2xl border border-primary/30 bg-primary-soft/60 p-3">
              <p className="text-xs font-semibold text-accent-foreground">Choose a part</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PART_PRESETS.map((name) => (
                  <button
                    key={name}
                    onClick={() => addPart(name)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary"
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={customPart}
                  onChange={(e) => setCustomPart(e.target.value)}
                  placeholder="Custom part name"
                  className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={() => addPart(customPart)}
                  className="rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-3">
            {parts.map((p) => {
              const bal = Math.max(0, p.planned - p.cut);
              const pp = p.planned ? Math.min(100, Math.round((p.cut / p.planned) * 100)) : 0;
              return (
                <div key={p.id} className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
                        <Scissors className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {pp}% complete · Balance {bal}
                        </p>
                      </div>
                    </div>
                    <button
                      aria-label="Remove"
                      onClick={() => removePart(p.id)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow"
                      style={{ width: `${pp}%` }}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <NumField
                      label="Planned"
                      value={p.planned}
                      onChange={(v) => updatePart(p.id, { planned: v })}
                    />
                    <NumField
                      label="Cut"
                      value={p.cut}
                      onChange={(v) => updatePart(p.id, { cut: v })}
                    />
                    <div className="rounded-xl border border-border bg-card px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Balance
                      </p>
                      <p className="mt-0.5 text-base font-extrabold text-primary">{bal}</p>
                    </div>
                  </div>

                  <div className="mt-2">
                    <input
                      value={p.remarks}
                      onChange={(e) => updatePart(p.id, { remarks: e.target.value })}
                      placeholder="Remarks"
                      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>
              );
            })}
            {parts.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No parts added yet
              </p>
            )}
          </div>
        </section>

        {/* 5. Summary */}
        <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary via-primary to-primary-glow p-5 text-primary-foreground shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                Cutting Summary
              </p>
              <p className="mt-1 text-2xl font-extrabold">{pct}% Complete</p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <Scissors className="h-7 w-7" />
            </div>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <BigStat label="Planned" value={totals.planned} />
            <BigStat label="Cut" value={totals.cut} />
            <BigStat label="Balance" value={balance} />
          </div>
        </section>

        {/* 6. Buttons */}
        <section className="grid gap-2 sm:grid-cols-3">
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-bold text-foreground shadow-sm hover:bg-accent">
            <Save className="h-4 w-4" /> Save Draft
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-success px-4 py-3.5 text-sm font-bold text-white shadow-sm hover:opacity-90">
            <CheckCircle2 className="h-4 w-4" /> Complete Cutting
          </button>
          <NextStepButton next={chrome.next} />
        </section>

        {/* 7. Timeline (from design's configured workflow) */}
        <StageTimelineCard chrome={chrome} currentIcon={Scissors} />
      </div>
    </AppShell>
  );
}

function BigStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-0.5 text-xl font-extrabold">{value}</p>
    </div>
  );
}


function SectionHeader({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
          {icon}
        </div>
        <h3 className="text-sm font-bold sm:text-base">{title}</h3>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate text-sm font-bold",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  readOnly,
  type = "text",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold outline-none transition focus:border-primary",
          readOnly && "bg-muted/40 text-muted-foreground",
        )}
      />
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block rounded-xl border border-border bg-card px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="mt-0.5 w-full bg-transparent text-base font-extrabold text-foreground outline-none"
      />
    </label>
  );
}
