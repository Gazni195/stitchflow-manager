import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, KeyRound } from "lucide-react";
import { SettingsCard } from "@/components/settings/shared";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings/password")({
  component: PasswordPage,
});

function PasswordPage() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 6) {
      setMsg({ kind: "err", text: "Password must be at least 6 characters." });
      return;
    }
    if (pw !== confirm) {
      setMsg({ kind: "err", text: "Passwords do not match." });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setMsg({ kind: "err", text: error.message });
      return;
    }
    setPw("");
    setConfirm("");
    setMsg({ kind: "ok", text: "Password updated." });
  }

  return (
    <SettingsCard title="Change Password" description="Update your account password.">
      <form onSubmit={onSubmit} className="max-w-md space-y-4">
        <div>
          <label className="text-sm font-semibold">New password</label>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="mt-1.5 h-12 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
        </div>
        <div>
          <label className="text-sm font-semibold">Confirm new password</label>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Update password
        </button>
      </form>
    </SettingsCard>
  );
}
