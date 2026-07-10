import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  Coins,
  FileCheck2,
  Layers,
  Plus,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  APPROVAL_TONE,
  SAMPLES,
  SAMPLE_STATUS_TONE,
  sampleTotal,
  selectedMaterialTotal,
  type Approval,
  type Sample,
} from "@/lib/samples";

export const Route = createFileRoute("/sample-development")({
  head: () => ({
    meta: [
      { title: "Sample Development — Fawri Lifestyle" },
      {
        name: "description",
        content:
          "Manage sample status, material selection, costing and approvals in one place.",
      },
    ],
  }),
  component: SampleDevelopmentPage,
});

type TabId = "status" | "materials" | "costing" | "approval";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "status", label: "Sample Status", icon: Sparkles },
  { id: "materials", label: "Material Selection", icon: Layers },
  { id: "costing", label: "Costing", icon: Coins },
  { id: "approval", label: "Approval", icon: FileCheck2 },
];

function SampleDevelopmentPage() {
  const [tab, setTab] = useState<TabId>("status");
  const [activeCode, setActiveCode] = useState<string>(SAMPLES[0]!.code);
  const active = SAMPLES.find((s) => s.code === activeCode) ?? SAMPLES[0]!;

  return (
    <AppShell
      title="Sample Development"
      subtitle="Track samples from request to approval"
      action={
        <button className="hidden items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 sm:inline-flex">
          <Plus className="h-4 w-4" /> New Sample
        </button>
      }
    >
      <div className="grid gap-5">
        {/* Summary strip */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Total Samples" value={SAMPLES.length} />
          <Kpi
            label="In Development"
            value={SAMPLES.filter((s) => s.status === "In Development").length}
          />
          <Kpi
            label="Ready for Review"
            value={SAMPLES.filter((s) => s.status === "Ready for Review").length}
          />
          <Kpi
            label="Approved"
            value={SAMPLES.filter((s) => s.status === "Approved").length}
          />
        </section>

        {/* Sample selector */}
        <section className="rounded-3xl border border-border bg-card p-3 shadow-sm">
          <p className="px-2 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Select a sample
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {SAMPLES.map((s) => {
              const isActive = s.code === active.code;
              return (
                <button
                  key={s.code}
                  onClick={() => setActiveCode(s.code)}
                  className={
                    "flex min-w-[220px] shrink-0 items-center gap-3 rounded-2xl border p-2.5 text-left transition " +
                    (isActive
                      ? "border-primary bg-primary-soft shadow-sm"
                      : "border-border bg-background hover:border-primary/40")
                  }
                >
                  <img
                    src={s.image}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-bold tracking-wider text-muted-foreground">
                      {s.code}
                    </p>
                    <p className="truncate text-sm font-bold">{s.name}</p>
                    <span
                      className={
                        "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                        SAMPLE_STATUS_TONE[s.status]
                      }
                    >
                      {s.status}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Tabs */}
        <section>
          <div className="flex gap-2 overflow-x-auto border-b border-border">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={
                    "inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition " +
                    (isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground")
                  }
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="pt-5">
            {tab === "status" && <StatusPanel sample={active} />}
            {tab === "materials" && <MaterialsPanel sample={active} />}
            {tab === "costing" && <CostingPanel sample={active} />}
            {tab === "approval" && <ApprovalPanel sample={active} />}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-primary">{value}</p>
    </div>
  );
}

/* ---------- Status ---------- */

function StatusPanel({ sample }: { sample: Sample }) {
  const steps: { id: string; label: string; icon: LucideIcon }[] = [
    { id: "Requested", label: "Requested", icon: Sparkles },
    { id: "In Development", label: "In Development", icon: Clock },
    { id: "Ready for Review", label: "Ready for Review", icon: FileCheck2 },
    { id: "Approved", label: "Approved", icon: CheckCircle2 },
  ];
  const currentIdx = steps.findIndex((s) => s.id === sample.status);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_1.2fr]">
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="aspect-[4/3] bg-primary-soft">
          <img src={sample.image} alt={sample.name} className="h-full w-full object-cover" />
        </div>
        <div className="p-4">
          <p className="text-[11px] font-bold tracking-wider text-muted-foreground">
            {sample.code} · {sample.designCode}
          </p>
          <p className="mt-1 text-lg font-extrabold">{sample.name}</p>
          <p className="text-sm text-muted-foreground">{sample.customer}</p>
          <Link
            to="/designs/$code"
            params={{ code: sample.designCode }}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            View design →
          </Link>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">Sample lifecycle</h3>
            <span
              className={
                "rounded-full px-2.5 py-1 text-xs font-semibold " +
                SAMPLE_STATUS_TONE[sample.status]
              }
            >
              {sample.status}
            </span>
          </div>

          <ol className="mt-5 space-y-4">
            {steps.map((step, i) => {
              const done = i < currentIdx || sample.status === "Approved";
              const current = i === currentIdx && sample.status !== "Approved";
              const Icon = step.icon;
              return (
                <li key={step.id} className="flex items-start gap-3">
                  <div
                    className={
                      "grid h-9 w-9 shrink-0 place-items-center rounded-xl " +
                      (done
                        ? "bg-primary text-primary-foreground"
                        : current
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : "bg-muted text-muted-foreground")
                    }
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{step.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {done ? "Completed" : current ? "In progress" : "Pending"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Meta label="Requested" value={formatDate(sample.requestedOn)} />
          <Meta label="Target Date" value={formatDate(sample.targetDate)} />
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Notes
          </p>
          <p className="mt-1 text-sm">{sample.notes || "—"}</p>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

/* ---------- Materials ---------- */

function MaterialsPanel({ sample }: { sample: Sample }) {
  if (sample.materials.length === 0) {
    return <EmptyState label="No materials selected yet" />;
  }
  const selectedTotal = selectedMaterialTotal(sample);
  return (
    <div className="grid gap-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3 text-left font-semibold">Material</th>
              <th className="p-3 text-left font-semibold">Supplier</th>
              <th className="p-3 text-right font-semibold">Qty</th>
              <th className="p-3 text-right font-semibold">Rate</th>
              <th className="p-3 text-right font-semibold">Amount</th>
              <th className="p-3 text-center font-semibold">Selected</th>
            </tr>
          </thead>
          <tbody>
            {sample.materials.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="p-3">
                  <p className="font-semibold">{m.name}</p>
                  <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    {m.kind}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground">{m.supplier}</td>
                <td className="p-3 text-right">
                  {m.qty} {m.unit}
                </td>
                <td className="p-3 text-right">₹{m.rate.toLocaleString()}</td>
                <td className="p-3 text-right font-bold">
                  ₹{(m.qty * m.rate).toLocaleString()}
                </td>
                <td className="p-3 text-center">
                  {m.selected ? (
                    <CheckCircle2 className="mx-auto h-5 w-5 text-primary" />
                  ) : (
                    <Circle className="mx-auto h-5 w-5 text-muted-foreground" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-primary-soft p-4">
        <p className="text-sm font-semibold">Selected material cost</p>
        <p className="text-2xl font-extrabold text-primary">
          ₹{selectedTotal.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

/* ---------- Costing ---------- */

function CostingPanel({ sample }: { sample: Sample }) {
  if (sample.costs.length === 0) {
    return <EmptyState label="Costing not started yet" />;
  }
  const total = sampleTotal(sample);
  const byCategory = sample.costs.reduce<Record<string, number>>((acc, c) => {
    acc[c.category] = (acc[c.category] ?? 0) + c.amount;
    return acc;
  }, {});
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3 text-left font-semibold">Cost Item</th>
              <th className="p-3 text-left font-semibold">Category</th>
              <th className="p-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sample.costs.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3 font-semibold">{c.label}</td>
                <td className="p-3 text-muted-foreground">{c.category}</td>
                <td className="p-3 text-right font-bold">
                  ₹{c.amount.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-primary-soft">
              <td className="p-3 font-bold" colSpan={2}>
                Total per piece
              </td>
              <td className="p-3 text-right text-lg font-extrabold text-primary">
                ₹{total.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid gap-3">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary to-primary-glow p-5 text-primary-foreground shadow-md">
          <p className="text-[11px] font-bold uppercase tracking-widest opacity-85">
            Estimated cost
          </p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight">
            ₹{total.toLocaleString()}
          </p>
          <p className="mt-1 text-xs opacity-85">Per piece · draft</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Breakdown
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {Object.entries(byCategory).map(([cat, amt]) => {
              const pct = Math.round((amt / total) * 100);
              return (
                <li key={cat}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{cat}</span>
                    <span className="text-muted-foreground">
                      ₹{amt.toLocaleString()} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------- Approval ---------- */

function ApprovalPanel({ sample }: { sample: Sample }) {
  if (sample.approvals.length === 0) {
    return <EmptyState label="No approvers assigned yet" />;
  }
  const approved = sample.approvals.filter((a) => a.status === "Approved").length;
  const total = sample.approvals.length;
  const pct = Math.round((approved / total) * 100);

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary-soft to-background p-5">
        <div className="flex items-center justify-between text-sm">
          <div>
            <p className="font-bold">Approval progress</p>
            <p className="text-xs text-muted-foreground">
              {approved} of {total} approvers signed off
            </p>
          </div>
          <p className="text-2xl font-extrabold text-primary">{pct}%</p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {sample.approvals.map((a) => (
          <ApprovalCard key={a.id} approval={a} />
        ))}
      </ul>
    </div>
  );
}

function ApprovalCard({ approval }: { approval: Approval }) {
  const StatusIcon =
    approval.status === "Approved"
      ? CheckCircle2
      : approval.status === "Rejected"
        ? XCircle
        : Clock;
  return (
    <li className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {approval.role}
          </p>
          <p className="mt-0.5 truncate text-base font-bold">{approval.name}</p>
          {approval.date && (
            <p className="text-xs text-muted-foreground">
              {formatDate(approval.date)}
            </p>
          )}
        </div>
        <span
          className={
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold " +
            APPROVAL_TONE[approval.status]
          }
        >
          <StatusIcon className="h-3.5 w-3.5" />
          {approval.status}
        </span>
      </div>

      {approval.status === "Pending" && (
        <div className="mt-3 flex gap-2">
          <button className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">
            Approve
          </button>
          <button className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:border-destructive/40 hover:text-destructive">
            Reject
          </button>
        </div>
      )}
    </li>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
