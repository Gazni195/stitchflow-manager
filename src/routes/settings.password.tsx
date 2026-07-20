import { createFileRoute } from "@tanstack/react-router";
import { SettingsCard, Placeholder } from "@/components/settings/shared";

export const Route = createFileRoute("/settings/password")({
  component: () => (
    <SettingsCard title="Change Password" description="Update your account password.">
      <Placeholder />
    </SettingsCard>
  ),
});
