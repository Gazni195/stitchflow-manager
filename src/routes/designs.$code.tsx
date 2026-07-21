import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Factory,
  FlaskConical,
  Image as ImageIcon,
  Layers,
  Loader2,
  MoreVertical,
  Palette,
  Pencil,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
  X,
  XCircle,
  ZoomIn,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DesignActionsMenu, EditDesignDialog } from "@/components/DesignActionsMenu";
import { useRequireAuth } from "@/hooks/use-auth";
import { STATUS_LABEL, STATUS_TONE, type Design } from "@/lib/designs";
import { useApproveDesign, useDesignByCode, useRejectDesign } from "@/lib/api/designs";
import { useWorkflows, stepLabel, type DesignWorkflow, type StepStatus } from "@/lib/api/workflows";
import { useOperationCatalog } from "@/lib/api/operations";
import {
  DESIGN_IMAGE_LABELS,
  useAddDesignImages,
  useDeleteDesignImage,
  useDesignImages,
  useDesignImageUrls,
  useReplaceDesignImage,
  type DesignImageRow,
} from "@/lib/api/design-images";

export const Route = createFileRoute("/designs/$code")({
  head: ({ params }) => ({
    meta: [{ title: `${params.code} — Fawri Lifestyle` }],
  }),
  component: DesignDetailsPage,
});

