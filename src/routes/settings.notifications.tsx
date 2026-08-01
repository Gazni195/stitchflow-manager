import { createFileRoute } from "@tanstack/react-router";
import { SettingsCard, Placeholder } from "@/components/settings/shared";

export const Route = createFileRoute("/settings/notifications")({
  component: () => (
    <SettingsCard
      title="Notification Preferences"
      description="Control how and when you're notified."
    >
      <Placeholder />
    </SettingsCard>
  ),
});
