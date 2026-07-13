import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Factory, Loader2, PlayCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { DesignImage } from "@/components/DesignImage";
import { useRequireAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, STATUS_TONE, type Design, type DesignStatus } from "@/lib/designs";

export const Route = createFileRoute("/production/ready")({
  head: () => ({
    meta: [{ title: "Ready for Production — Fawri Lifestyle" }],
  }),
  component: ReadyForProductionPage,
});

type Row = Pick<
  Design,
  "id" | "code" | "name" | "customer" | "orderQuantity" | "imagePath" | "status"
> & { approvedAt: string | null };

function useProductionQueue() {
  return useQuery({
    queryKey: ["production-queue"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("designs")
        .select("id, code, name, customer, order_quantity, image_path, status, updated_at")
        .in("status", ["sample_approved", "in_production"])
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id as string,
        code: r.code as string,
        name: r.name as string,
        customer: r.customer as string,
        orderQuantity: r.order_quantity as number,
        imagePath: (r.image_path as string | null) ?? null,
        status: r.status as DesignStatus,
        approvedAt: (r.updated_at as string | null) ?? null,
      }));
    },
  });
}

function useStartProduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (designId: string) => {
      const { error } = await supabase.rpc("start_bulk_production", { _design_id: designId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-queue"] });
      qc.invalidateQueries({ queryKey: ["designs"] });
    },
  });
}

function ReadyForProductionPage() {
  useRequireAuth();
  const { data = [], isLoading } = useProductionQueue();
  const start = useStartProduction();

  const ready = data.filter((r) => r.status === "sample_approved");
  const running = data.filter((r) => r.status === "in_production");

  return (
    <AppShell title="Ready for Production" subtitle="Approved samples awaiting bulk production">
      <div className="grid gap-6">
        <Section
          title="Ready for Production"
          count={ready.length}
          empty="No samples are waiting. Approve a sample to see it here."
          loading={isLoading}
        >
          {ready.map((r) => (
            <QueueCard
              key={r.id}
              row={r}
              action={
                <button
                  onClick={() => start.mutate(r.id)}
                  disabled={start.isPending}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {start.isPending && start.variables === r.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PlayCircle className="h-3.5 w-3.5" />
                  )}
                  Start Production
                </button>
              }
            />
          ))}
        </Section>

        <Section
          title="Running Production"
          count={running.length}
          empty="No production orders are running yet."
          loading={isLoading}
        >
          {running.map((r) => (
            <QueueCard
              key={r.id}
              row={r}
              action={
                <Link
                  to="/designs/$code"
                  params={{ code: r.code }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-accent"
                >
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
          ))}
        </Section>
      </div>
    </AppShell>
  );
}

function Section({
  title,
  count,
  empty,
  loading,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">{title}</h2>
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
          {count}
        </span>
      </div>
      {loading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : count === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <Factory className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">{children}</ul>
      )}
    </section>
  );
}

function QueueCard({ row, action }: { row: Row; action: React.ReactNode }) {
  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[16/9] w-full bg-primary-soft">
        <DesignImage path={row.imagePath} alt={row.name} />
        <span
          className={
            "absolute right-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm " +
            STATUS_TONE[row.status]
          }
        >
          {STATUS_LABEL[row.status]}
        </span>
      </div>
      <div className="grid gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold tracking-widest text-muted-foreground">
            {row.code}
          </p>
          <p className="truncate text-base font-extrabold">{row.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.customer}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-border bg-background p-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Order Qty
            </dt>
            <dd className="mt-0.5 font-bold">{row.orderQuantity.toLocaleString()} Pcs</dd>
          </div>
          <div className="rounded-lg border border-border bg-background p-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Approved
            </dt>
            <dd className="mt-0.5 inline-flex items-center gap-1 font-bold">
              <CheckCircle2 className="h-3 w-3 text-success" />
              {row.approvedAt
                ? new Date(row.approvedAt).toLocaleDateString(undefined, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </dd>
          </div>
        </dl>
        <div className="flex justify-end">{action}</div>
      </div>
    </li>
  );
}
