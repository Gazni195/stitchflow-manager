import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/roles")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/roles" });
  },
});
