import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Upload, Trash2, User } from "lucide-react";
import { SettingsCard } from "@/components/settings/shared";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/settings/photo")({
  component: PhotoPage,
});

function PhotoPage() {
  const { session } = useSession();
  const uid = session?.user?.id;
  const meta = (session?.user?.user_metadata ?? {}) as { avatar_path?: string; avatar_url?: string };
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!meta.avatar_path) {
        setPreviewUrl(null);
        return;
      }
      const { data } = await supabase.storage
        .from("avatars")
        .createSignedUrl(meta.avatar_path, 3600);
      if (!cancelled) setPreviewUrl(data?.signedUrl ?? null);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [meta.avatar_path]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uid) return;
    if (!file.type.startsWith("image/")) {
      setMsg({ kind: "err", text: "Please choose an image file." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${uid}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setBusy(false);
      setMsg({ kind: "err", text: upErr.message });
      return;
    }
    // remove previous file (best-effort)
    if (meta.avatar_path && meta.avatar_path !== path) {
      await supabase.storage.from("avatars").remove([meta.avatar_path]);
    }
    const { error: updErr } = await supabase.auth.updateUser({
      data: { avatar_path: path },
    });
    setBusy(false);
    if (updErr) {
      setMsg({ kind: "err", text: updErr.message });
      return;
    }
    setMsg({ kind: "ok", text: "Profile photo updated." });
  }

  async function handleRemove() {
    if (!meta.avatar_path) return;
    setBusy(true);
    setMsg(null);
    await supabase.storage.from("avatars").remove([meta.avatar_path]);
    const { error } = await supabase.auth.updateUser({
      data: { avatar_path: null, avatar_url: null },
    });
    setBusy(false);
    if (error) {
      setMsg({ kind: "err", text: error.message });
      return;
    }
    setPreviewUrl(null);
    setMsg({ kind: "ok", text: "Profile photo removed." });
  }

  return (
    <SettingsCard title="Profile Photo" description="Upload or change your profile photo.">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary-glow text-3xl font-black text-primary-foreground shadow-md">
          {previewUrl ? (
            <img src={previewUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <User className="h-10 w-10" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <label className="inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm hover:brightness-105 disabled:opacity-70">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {previewUrl ? "Change photo" : "Upload photo"}
            <input
              type="file"
              accept="image/*"
              onChange={handleFile}
              disabled={busy}
              className="hidden"
            />
          </label>
          {previewUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-70"
            >
              <Trash2 className="h-4 w-4" /> Remove photo
            </button>
          )}
          {msg && (
            <p
              className={
                msg.kind === "ok"
                  ? "text-sm text-primary"
                  : "text-sm text-destructive"
              }
            >
              {msg.text}
            </p>
          )}
          <p className="text-xs text-muted-foreground">PNG or JPG, up to a few MB.</p>
        </div>
      </div>
    </SettingsCard>
  );
}
