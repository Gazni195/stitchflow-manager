import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Search,
  Hand,
  Sparkles,
  Gem,
  Ribbon,
  Palette,
  Users,
  Calendar,
  CalendarCheck,
  Save,
  CheckCircle2,
  ArrowRight,
  Check,
  Circle,
  FileText,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { WORKFLOW } from "@/lib/workflow";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/handwork")({ component: BulkHandWorkPage });

type Order = {
  code: string;
  customer: string;
  quantity: number;
  progress: number;
};

const ORDERS: Order[] = [
  { code: "MG001", customer: "Aanya Couture", quantity: 240, progress: 52 },
  { code: "MG002", customer: "House of Meher", quantity: 500, progress: 34 },
  { code: "MG003", customer: "Riya Boutique", quantity: 120, progress: 71 },
  { code: "MG004", customer: "Studio Verve", quantity: 90, progress: 22 },
];

const PARTS = [
  "Front Body",
  "Back Body",
  "Sleeve",
  "Collar",
  "Pant",
  "Dupatta",
  "Custom",
] as const;

type HandWorkType = {
  key: string;
  label: string;
  icon: LucideIcon;
};

const WORK_TYPES: HandWorkType[] = [
  { key: "beading", label: "Beading", icon: Sparkles },
  { key: "stone", label: "Stone Work", icon: Gem },
  { key: "embroidery", label: "Embroidery", icon: Hand },
  { key: "lace", label: "Lace Work", icon: Ribbon },
  { key: "thread", label: "Thread Work", icon: Palette },
  { key: "custom", label: "Custom", icon: Sparkles },
];

const TEAMS = ["Team A · Priya", "Team B · Sunita", "Team C · Meena", "Team D · Kavita"];

const TIMELINE = [
  { label: "Sample Approved", state: "done" as const },
  { label: "Bulk Cutting", state: "done" as const },
  { label: "Bulk Hand Work", state: "current" as const },
  { label: "Bulk Stitching", state: "pending" as const },
  { label: "Quality Check", state: "pending" as const },
  { label: "Packing", state: "pending" as const },
  { label: "Barcode", state: "pending" as const },
  { label: "Ready Stock", state: "pending" as const },
];