function DesignDetailsPage() {
  useRequireAuth();
  const { code } = Route.useParams();
  const { data: design, isLoading } = useDesignByCode(code);

  if (isLoading) {
    return (
      <AppShell title="Design">
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!design) {
    return (
      <AppShell title="Design not found" subtitle={code}>
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No design with code <span className="font-semibold">{code}</span>.
          </p>
          <Link
            to="/designs"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to designs
          </Link>
        </div>
      </AppShell>
    );
  }
  return <DesignDetails design={design} />;
}

function DesignDetails({ design }: { design: Design }) {
  const navigate = useNavigate();
  const { data: workflows = [], isLoading: wfLoading } = useWorkflows(design.id);
  const { data: catalog = [] } = useOperationCatalog();
  const sample = workflows.find((w) => w.kind === "sample");
  const bulk = workflows.find((w) => w.kind === "bulk");
  const approveDesign = useApproveDesign();

  const active = bulk ?? sample;
  const total = active?.steps.length ?? 0;
  const done = active?.steps.filter((s) => s.status === "completed").length ?? 0;
  const progress = total ? Math.round((done / total) * 100) : 0;

  // Rejected is its own state, not just "not approved yet": Sample
  // Development stays blocked until Design Approval runs again (same
  // useApproveDesign action as the very first approval — no separate
  // re-approve flow).
  const isRejected = design.status === "design_rejected";
  const isApproved = design.status !== "draft" && !isRejected;

  return (
    <AppShell
      title={design.name}
      subtitle={`${design.code} · ${design.customer}`}
      action={
        <div className="flex items-center gap-2">
          <Link
            to="/designs/$code/workflow"
            params={{ code: design.code }}
            className="hidden items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-accent sm:inline-flex"
          >
            <Settings2 className="h-4 w-4" /> Configure Workflow
          </Link>
          <DesignActionsMenu design={design} />
        </div>
      }
    >
      <div className="grid gap-5">
        <Link
          to="/designs"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All designs
        </Link>

        {/* Hero — design info leads; images are one compact tap away, not a
            full-width photo dominating the top of the page. */}
        <section className="grid gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Production Status</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{design.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{design.code}</span> · For{" "}
                <span className="font-semibold text-foreground">{design.customer}</span>
              </p>
            </div>
            <span className={"shrink-0 rounded-full px-3 py-1 text-xs font-semibold " + STATUS_TONE[design.status]}>
              {STATUS_LABEL[design.status]}
            </span>
          </div>

          <DesignImagesButton designId={design.id} designName={design.name} coverPath={design.imagePath} />

          <div className="rounded-2xl border border-border bg-gradient-to-br from-primary-soft to-background p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{bulk ? "Bulk progress" : "Sample progress"}</span>
              <span className="text-lg font-extrabold text-primary">{progress}%</span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {done} of {total} steps complete
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Fact icon={Users} label="Customer" value={design.customer} />
            <Fact icon={Factory} label="Order Qty" value={design.orderQuantity.toLocaleString()} />
            <Fact
              icon={Layers}
              label="Fabrics"
              value={
                design.parts
                  .map((p) => p.fabric)
                  .filter(Boolean)
                  .join(", ") || "—"
              }
            />
            <Fact icon={Palette} label="Color" value={design.color || "—"} />
            <Fact icon={CalendarDays} label="Category" value={design.category || "—"} />
            <Fact icon={Users} label="Created" value={formatDate(design.createdAt)} />
          </div>
        </section>

        {/* Lifecycle actions */}
        <section className="grid gap-3 rounded-3xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <ShieldCheck className="h-4 w-4 text-primary" /> Design approval
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isRejected
                ? "This design was rejected. Approve it again to resume sample development."
                : isApproved
                  ? "Design approved — visible in Sample Development."
                  : "Approve this design to move it into sample development."}
            </p>
            {isApproved ? (
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-success/15 px-4 py-2 text-sm font-bold text-success">
                  <CheckCircle2 className="h-4 w-4" /> Design Approved
                </span>
                <DesignApprovalMenu design={design} />
              </div>
            ) : (
              <button
                disabled={approveDesign.isPending}
                onClick={() => approveDesign.mutate({ id: design.id, code: design.code })}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-success px-4 py-2 text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                {approveDesign.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Approve Design
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <FlaskConical className="h-4 w-4 text-primary" /> Sample Development
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isApproved
                ? "Track materials, costing and sample workflow steps."
                : "Approve this design first to start sample development."}
            </p>
            <button
              disabled={!isApproved}
              onClick={() => navigate({ to: "/sample-development/$code", params: { code: design.code } })}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
            >
              <FlaskConical className="h-4 w-4" /> Start Sample Development
            </button>
          </div>
        </section>

        {/* Workflow cards */}
        {wfLoading ? (
          <div className="grid place-items-center py-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            {sample && <WorkflowCard title="Sample Workflow" wf={sample} designCode={design.code} catalog={catalog} />}
            {bulk && (
              <WorkflowCard title="Bulk Production Workflow" wf={bulk} designCode={design.code} catalog={catalog} />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

// Beside the "Design Approved" status once approved: Edit reuses the exact
// same dialog as the top-bar Design actions menu (no second edit flow), and
// Reject is the only way back out of the approved state — a direct status
// flip via useRejectDesign, mirroring useApproveDesign's directness rather
// than adding a confirmation step the Approve action doesn't have either.
function DesignApprovalMenu({ design }: { design: Design }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const reject = useRejectDesign();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <>
      <div ref={wrapRef} className="relative">
        <button
          aria-label="Design approval actions"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {open && (
          <div className="absolute right-0 top-11 z-40 w-48 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <button
              onClick={() => {
                setOpen(false);
                setEdit(true);
              }}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold hover:bg-accent"
            >
              <Pencil className="h-4 w-4 text-primary" /> Edit Design
            </button>
            <button
              disabled={reject.isPending}
              onClick={() => {
                setOpen(false);
                reject.mutate({ id: design.id, code: design.code });
              }}
              className="flex w-full items-center gap-2.5 border-t border-border px-4 py-3 text-left text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              {reject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Reject Design
            </button>
          </div>
        )}
      </div>

      {edit && <EditDesignDialog design={design} onClose={() => setEdit(false)} />}
    </>
  );
}

function WorkflowCard({
  title,
  wf,
  designCode,
  catalog,
}: {
  title: string;
  wf: DesignWorkflow;
  designCode: string;
  catalog: ReturnType<typeof useOperationCatalog>["data"];
}) {
  const opBy = new Map((catalog ?? []).map((o) => [o.id, o]));

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {wf.steps.length} steps · {wf.locked ? "Locked" : "Editable"}
          </p>
        </div>
        {!wf.locked && (
          <Link
            to="/designs/$code/workflow"
            params={{ code: designCode }}
            search={{ kind: wf.kind }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent"
          >
            <Pencil className="h-3.5 w-3.5" /> Configure
          </Link>
        )}
      </div>

      {wf.steps.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
          No steps yet. Configure the workflow to add operations.
        </p>
      ) : (
        <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {wf.steps.map((step) => {
            const op = opBy.get(step.operationId);
            const Icon = op?.icon;
            const label = stepLabel(step, wf.steps, op?.name ?? step.operationId);
            return (
              <li key={step.id} className={"flex items-center gap-3 rounded-2xl border p-3 " + tone(step.status)}>
                <div
                  className={
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-bold " + chip(step.status)
                  }
                >
                  {Icon ? <Icon className="h-4 w-4" /> : step.sequence}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    <span className="mr-1 text-muted-foreground">{step.sequence}.</span>
                    {label}
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {statusLabel(step.status)}
                    {step.assignedTo ? ` · ${step.assignedTo}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function tone(s: StepStatus) {
  if (s === "completed") return "border-primary/30 bg-primary-soft";
  if (s === "in-progress") return "border-primary bg-primary/10";
  if (s === "skipped") return "border-dashed border-border bg-background opacity-60";
  return "border-border bg-background";
}
function chip(s: StepStatus) {
  if (s === "completed") return "bg-primary text-primary-foreground";
  if (s === "in-progress") return "bg-primary text-primary-foreground ring-4 ring-primary/20";
  if (s === "skipped") return "bg-muted text-muted-foreground line-through";
  return "bg-muted text-muted-foreground";
}
function statusLabel(s: StepStatus) {
  return s === "in-progress" ? "In progress" : s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------- Design images (compact preview + full-screen gallery) ---------- */
//
// Separate from designs.image_path (the single "cover" thumbnail used
// elsewhere, e.g. the Designs list) — this is its own small gallery of
// labelled images (Front View, Back View, ...) for this one page. Only a
// small thumbnail + count ever shows inline; everything else (the large
// preview, add/replace/delete) only appears once the popup is opened, so
// images never compete with Design Information / Workflow for space.

function DesignImagesButton({
  designId,
  designName,
  coverPath,
}: {
  designId: string;
  designName: string;
  coverPath: string | null | undefined;
}) {
  const { data: dbImages = [] } = useDesignImages(designId);
  const [open, setOpen] = useState(false);

  // Merge the design's cover image (designs.image_path — the same file shown
  // on the Designs list) as a synthetic first entry so the gallery isn't
  // empty when only the cover exists. Skip if the cover was already added
  // separately as a labelled gallery image.
  const images: DesignImageRow[] = useMemo(() => {
    if (!coverPath) return dbImages;
    if (dbImages.some((i) => i.path === coverPath)) return dbImages;
    const cover: DesignImageRow = {
      id: "__cover__",
      designId,
      path: coverPath,
      label: "Cover",
      sortOrder: -1,
    };
    return [cover, ...dbImages];
  }, [coverPath, dbImages, designId]);

  const firstPath = images[0]?.path;
  const { data: urls = {} } = useDesignImageUrls(firstPath ? [firstPath] : []);
  const thumbUrl = firstPath ? urls[firstPath] : undefined;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex w-fit items-center gap-3 rounded-2xl border border-border bg-background px-3 py-2 text-left hover:border-primary/40 hover:bg-primary-soft/30"
      >
        <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary-soft text-primary">
          {thumbUrl ? (
            <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 opacity-70" />
          )}
        </span>
        <span>
          <span className="block text-sm font-bold">
            {images.length > 0 ? `🖼 Images (${images.length})` : "📷 Add Images"}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {images.length > 0 ? "Tap to view gallery" : "No images yet — tap to add"}
          </span>
        </span>
      </button>

      {open && (
        <DesignImageGallery
          designId={designId}
          designName={designName}
          images={images}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function DesignImageGallery({
  designId,
  designName,
  images,
  onClose,
}: {
  designId: string;
  designName: string;
  images: DesignImageRow[];
  onClose: () => void;
}) {
  const paths = images.map((i) => i.path);
  const { data: urls = {} } = useDesignImageUrls(paths);
  const addImages = useAddDesignImages(designId);
  const replaceImage = useReplaceDesignImage(designId);
  const deleteImage = useDeleteDesignImage(designId);

  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [showAdd, setShowAdd] = useState(images.length === 0);
  const [addLabel, setAddLabel] = useState<string>(DESIGN_IMAGE_LABELS[0]);
  const [customLabel, setCustomLabel] = useState("");
  const replaceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeIndex >= images.length) setActiveIndex(Math.max(0, images.length - 1));
  }, [images.length, activeIndex]);

  const active = images[activeIndex] as DesignImageRow | undefined;
  const activeUrl = active ? urls[active.path] : undefined;

  function next() {
    setZoomed(false);
    setActiveIndex((i) => (i + 1) % images.length);
  }
  function prev() {
    setZoomed(false);
    setActiveIndex((i) => (i - 1 + images.length) % images.length);
  }

  async function handleAddFiles(files: FileList | null) {
    console.log("[DesignImages] onChange fired, files:", files);
    if (!files || files.length === 0) {
      console.warn("[DesignImages] No files selected");
      return;
    }
    const label = addLabel === "Other" && customLabel.trim() ? customLabel.trim() : addLabel;
    const fileArr = Array.from(files);
    console.log("[DesignImages] Uploading", fileArr.length, "file(s), label:", label, fileArr);
    try {
      await addImages.mutateAsync({ files: fileArr, label, startSortOrder: images.length });
      console.log("[DesignImages] Upload complete");
      toast.success(`Uploaded ${fileArr.length} image${fileArr.length > 1 ? "s" : ""}`);
      setShowAdd(false);
      setCustomLabel("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[DesignImages] Upload failed:", err);
      toast.error(`Upload failed: ${msg}`);
    }
  }

  async function handleReplaceFile(files: FileList | null) {
    console.log("[DesignImages] Replace onChange, files:", files);
    if (!files || files.length === 0 || !active) return;
    try {
      await replaceImage.mutateAsync({ id: active.id, oldPath: active.path, file: files[0] });
      toast.success("Image replaced");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[DesignImages] Replace failed:", err);
      toast.error(`Replace failed: ${msg}`);
    }
  }

  async function handleDelete() {
    if (!active) return;
    if (!window.confirm(`Delete this image (${active.label})? This cannot be undone.`)) return;
    try {
      await deleteImage.mutateAsync({ id: active.id, path: active.path });
      toast.success("Image deleted");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[DesignImages] Delete failed:", err);
      toast.error(`Delete failed: ${msg}`);
    }
  }

  const busy = addImages.isPending || replaceImage.isPending || deleteImage.isPending;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{designName}</p>
          <p className="text-xs text-white/70">
            {images.length > 0 ? `${activeIndex + 1} of ${images.length} · ${active?.label}` : "No images yet"}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2">
        {images.length === 0 ? (
          <div className="grid place-items-center gap-2 text-center text-white/80">
            <ImageIcon className="h-10 w-10 opacity-60" />
            <p className="text-sm">No images yet</p>
          </div>
        ) : activeUrl ? (
          <div className={"grid h-full w-full place-items-center " + (zoomed ? "overflow-auto" : "overflow-hidden")}>
            <img
              src={activeUrl}
              alt={active?.label ?? ""}
              onClick={() => setZoomed((z) => !z)}
              className={
                zoomed ? "w-[180%] max-w-none cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in object-contain"
              }
            />
          </div>
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-white/70" />
        )}

        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto px-4 py-2">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => {
                setActiveIndex(i);
                setZoomed(false);
              }}
              className={
                "h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 " +
                (i === activeIndex ? "border-primary" : "border-transparent opacity-60")
              }
            >
              {urls[img.path] ? (
                <img src={urls[img.path]} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-white/10" />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-2 bg-black/60 px-4 py-3">
        {active && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setZoomed((z) => !z)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
            >
              <ZoomIn className="h-3.5 w-3.5" /> {zoomed ? "Zoom Out" : "Zoom"}
            </button>
            <button
              onClick={() => replaceInputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 px-3 py-2 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-50"
            >
              {replaceImage.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Replace
            </button>
            <input
              ref={replaceInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleReplaceFile(e.target.files)}
            />
            <button
              onClick={handleDelete}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/20 px-3 py-2 text-xs font-bold text-white hover:bg-destructive/30 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        )}

        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Add Image
          </button>
        ) : (
          <div className="grid gap-2 rounded-xl border border-white/15 bg-white/5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={addLabel}
                onChange={(e) => setAddLabel(e.target.value)}
                className="rounded-lg border border-white/20 bg-black/40 px-2.5 py-1.5 text-xs font-semibold text-white outline-none"
              >
                {DESIGN_IMAGE_LABELS.map((l) => (
                  <option key={l} value={l} className="text-foreground">
                    {l}
                  </option>
                ))}
              </select>
              {addLabel === "Other" && (
                <input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Custom label"
                  className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-white/40"
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90">
                {addImages.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Choose Files
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={addImages.isPending}
                  onChange={(e) => handleAddFiles(e.target.files)}
                />
              </label>
              <button
                onClick={() => setShowAdd(false)}
                className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
