import { createFileRoute } from "@tanstack/react-router";
import { SettingsCard, SettingsGate, Placeholder } from "@/components/settings/shared";

export const Route = createFileRoute("/settings/company")({
  component: () => (
    <SettingsGate permission="settings.edit">
      <SettingsCard title="Company" description="Manage company profile and details.">
        <Placeholder />
      </SettingsCard>
    </SettingsGate>
  ),
});
