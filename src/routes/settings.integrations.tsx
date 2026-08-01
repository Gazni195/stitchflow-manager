import { createFileRoute } from "@tanstack/react-router";
import { SettingsCard, SettingsGate, Placeholder } from "@/components/settings/shared";

export const Route = createFileRoute("/settings/integrations")({
  component: () => (
    <SettingsGate permission="settings.view">
      <SettingsCard
        title="Integration Status"
        description="External services connected to your workspace."
      >
        <Placeholder note="ERPNext connection status and other integrations will appear here." />
      </SettingsCard>
    </SettingsGate>
  ),
});
