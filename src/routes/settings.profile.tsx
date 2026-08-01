import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { SettingsCard } from "@/components/settings/shared";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/settings/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { session } = useSession();
  const email = session?.user?.email ?? "—";
  const meta = (session?.user?.user_metadata ?? {}) as {
    full_name?: string;
    phone?: string;
  };
  const [fullName, setFullName] = useState(meta.full_name ?? "");
  const [phone, setPhone] = useState(meta.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    setFullName(meta.full_name ?? "");
    setPhone(meta.phone ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName.trim(), phone: phone.trim() },
    });
    setBusy(false);
    if (error) {
      setMsg({ kind: "err", text: error.message });
      return;
    }
    setMsg({ kind: "ok", text: "Profile updated." });
  }

  return (
    <SettingsCard title="My Profile" description="Your personal account information.">
      <form onSubmit={onSubmit} className="max-w-lg space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Email</label>
            <div className="mt-1 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm">
              {email}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">User ID</label>
            <div className="mt-1 truncate rounded-xl border border-border bg-muted/40 px-3 py-2.5 font-mono text-xs">
              {session?.user?.id ?? "—"}
            </div>
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1.5 h-12 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
        </div>
        <div>
          <label className="text-sm font-semibold">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1.5 h-12 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
        </div>
        {msg && (
          <p
            className={
              msg.kind === "ok"
                ? "rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
                : "rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            }
          >
            {msg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm hover:brightness-105 disabled:opacity-70"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save profile
        </button>
      </form>
    </SettingsCard>
  );
}
