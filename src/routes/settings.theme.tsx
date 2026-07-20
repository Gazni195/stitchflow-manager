import { createFileRoute } from "@tanstack/react-router";
import { SettingsCard, Placeholder } from "@/components/settings/shared";

export const Route = createFileRoute("/settings/theme")({
  component: () => (
    <SettingsCard title="Theme" description="Choose your preferred appearance.">
      <Placeholder />
    </SettingsCard>
  ),
});