function BulkHandWorkPage() {
  const [query, setQuery] = useState("MG001");
  const [selectedCode, setSelectedCode] = useState("MG001");
  const [part, setPart] = useState<string>("Front Body");
  const [customPart, setCustomPart] = useState("");
  const [workType, setWorkType] = useState<string>("embroidery");
  const [team, setTeam] = useState(TEAMS[0]);
  const [issueDate, setIssueDate] = useState("2026-07-08");
  const [dueDate, setDueDate] = useState("2026-07-18");
  const [issued, setIssued] = useState(240);
  const [completed, setCompleted] = useState(150);
  const [rework, setRework] = useState(8);
  const [notes, setNotes] = useState("Focus on neckline detailing.");
  const [instructions, setInstructions] = useState("Use gold thread; avoid heavy stones on shoulders.");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ORDERS;
    return ORDERS.filter(
      (o) => o.code.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q),
    );
  }, [query]);

  const order = ORDERS.find((o) => o.code === selectedCode) ?? ORDERS[0];

  const pending = Math.max(0, issued - completed - rework);
  const balance = Math.max(0, issued - completed);
  const pct = issued ? Math.min(100, Math.round((completed / issued) * 100)) : 0;

  return (
    <AppShell title="Bulk Hand Work" subtitle={`Step 7 of ${WORKFLOW.length} · Bulk`}>
      <div className="grid gap-5">
        {/* 1. Select Production Order */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader
            icon={<Search className="h-4 w-4" />}
            title="Select Production Order"
            hint="Search by design code"
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
                    <p className="truncate text-sm font-bold">{o.code}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {o.customer} · Qty {o.quantity}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow"
                          style={{ width: `${o.progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {o.progress}%
                      </span>
                    </div>
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

          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="Customer" value={order.customer} />
            <MiniStat label="Order Qty" value={String(order.quantity)} />
            <MiniStat label="Progress" value={`${order.progress}%`} tone="primary" />
          </div>
        </section>

        {/* 2. Select Part */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<Hand className="h-4 w-4" />} title="Select Part" />
          <div className="mt-3 flex flex-wrap gap-2">
            {PARTS.map((name) => {
              const active = part === name;
              return (
                <button
                  key={name}
                  onClick={() => setPart(name)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-semibold transition",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background text-foreground hover:border-primary/40",
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>
          {part === "Custom" && (
            <input
              value={customPart}
              onChange={(e) => setCustomPart(e.target.value)}
              placeholder="Enter custom part name"
              className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary"
            />
          )}
        </section>

        {/* 3. Hand Work Details */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<Sparkles className="h-4 w-4" />} title="Hand Work Details" />

          <p className="mt-4 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Work Type
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {WORK_TYPES.map((w) => {
              const active = workType === w.key;
              const Icon = w.icon;
              return (
                <button
                  key={w.key}
                  onClick={() => setWorkType(w.key)}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border p-3 text-left transition",
                    active
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-background hover:border-primary/40",
                  )}
                >
                  <div
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary-soft text-primary",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-bold">{w.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <SelectField
              icon={<Users className="h-4 w-4" />}
              label="Worker / Team"
              value={team}
              options={TEAMS}
              onChange={setTeam}
            />
            <Field
              icon={<Calendar className="h-4 w-4" />}
              label="Issue Date"
              type="date"
              value={issueDate}
              onChange={setIssueDate}
            />
            <div className="sm:col-span-2">
              <Field
                icon={<CalendarCheck className="h-4 w-4" />}
                label="Expected Completion"
                type="date"
                value={dueDate}
                onChange={setDueDate}
              />
            </div>
          </div>
        </section>

        {/* 4. Quantity Tracking */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<Hand className="h-4 w-4" />} title="Quantity Tracking" />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <NumField label="Issued" value={issued} onChange={setIssued} tone="primary" />
            <NumField label="Completed" value={completed} onChange={setCompleted} tone="success" />
            <NumField label="Rework" value={rework} onChange={setRework} tone="warning" />
            <ReadStat label="Pending" value={pending} tone="warning" />
            <ReadStat label="Balance" value={balance} tone="primary" />
            <ReadStat label="Progress" value={`${pct}%`} tone="success" />
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Completion
              </p>
              <p className="text-xs font-bold text-primary">{pct}%</p>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </section>

        {/* 5. Remarks */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<FileText className="h-4 w-4" />} title="Remarks" />
          <div className="mt-3 grid gap-3">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <FileText className="h-4 w-4" /> Notes
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <AlertCircle className="h-4 w-4" /> Special Instructions
              </span>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
        </section>

        {/* 6. Summary */}
        <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary via-primary to-primary-glow p-5 text-primary-foreground shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                Hand Work Summary
              </p>
              <p className="mt-1 text-2xl font-extrabold">{pct}% Complete</p>
              <p className="text-xs opacity-80">
                {part} · {WORK_TYPES.find((w) => w.key === workType)?.label}
              </p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <Hand className="h-7 w-7" />
            </div>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <BigStat label="Issued" value={issued} />
            <BigStat label="Completed" value={completed} />
            <BigStat label="Pending" value={pending} />
          </div>
        </section>

        {/* 7. Buttons */}
        <section className="grid gap-2 sm:grid-cols-3">
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-bold text-foreground shadow-sm hover:bg-accent">
            <Save className="h-4 w-4" /> Save Draft
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-success px-4 py-3.5 text-sm font-bold text-white shadow-sm hover:opacity-90">
            <CheckCircle2 className="h-4 w-4" /> Mark as Completed
          </button>
          <Link
            to="/stitching"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
          >
            Continue to Stitching <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        {/* 8. Timeline */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <SectionHeader icon={<CheckCircle2 className="h-4 w-4" />} title="Production Timeline" />
          <ol className="mt-4 grid gap-2">
            {TIMELINE.map((step) => {
              const done = step.state === "done";
              const current = step.state === "current";
              return (
                <li
                  key={step.label}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3",
                    current
                      ? "border-primary bg-primary-soft"
                      : done
                        ? "border-success/30 bg-success/5"
                        : "border-border bg-background",
                  )}
                >
                  <div
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                      done
                        ? "bg-success text-white"
                        : current
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? (
                      <Check className="h-4 w-4" />
                    ) : current ? (
                      <Hand className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-semibold", current && "text-primary")}>
                      {step.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {done ? "Completed" : current ? "In progress" : "Pending"}
                    </p>
                  </div>
                  {current && (
                    <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase text-primary-foreground">
                      Current
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </AppShell>
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
  tone?: "primary" | "success";
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
          tone === "primary" && "text-primary",
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
  type = "text",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
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
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold outline-none transition focus:border-primary"
      />
    </label>
  );
}

function SelectField({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold outline-none transition focus:border-primary"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
  tone,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  tone?: "primary" | "success" | "warning";
}) {
  return (
    <label className="block rounded-2xl border border-border bg-background px-3 py-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={cn(
          "mt-0.5 w-full bg-transparent text-lg font-extrabold outline-none",
          tone === "primary" && "text-primary",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning-foreground",
        )}
      />
    </label>
  );
}

function ReadStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "primary" | "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        tone === "primary" && "border-primary/30 bg-primary-soft",
        tone === "success" && "border-success/30 bg-success/10",
        tone === "warning" && "border-warning/30 bg-warning/10",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-lg font-extrabold",
          tone === "primary" && "text-primary",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning-foreground",
        )}
      >
        {value}
      </p>
    </div>
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
