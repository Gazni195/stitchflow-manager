import { createFileRoute } from "@tanstack/react-router";
import { SettingsCard, SettingsGate, Placeholder } from "@/components/settings/shared";

export const Route = createFileRoute("/settings/system")({
  component: () => (
    <SettingsGate permission="settings.edit">
      <SettingsCard title="System Settings" description="Workspace-wide configuration.">
        <Placeholder />
      </SettingsCard>
    </SettingsGate>
  ),
});
