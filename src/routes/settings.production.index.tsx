import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Factory, Percent } from "lucide-react";
import { SettingsCard, SettingsGate } from "@/components/settings/shared";

export const Route = createFileRoute("/settings/production/")({
  head: () => ({ meta: [{ title: "Production Settings — Fawri Lifestyle" }] }),
  component: () => (
    <SettingsGate permission="settings.edit">
      <SettingsCard
        title="Production Settings"
        description="Configure production-related rules and defaults."
      >
        <ul className="grid gap-2">
          <li>
            <Link
              to="/settings/production/reduction-rules"
              className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold hover:border-primary hover:bg-accent"
            >
              <span className="flex items-center gap-3">
                <Percent className="h-4 w-4 text-primary" />
                Consumption Reduction Rules
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
          <li>
            <Link
              to="/settings/workstations"
              className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold hover:border-primary hover:bg-accent"
            >
              <span className="flex items-center gap-3">
                <Factory className="h-4 w-4 text-primary" />
                Workstations
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        </ul>
      </SettingsCard>
    </SettingsGate>
  ),
});
