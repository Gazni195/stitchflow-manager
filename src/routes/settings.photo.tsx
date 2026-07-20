import { createFileRoute } from "@tanstack/react-router";
import { SettingsCard, Placeholder } from "@/components/settings/shared";

export const Route = createFileRoute("/settings/photo")({
  component: () => (
    <SettingsCard title="Profile Photo" description="Upload or change your profile photo.">
      <Placeholder />
    </SettingsCard>
  ),
});
