import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search, Package, Users, Save, CheckCircle2, FileText, Box, ShoppingBag, Gift, Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  SectionHeader, MiniStat, SelectField, NumField, ReadStat, BigStat,
  OrderPicker, SAMPLE_ORDERS,
} from "@/components/production/ui";
import { useStageChrome, NextStepButton, StageTimelineCard } from "@/components/production/stage-chrome";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/packing")({ component: PackagingPage });

const TEAMS = ["Pack Team A", "Pack Team B", "Pack Team C"];
const PKG_TYPES = [
  { key: "poly", label: "Poly Bag", icon: ShoppingBag },
  { key: "box", label: "Box", icon: Box },
  { key: "premium", label: "Premium Box", icon: Gift },
  { key: "custom", label: "Custom", icon: Sparkles },
] as const;

function PackagingPage() {
  const [query, setQuery] = useState("MG001");
  const [selectedCode, setSelectedCode] = useState("MG001");
  const [team, setTeam] = useState(TEAMS[0]);
  const [pkgType, setPkgType] = useState<string>("box");
  const [customType, setCustomType] = useState("");
  const [packed, setPacked] = useState(180);
  const [remarks, setRemarks] = useState("Include care card & thank-you note.");

  const order = SAMPLE_ORDERS.find((o) => o.code === selectedCode) ?? SAMPLE_ORDERS[0];
  const remaining = Math.max(0, order.quantity - packed);
  const pct = order.quantity ? Math.min(100, Math.round((packed / order.quantity) * 100)) : 0;

  return (
    <AppShell title="Packaging" subtitle={`Step 10 of ${WORKFLOW.length} · Finishing`}>
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
          <SectionHeader icon={<Package className="h-4 w-4" />} title="Package Type" />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PKG_TYPES.map((p) => {
              const active = pkgType === p.key;
              const Icon = p.icon;
              return (
                <button key={p.key} onClick={() => setPkgType(p.key)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border p-4 transition",
                    active ? "border-primary bg-primary-soft" : "border-border bg-background hover:border-primary/40",
                  )}>
                  <div className={cn(
                    "grid h-10 w-10 place-items-center rounded-xl",
                    active ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary",
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-bold">{p.label}</span>
                </button>
              );
            })}
          </div>
          {pkgType === "custom" && (
            <input value={customType} onChange={(e) => setCustomType(e.target.value)}
              placeholder="Describe custom packaging"
              className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary" />
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<Users className="h-4 w-4" />} title="Team & Quantity" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SelectField icon={<Users className="h-4 w-4" />} label="Packaging Team" value={team} options={TEAMS} onChange={setTeam} />
            <NumField label="Packed Quantity" value={packed} onChange={setPacked} tone="primary" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <ReadStat label="Total Packed" value={packed} tone="success" />
            <ReadStat label="Remaining" value={remaining} tone="warning" />
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Progress</p>
              <p className="text-xs font-bold text-primary">{pct}%</p>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<FileText className="h-4 w-4" />} title="Remarks" />
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3}
            className="mt-3 w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" />
        </section>

        <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary via-primary to-primary-glow p-5 text-primary-foreground shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Packaging Summary</p>
              <p className="mt-1 text-2xl font-extrabold">{pct}% Packed</p>
              <p className="text-xs opacity-80">
                {PKG_TYPES.find((p) => p.key === pkgType)?.label} · {team}
              </p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <Package className="h-7 w-7" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <BigStat label="Order" value={order.quantity} />
            <BigStat label="Packed" value={packed} />
            <BigStat label="Remaining" value={remaining} />
          </div>
        </section>

        <section className="grid gap-2 sm:grid-cols-3">
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-bold text-foreground shadow-sm hover:bg-accent">
            <Save className="h-4 w-4" /> Save
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-success px-4 py-3.5 text-sm font-bold text-white shadow-sm hover:opacity-90">
            <CheckCircle2 className="h-4 w-4" /> Complete Packaging
          </button>
          <Link to="/barcode" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90">
            Continue to Barcode <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<CheckCircle2 className="h-4 w-4" />} title="Production Timeline" />
          <ProductionTimeline steps={buildTimeline("Packaging")} currentIcon={Package} />
        </section>
      </div>
    </AppShell>
  );
}
