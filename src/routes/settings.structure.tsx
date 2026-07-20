import { createFileRoute } from "@tanstack/react-router";
import { SettingsCard, SettingsGate, Placeholder } from "@/components/settings/shared";

export const Route = createFileRoute("/settings/structure")({
  component: () => (
    <SettingsGate permission="settings.edit">
      <SettingsCard
        title="Company Structure"
        description="Departments, teams and reporting lines."
      >
        <Placeholder />
      </SettingsCard>
    </SettingsGate>
  ),
});
