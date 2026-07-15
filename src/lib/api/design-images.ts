// Design Details page's image gallery. Separate from designs.image_path
// (the single "cover" thumbnail used elsewhere in the app, e.g. the
// Designs list) — this table lets a design carry several labelled images
// shown only in the compact gallery popup, without touching that existing
// cover-image flow. Reuses the same "design-images" Storage bucket and the
// same per-user-folder upload convention already used for the cover image
// (path always starts with "<uid>/..."), so no new bucket or storage
// policy was needed.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Temporary cast until the design_images migration regenerates Supabase types.
const designImagesTable = () => (supabase as any).from("design_images");

export const DESIGN_IMAGE_LABELS = [
  "Front View",
  "Back View",
  "Side View",
  "Close-up Detail",
  "Embroidery Detail",
  "Other",
] as const;

export type DesignImageRow = {
  id: string;
  designId: string;
  path: string;
  label: string;
  sortOrder: number;
};

type DbDesignImage = {
  id: string;
  design_id: string;
  path: string;
  label: string;
  sort_order: number;
};

function mapImage(r: DbDesignImage): DesignImageRow {
  return { id: r.id, designId: r.design_id, path: r.path, label: r.label, sortOrder: r.sort_order };
}

export function useDesignImages(designId: string | undefined) {
  return useQuery({
    queryKey: ["design-images", designId],
    enabled: !!designId,
    queryFn: async (): Promise<DesignImageRow[]> => {
      const { data, error } = await designImagesTable()
        .select("id, design_id, path, label, sort_order")
        .eq("design_id", designId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as DbDesignImage[]).map(mapImage);
    },
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, designId: string) {
  qc.invalidateQueries({ queryKey: ["design-images", designId] });
}

// Uploads one or more files under one label in a single action.
export function useAddDesignImages(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { files: File[]; label: string; startSortOrder: number }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      const rows: { design_id: string; path: string; label: string; sort_order: number; created_by: string }[] = [];
      for (let i = 0; i < v.files.length; i++) {
        const file = v.files[i];
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("design-images").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        rows.push({
          design_id: designId,
          path,
          label: v.label,
          sort_order: v.startSortOrder + i,
          created_by: user.id,
        });
      }
      const { error } = await designImagesTable().insert(rows);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc, designId),
  });
}

// Swaps the file behind an existing row — same row, same position in the
// gallery, just a new image — and removes the old file from storage.
export function useReplaceDesignImage(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; oldPath: string; file: File }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");
      const ext = v.file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("design-images").upload(path, v.file, { upsert: false });
      if (upErr) throw upErr;
      const { error } = await designImagesTable().update({ path }).eq("id", v.id);
      if (error) throw error;
      await supabase.storage.from("design-images").remove([v.oldPath]);
    },
    onSuccess: () => invalidate(qc, designId),
  });
}

export function useUpdateDesignImageLabel(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; label: string }) => {
      const { error } = await designImagesTable().update({ label: v.label }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc, designId),
  });
}

export function useDeleteDesignImage(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; path: string }) => {
      const { error } = await designImagesTable().delete().eq("id", v.id);
      if (error) throw error;
      await supabase.storage.from("design-images").remove([v.path]);
    },
    onSuccess: () => invalidate(qc, designId),
  });
}

// One signed URL per path, fetched together — a gallery needs several at
// once, so this batches instead of firing one query per thumbnail.
export function useDesignImageUrls(paths: string[]) {
  const key = paths.join("|");
  return useQuery({
    queryKey: ["design-image-urls", key],
    enabled: paths.length > 0,
    staleTime: 55 * 60 * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const entries = await Promise.all(
        paths.map(async (p) => {
          const { data, error } = await supabase.storage.from("design-images").createSignedUrl(p, 60 * 60);
          return [p, error ? "" : (data?.signedUrl ?? "")] as const;
        }),
      );
      return Object.fromEntries(entries.filter(([, url]) => url));
    },
  });
}
