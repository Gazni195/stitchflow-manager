import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useCan } from "@/lib/rbac/use-rbac";
import { useReportsData } from "@/lib/api/reports";
import {
  buildSummaryCards,
  REPORT_SECTIONS,
  reportsForSection,
} from "@/lib/reports/definitions";
import { ReportLinkCard, SummaryCards, EmptyReport } from "@/components/reports/report-ui";

export const Route = createFileRoute("/reports/")({
  head: () => ({
    meta: [
      { title: "Reports — StitchFlow Manager" },
      {
        name: "description",
        content:
          "Design, sample, production, inventory, stock and user reports generated from live StitchFlow workspace data.",
      },
      { property: "og:title", content: "Reports — StitchFlow Manager" },
      {
        property: "og:description",
        content: "Live operational reporting across designs, samples, production, inventory and stock.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsDashboard,
});

function ReportsDashboard() {
  const canView = useCan("reports.view");
  const canDashboard = useCan(["reports.dashboard.view", "reports.view"]);
  const { data, isLoading } = useReportsData();
  const cards = buildSummaryCards(data);

  if (!canView.isLoading && !canView.allowed) {
    return (
      <AppShell title="Reports" subtitle="Operational reporting">
        <div className="grid place-items-center gap-2 rounded-3xl border border-dashed border-border bg-muted/30 px-4 py-14 text-center">
          <ShieldAlert className="h-7 w-7 text-muted-foreground" />
          <p className="text-sm font-bold text-foreground">You don't have access to Reports.</p>
          <p className="text-xs text-muted-foreground">
            Ask an administrator to grant the Reports permission to your role.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Reports" subtitle="Live reporting across the whole workflow">
      <div className="grid gap-5">
        {canDashboard.allowed && (
          <section className="grid gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">Dashboard</h2>
            </div>
            {isLoading ? (
              <EmptyReport title="Loading workspace figures…" />
            ) : (
              <SummaryCards cards={cards} />
            )}
          </section>
        )}

        {REPORT_SECTIONS.map((section) => (
          <SectionBlock key={section.id} id={section.id} />
        ))}
      </div>
    </AppShell>
  );
}

function SectionBlock({ id }: { id: (typeof REPORT_SECTIONS)[number]["id"] }) {
  const section = REPORT_SECTIONS.find((s) => s.id === id)!;
  const { allowed } = useCan(section.permission);
  if (!allowed) return null;
  const reports = reportsForSection(section.id);

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-foreground">{section.title}</h2>
          <p className="text-xs text-muted-foreground">{section.description}</p>
        </div>
        <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-bold text-primary">
          {reports.length} report{reports.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {reports.map((r) => (
          <ReportLinkCard key={r.id} report={r} />
        ))}
      </div>

      <div className="mt-3 text-right">
        <Link
          to="/reports/$reportId"
          params={{ reportId: reports[0]!.id }}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Open first report →
        </Link>
      </div>
    </section>
  );
}
