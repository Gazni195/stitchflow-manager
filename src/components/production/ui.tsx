import { Check, Circle, SkipForward, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { DesignWorkflow } from "@/lib/design-workflow";
import { stepLabel } from "@/lib/design-workflow";
import { getOperation } from "@/lib/operations";

export function SectionHeader({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
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

export function MiniStat({
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

export function Field({
  icon,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
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
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold outline-none transition focus:border-primary"
      />
    </label>
  );
}

export function SelectField({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon?: ReactNode;
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

export function NumField({
  label,
  value,
  onChange,
  tone,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  tone?: "primary" | "success" | "warning" | "danger";
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
          tone === "danger" && "text-destructive",
        )}
      />
    </label>
  );
}

export function ReadStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        tone === "primary" && "border-primary/30 bg-primary-soft",
        tone === "success" && "border-success/30 bg-success/10",
        tone === "warning" && "border-warning/30 bg-warning/10",
        tone === "danger" && "border-destructive/30 bg-destructive/10",
        !tone && "border-border bg-background",
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
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function BigStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-0.5 text-xl font-extrabold">{value}</p>
    </div>
  );
}

export type TimelineStep = {
  label: string;
  state: "done" | "current" | "pending" | "skipped";
  key?: string;
};

export function ProductionTimeline({
  steps,
  currentIcon: CurrentIcon,
}: {
  steps: TimelineStep[];
  currentIcon?: LucideIcon;
}) {
  return (
    <ol className="mt-4 grid gap-2">
      {steps.map((step, i) => {
        const done = step.state === "done";
        const current = step.state === "current";
        const skipped = step.state === "skipped";
        return (
          <li
            key={step.key ?? `${step.label}-${i}`}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-3",
              current
                ? "border-primary bg-primary-soft"
                : done
                  ? "border-success/30 bg-success/5"
                  : skipped
                    ? "border-dashed border-border bg-muted/40 opacity-60"
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
                    : skipped
                      ? "bg-muted text-muted-foreground"
                      : "bg-muted text-muted-foreground",
              )}
            >
              {done ? (
                <Check className="h-4 w-4" />
              ) : current && CurrentIcon ? (
                <CurrentIcon className="h-4 w-4" />
              ) : skipped ? (
                <SkipForward className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-semibold", current && "text-primary", skipped && "line-through")}>
                {step.label}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {done ? "Completed" : current ? "In progress" : skipped ? "Skipped" : "Pending"}
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
  );
}

export function buildTimelineFromWorkflow(
  wf: DesignWorkflow,
  currentStepId?: string,
): TimelineStep[] {
  return wf.steps.map((s) => {
    const op = getOperation(s.operationId);
    const isCurrent = currentStepId
      ? s.stepId === currentStepId
      : s.status === "in-progress";
    const state: TimelineStep["state"] = isCurrent
      ? "current"
      : s.status === "completed"
        ? "done"
        : s.status === "skipped"
          ? "skipped"
          : "pending";
    return {
      key: s.stepId,
      label: `${s.sequence}. ${s.label ?? op.name}${
        wf.steps.filter((x) => x.operationId === s.operationId).length > 1 && !s.label
          ? ""
          : ""
      }`.replace(/^(\d+)\. /, (_m, n) => `${n}. `) + "",
      state,
    };
  }).map((t, i, arr) => {
    // Prefer stepLabel disambiguation (adds "· Round N" for repeats).
    const s = wf.steps[i];
    const label = `${s.sequence}. ${stepLabel(s, wf)}`;
    return { ...t, label };
  });
}
// Silence unused-import when only used above for typing.
void arr_unused;

export function OrderPicker<T extends { code: string; customer: string; quantity: number; progress: number }>({
  orders,
  selectedCode,
  onSelect,
  query,
  onQuery,
}: {
  orders: T[];
  selectedCode: string;
  onSelect: (code: string) => void;
  query: string;
  onQuery: (v: string) => void;
}) {
  const q = query.trim().toLowerCase();
  const results = q
    ? orders.filter(
        (o) => o.code.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q),
      )
    : orders;
  return (
    <>
      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3">
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
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
              onClick={() => onSelect(o.code)}
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
    </>
  );
}

export const SAMPLE_ORDERS = [
  { code: "MG001", customer: "Aanya Couture", quantity: 240, progress: 62 },
  { code: "MG002", customer: "House of Meher", quantity: 500, progress: 45 },
  { code: "MG003", customer: "Riya Boutique", quantity: 120, progress: 78 },
  { code: "MG004", customer: "Studio Verve", quantity: 90, progress: 30 },
];

export function buildTimeline(currentLabel: string): TimelineStep[] {
  const steps = [
    "Sample Approved",
    "Bulk Cutting",
    "Bulk Hand Work",
    "Bulk Stitching",
    "Quality Check",
    "Packaging",
    "Barcode",
    "Ready Stock",
  ];
  const idx = steps.indexOf(currentLabel);
  return steps.map((label, i) => ({
    label,
    state: i < idx ? "done" : i === idx ? "current" : "pending",
  }));
}
