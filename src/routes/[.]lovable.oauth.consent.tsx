import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Minimal typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthResult = {
  data?: {
    client?: { name?: string; client_id?: string } | null;
    redirect_url?: string;
    redirect_to?: string;
    scope?: string;
    scopes?: string[];
  } | null;
  error?: { message: string } | null;
};
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/login", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-sm">
        <h1 className="text-lg font-bold">Could not load this authorization request</h1>
        <p className="mt-2 text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "an app";
  const scopes = details?.scopes ?? (details?.scope ? details.scope.split(/\s+/) : []);

  async function decide(approve: boolean) {
    setBusy(approve ? "approve" : "deny");
    setError(null);
    const { data, error } = approve
      ? await oauthApi().approveAuthorization(authorization_id)
      : await oauthApi().denyAuthorization(authorization_id);
    if (error) {
      setBusy(null);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(null);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">
              Connect {clientName} to Fawri Lifestyle
            </h1>
            <p className="text-xs text-muted-foreground">
              This lets {clientName} use this app as you.
            </p>
          </div>
        </div>

        {scopes.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Requested access
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {scopes.map((s) => (
                <li key={s} className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-5 text-xs text-muted-foreground">
          This does not bypass this app's permissions or backend policies.
        </p>

        {error && (
          <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => decide(false)}
            className="flex-1 h-11 rounded-2xl border border-border bg-card text-sm font-semibold hover:bg-accent disabled:opacity-60"
          >
            {busy === "deny" ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Cancel"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => decide(true)}
            className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-primary to-primary-glow text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 disabled:opacity-60"
          >
            {busy === "approve" ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Approve"}
          </button>
        </div>
      </div>
    </main>
  );
}
