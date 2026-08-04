import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useCan } from "@/lib/rbac/use-rbac";
import { useReportsData } from "@/lib/api/reports";
import {
  buildFilterOptions,
  EMPTY_FILTERS,
  REPORT_SECTIONS,
  reportById,
  type ReportFilters,
} from "@/lib/reports/definitions";
import {
  ActiveFilterChips,
  EmptyReport,
  ReportActions,
  ReportFilterBar,
  ReportTable,
} from "@/components/reports/report-ui";

export const Route = createFileRoute("/reports/$reportId")({
  head: () => ({
    meta: [
      { title: "Report — StitchFlow Manager" },
      {
        name: "description",
        content: "Filter, print and export a StitchFlow operational report built from live workspace data.",
      },
      { property: "og:title", content: "Report — StitchFlow Manager" },
      {
        property: "og:description",
        content: "Filter, print and export a StitchFlow operational report built from live workspace data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportViewer,
});

function ReportViewer() {
  const { reportId } = useParams({ from: "/reports/$reportId" });
  const report = reportById(reportId);
  const { data, isLoading } = useReportsData();
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);

  const permission = report?.permission ?? "reports.view";
  const { allowed, isLoading: permLoading } = useCan([permission, "reports.view"]);

  const options = useMemo(() => buildFilterOptions(data), [data]);
  const rows = useMemo(
    () => (report && data ? report.build(data, filters) : []),
    [report, data, filters],
  );

  if (!report) {
    return (
      <AppShell title="Report not found" subtitle="Reports">
        <EmptyReport title="This report doesn't exist." subtitle="Pick one from the Reports dashboard." />
        <div className="mt-4">
          <BackLink />
        </div>
      </AppShell>
    );
  }

  const section = REPORT_SECTIONS.find((s) => s.id === report.section)!;

  if (!permLoading && !allowed) {
    return (
      <AppShell title={report.title} subtitle={section.title}>
        <div className="grid place-items-center gap-2 rounded-3xl border border-dashed border-border bg-muted/30 px-4 py-14 text-center">
          <ShieldAlert className="h-7 w-7 text-muted-foreground" />
          <p className="text-sm font-bold text-foreground">You don't have access to this report.</p>
          <p className="text-xs text-muted-foreground">Required permission: {report.permission}</p>
        </div>
      </AppShell>
    );
  }

  const subtitle = describeFilters(filters);

  return (
    <AppShell
      title={report.title}
      subtitle={`${section.title} · ${report.description}`}
      action={
        <ReportActions
          title={report.title}
          subtitle={subtitle}
          columns={report.columns}
          rows={rows}
        />
      }
    >
      <div className="grid gap-4">
        <BackLink />

        <ReportFilterBar
          filters={filters}
          keys={report.filters}
          options={options}
          onChange={(next) => setFilters((f) => ({ ...f, ...next }))}
          onReset={() => setFilters(EMPTY_FILTERS)}
        />

        <ActiveFilterChips
          filters={filters}
          keys={report.filters}
          onChange={(next) => setFilters((f) => ({ ...f, ...next }))}
        />

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {rows.length} row{rows.length === 1 ? "" : "s"}
            </p>
            <div className="lg:hidden">
              <ReportActions
                title={report.title}
                subtitle={subtitle}
                columns={report.columns}
                rows={rows}
              />
            </div>
          </div>

          <ReportTable columns={report.columns} rows={rows} isLoading={isLoading} />

          {report.note && (
            <p className="mt-3 text-[11px] text-muted-foreground">{report.note}</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function BackLink() {
  return (
    <Link
      to="/reports"
      className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> All reports
    </Link>
  );
}

function describeFilters(f: ReportFilters): string {
  const parts: string[] = [];
  if (f.from || f.to) parts.push(`${f.from || "…"} → ${f.to || "…"}`);
  for (const [key, value] of Object.entries(f)) {
    if (!value || key === "from" || key === "to") continue;
    parts.push(`${key}: ${value}`);
  }
  return parts.length ? parts.join(" · ") : "All records";
}
