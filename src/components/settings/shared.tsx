import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useCan } from "@/lib/rbac/use-rbac";
import type { PermissionKey } from "@/lib/rbac/roles";

export function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

export function SettingsGate({
  permission,
  children,
}: {
  permission: PermissionKey | PermissionKey[];
  children: ReactNode;
}) {
  const { allowed, isLoading } = useCan(permission);
  if (isLoading) return null;
  if (!allowed) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-bold">Access denied</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have permission to view this section.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

export function Placeholder({ note }: { note?: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      {note ?? "This section is coming soon."}
    </p>
  );
}
