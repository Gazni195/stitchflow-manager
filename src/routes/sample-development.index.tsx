import { createFileRoute, Link } from "@tanstack/react-router";
import { FlaskConical, Loader2, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DesignImage } from "@/components/DesignImage";
import { useRequireAuth } from "@/hooks/use-auth";
import { useDesigns } from "@/lib/api/designs";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/designs";

export const Route = createFileRoute("/sample-development/")({
  head: () => ({
    meta: [
      { title: "Sample Development — Fawri Lifestyle" },
      {
        name: "description",
        content:
          "Every sample belongs to a design. Pick a design to open its sample lifecycle.",
      },
    ],
  }),
  component: SampleDevelopmentIndex,
});

function SampleDevelopmentIndex() {
  useRequireAuth();
  const { data: designs = [], isLoading } = useDesigns();

  return (
    <AppShell
      title="Sample Development"
      subtitle="Samples now live inside each design"
    >
      <div className="grid gap-5">
        <section className="rounded-3xl border border-primary/20 bg-primary-soft p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">Every sample belongs to a design</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open a design and tap <span className="font-semibold">Start Sample Development</span> to
                begin its sample lifecycle. Materials, costing and approvals auto-fill from the
                design's parts, fabrics, colors and order quantity.
              </p>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : designs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No designs yet. Create a design to start sample development.
            </p>
            <Link
              to="/designs"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Go to Designs <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {designs.map((d) => (
              <li key={d.id}>
                <Link
                  to="/sample-development/$code"
                  params={{ code: d.code }}
                  className="flex h-full items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition hover:border-primary/40 hover:shadow-md"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-primary-soft">
                    <DesignImage path={d.imagePath} alt={d.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold tracking-wider text-muted-foreground">
                      {d.code}
                    </p>
                    <p className="truncate text-sm font-bold">{d.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{d.customer}</p>
                    <span
                      className={
                        "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                        STATUS_TONE[d.status]
                      }
                    >
                      {STATUS_LABEL[d.status]}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
