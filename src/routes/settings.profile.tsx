import { createFileRoute } from "@tanstack/react-router";
import { SettingsCard, Placeholder } from "@/components/settings/shared";
import { useSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/settings/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { session } = useSession();
  const email = session?.user?.email ?? "—";
  const name =
    (session?.user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? "—";
  return (
    <SettingsCard title="My Profile" description="Your personal account information.">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase text-muted-foreground">Name</dt>
          <dd className="mt-1 text-sm font-medium">{name}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-muted-foreground">Email</dt>
          <dd className="mt-1 text-sm font-medium">{email}</dd>
        </div>
      </dl>
      <div className="mt-6">
        <Placeholder note="Editing profile details will be available soon." />
      </div>
    </SettingsCard>
  );
}
