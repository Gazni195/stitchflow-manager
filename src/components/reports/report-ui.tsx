// Shared presentation pieces for the Reports module. Kept in one file so the
// dashboard and the report viewer render from the same primitives instead of
// re-implementing cards / tables / toolbars per report.
import { Link } from "@tanstack/react-router";
import { Download, FileSpreadsheet, FileText, Printer, RotateCcw, X } from "lucide-react";
import { Can } from "@/components/Can";
import { cn } from "@/lib/utils";
import {
  FILTER_LABEL,
  type FilterKey,
  type FilterOptions,
  type ReportColumn,
  type ReportDefinition,
  type ReportFilters,
  type ReportRow,
  type SummaryCard,
} from "@/lib/reports/definitions";
import { exportCsv, exportExcel, exportPdf, printReport } from "@/lib/reports/export";

/* ------------------------------- cards -------------------------------- */

export function SummaryCards({ cards }: { cards: SummaryCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {cards.map((c, i) => (
        <article
          key={c.id}
          className={cn(
            "rounded-2xl border p-4 shadow-sm",
            i % 3 === 0
              ? "border-primary/20 bg-gradient-to-br from-primary via-primary to-primary-glow text-primary-foreground"
              : "border-border bg-card",
          )}
        >
          <p
            className={cn(
              "text-[11px] font-bold uppercase tracking-wider",
              i % 3 === 0 ? "opacity-80" : "text-muted-foreground",
            )}
          >
            {c.label}
          </p>
          <p className="mt-1 text-2xl font-extrabold">{c.value}</p>
          <p className={cn("text-xs", i % 3 === 0 ? "opacity-80" : "text-muted-foreground")}>{c.hint}</p>
        </article>
      ))}
    </div>
  );
}

export function ReportLinkCard({ report }: { report: ReportDefinition }) {
  return (
    <Link
      to="/reports/$reportId"
      params={{ reportId: report.id }}
      className="group flex items-start gap-3 rounded-2xl border border-border bg-background p-4 transition hover:border-primary/40 hover:bg-primary-soft/40"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <FileText className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-foreground">{report.title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{report.description}</span>
      </span>
    </Link>
  );
}

/* ------------------------------ filter bar ----------------------------- */

export function ReportFilterBar({
  filters,
  keys,
  options,
  onChange,
  onReset,
}: {
  filters: ReportFilters;
  keys: FilterKey[];
  options: FilterOptions;
  onChange: (next: Partial<ReportFilters>) => void;
  onReset: () => void;
}) {
  if (!keys.length) return null;
  const selectKeys = keys.filter((k) => k !== "dateRange") as Exclude<FilterKey, "dateRange">[];
  const active =
    (keys.includes("dateRange") && (filters.from || filters.to)) ||
    selectKeys.some((k) => filters[k]);

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Filters</p>
        {active && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {keys.includes("dateRange") && (
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1">
            <Field label="From">
              <input
                type="date"
                value={filters.from}
                onChange={(e) => onChange({ from: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Field>
            <Field label="To">
              <input
                type="date"
                value={filters.to}
                onChange={(e) => onChange({ to: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Field>
          </div>
        )}

        {selectKeys.map((key) => (
          <Field key={key} label={FILTER_LABEL[key]}>
            <select
              value={filters[key]}
              onChange={(e) => onChange({ [key]: e.target.value } as Partial<ReportFilters>)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">All</option>
              {options[key].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
        ))}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export function ActiveFilterChips({
  filters,
  keys,
  onChange,
}: {
  filters: ReportFilters;
  keys: FilterKey[];
  onChange: (next: Partial<ReportFilters>) => void;
}) {
  const chips: { label: string; clear: Partial<ReportFilters> }[] = [];
  if (keys.includes("dateRange") && (filters.from || filters.to)) {
    chips.push({
      label: `Date: ${filters.from || "…"} → ${filters.to || "…"}`,
      clear: { from: "", to: "" },
    });
  }
  for (const key of keys) {
    if (key === "dateRange") continue;
    const value = filters[key];
    if (value) chips.push({ label: `${FILTER_LABEL[key]}: ${value}`, clear: { [key]: "" } as Partial<ReportFilters> });
  }
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => onChange(c.clear)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-[11px] font-semibold text-primary"
        >
          {c.label}
          <X className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}

/* ------------------------------- toolbar ------------------------------- */

export function ReportActions({
  title,
  subtitle,
  columns,
  rows,
}: {
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: ReportRow[];
}) {
  const disabled = rows.length === 0;
  return (
    <div className="flex flex-wrap gap-2">
      <Can permission="reports.print">
        <ActionButton
          icon={<Printer className="h-4 w-4" />}
          label="Print"
          disabled={disabled}
          onClick={() => printReport(title, columns, rows, subtitle)}
        />
      </Can>
      <Can permission="reports.export.pdf">
        <ActionButton
          icon={<FileText className="h-4 w-4" />}
          label="PDF"
          disabled={disabled}
          onClick={() => exportPdf(title, columns, rows, subtitle)}
        />
      </Can>
      <Can permission="reports.export.excel">
        <ActionButton
          icon={<FileSpreadsheet className="h-4 w-4" />}
          label="Excel"
          disabled={disabled}
          onClick={() => exportExcel(title, columns, rows, subtitle)}
        />
      </Can>
      <Can permission="reports.export.csv">
        <ActionButton
          icon={<Download className="h-4 w-4" />}
          label="CSV"
          disabled={disabled}
          onClick={() => exportCsv(title, columns, rows)}
        />
      </Can>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}

/* -------------------------------- table -------------------------------- */

export function ReportTable({
  columns,
  rows,
  isLoading,
}: {
  columns: ReportColumn[];
  rows: ReportRow[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <EmptyReport title="Loading report…" subtitle="Reading live workspace data." />;
  }
  if (!rows.length) {
    return (
      <EmptyReport
        title="No records match this report."
        subtitle="Adjust the filters, or capture the underlying data in its module first."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="bg-muted/60">
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground",
                  c.align === "right" ? "text-right" : "text-left",
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border even:bg-muted/20">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-3 py-2.5 text-foreground",
                    c.align === "right" ? "text-right tabular-nums" : "text-left",
                  )}
                >
                  {row[c.key] === null || row[c.key] === undefined || row[c.key] === "" ? "—" : String(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyReport({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="grid place-items-center gap-1 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
      <FileText className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {subtitle && <p className="max-w-md text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
