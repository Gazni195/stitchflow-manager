import { useEffect, useState } from "react";
import { ArrowRight, Loader2, X } from "lucide-react";

export type WorkAreaPayload = {
  garmentPart: string;
  workArea: string | null;
  customArea: string | null;
  workers: string[];
  // Only present when the dialog was opened in editable-name mode (the
  // "Other" custom operation card in Select Operation).
  operationName?: string;
};

export const AREA_TRACKED_OPERATION_IDS = new Set<string>([
  "cutting",
  "sample-cutting",
  "stitching",
  "sample-stitching",
  "handwork",
  "sample-handwork",
  "machine-embroidery",
  "bulk-embroidery",
]);

const GARMENT_PARTS = ["Top", "Pant", "Dupatta", "Full Garment"] as const;
const TOP_AREAS = ["Full Body", "Front Body", "Back Body", "Sleeve", "Yoke", "Other"] as const;

// Sample Cutting gets its own Garment Part / Area lists — every other
// operation (Sample Hand Work, Sample Stitching, Machine Embroidery, any
// custom operation) keeps the two lists above unchanged. Each operation is
// expected to eventually get its own operation-specific workflow; this is
// just the first one.
const CUTTING_GARMENT_PARTS = ["Full Garment", "Top", "Pant", "Short", "Dupatta", "Other"] as const;
const CUTTING_TOP_AREAS = ["Front Body", "Back Body", "Sleeve", "Yoke", "Full Body"] as const;

export function formatWorkArea(
  garmentPart: string | null,
  workArea: string | null,
  customArea: string | null,
): string | null {
  if (!garmentPart) return null;
  const area = workArea === "Other" ? customArea?.trim() || "Other" : workArea;
  return area ? `${garmentPart} • ${area}` : garmentPart;
}

// Best-effort initials for the circular avatar — first letter of the first
// and last name, e.g. "Ameen Khan" -> "AK", a single-word name -> just that
// letter. There is no photo source yet (ERPNext's active-employees response
// only carries name/status today), so every avatar renders as initials for
// now; once ERPNext exposes a photo per employee, swap the rendered <span>
// below for an <img> when a URL is present, falling back to this same
// initials logic — nothing about the surrounding dialog needs to change.
function workerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

// Step 1 of Start Operation: who's doing it. Deliberately separate from
// Garment Part (WorkAreaDialog below) so the two can be answered as two
// short, focused, mobile-friendly screens instead of one long form.
//
// `workerOptions` is expected to already be "eligible for this operation" —
// today that's simply every Active ERPNext employee (useActiveErpWorkers),
// since ERPNext doesn't yet expose a department/skill mapping per
// operation. Once it does, filter workerOptions by operation before it
// reaches this component (e.g. in a useEligibleWorkers(operationId) hook) —
// this dialog just renders whatever list it's given, so no UI change is
// needed when that filtering becomes real.
export function WorkerSelectionDialog({
  operationName,
  operationNameEditable,
  workerOptions,
  busy,
  onCancel,
  onConfirm,
}: {
  operationName: string;
  // When true, the header shows a text input instead of a static title —
  // the "Other" custom-operation flow types its name here, once, before
  // picking workers. The Garment Part step afterwards only ever displays
  // the name, already finalized.
  operationNameEditable?: boolean;
  workerOptions: string[];
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (result: { workers: string[]; operationName?: string }) => void;
}) {
  const [workers, setWorkers] = useState<string[]>([]);
  const [customOperationName, setCustomOperationName] = useState(operationName);

  const nameOk = !operationNameEditable || customOperationName.trim().length > 0;
  const canContinue = workers.length > 0 && nameOk && !busy;

  function toggleWorker(w: string) {
    setWorkers((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Start Operation</p>
            {operationNameEditable ? (
              <input
                autoFocus
                value={customOperationName}
                onChange={(e) => setCustomOperationName(e.target.value)}
                placeholder="Operation Name"
                className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-base font-bold outline-none focus:border-primary"
              />
            ) : (
              <h3 className="text-base font-bold">{operationName}</h3>
            )}
            <p className="mt-0.5 text-xs font-semibold text-primary">Select Worker(s)</p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          {workerOptions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-background p-4 text-center text-xs text-muted-foreground">
              No eligible workers found for this operation.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {workerOptions.map((w) => {
                const active = workers.includes(w);
                return (
                  <button key={w} onClick={() => toggleWorker(w)} className="flex flex-col items-center gap-1.5">
                    <span
                      className={
                        "grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 text-sm font-bold transition " +
                        (active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-primary-soft text-primary hover:border-primary/40")
                      }
                    >
                      {workerInitials(w)}
                    </span>
                    <span className="max-w-[4.5rem] truncate text-[11px] font-semibold text-foreground">{w}</span>
                  </button>
                );
              })}
            </div>
          )}
          {workerOptions.length > 0 && workers.length === 0 && (
            <p className="mt-3 text-[11px] text-muted-foreground">Select at least one worker.</p>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onConfirm({
                workers,
                ...(operationNameEditable ? { operationName: customOperationName.trim() } : {}),
              })
            }
            disabled={!canContinue}
            className="inline-flex flex-[2] items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Continue <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Step 2 of Start Operation: where on the garment. Workers are already
// decided by this point (WorkerSelectionDialog above) and passed straight
// through to `onConfirm` unchanged — this dialog only ever asks about
// Garment Part and, inline in the same popup for Sample Cutting's "Top",
// Area. There is deliberately no third popup for Area.
export function WorkAreaDialog({
  operationId,
  operationName,
  workers,
  busy,
  onCancel,
  onConfirm,
}: {
  // Selects which Garment Part / Area lists to show — Sample Cutting only
  // for now (see CUTTING_GARMENT_PARTS/CUTTING_TOP_AREAS above). null for
  // the "Other" custom-operation flow, which always uses the default lists.
  operationId: string | null;
  operationName: string;
  workers: string[];
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (payload: WorkAreaPayload) => void;
}) {
  const isSampleCutting = operationId === "sample-cutting";
  const garmentParts = isSampleCutting ? CUTTING_GARMENT_PARTS : GARMENT_PARTS;
  const topAreas = isSampleCutting ? CUTTING_TOP_AREAS : TOP_AREAS;

  const [garmentPart, setGarmentPart] = useState<string>("");
  const [workArea, setWorkArea] = useState<string>("");
  const [customArea, setCustomArea] = useState<string>("");

  useEffect(() => {
    // Reset area when garment part changes away from Top
    if (garmentPart !== "Top") {
      setWorkArea("");
      setCustomArea("");
    }
  }, [garmentPart]);

  const requiresArea = garmentPart === "Top";
  const areaOk = !requiresArea || (workArea && (workArea !== "Other" || customArea.trim().length > 0));
  const canStart = Boolean(garmentPart) && areaOk && !busy;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Start Operation</p>
            <h3 className="text-base font-bold">{operationName}</h3>
            <p className="mt-0.5 text-xs font-semibold text-primary">Select Garment Part</p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step 1 — Garment Part */}
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Garment Part</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {garmentParts.map((p) => (
              <button
                key={p}
                onClick={() => setGarmentPart(p)}
                className={
                  "rounded-xl border px-3 py-2.5 text-sm font-semibold transition " +
                  (garmentPart === p
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-accent")
                }
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2 — Conditional Area (Top only), inline in this same popup */}
        {requiresArea && (
          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Area</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {topAreas.map((a) => (
                <button
                  key={a}
                  onClick={() => setWorkArea(a)}
                  className={
                    "rounded-xl border px-3 py-2 text-sm font-semibold transition " +
                    (workArea === a
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-accent")
                  }
                >
                  {a}
                </button>
              ))}
            </div>
            {workArea === "Other" && (
              <input
                autoFocus
                value={customArea}
                onChange={(e) => setCustomArea(e.target.value)}
                placeholder="Enter area name (e.g. Yoke, Collar)"
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            )}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onConfirm({
                garmentPart,
                workArea: requiresArea ? workArea : null,
                customArea: requiresArea && workArea === "Other" ? customArea.trim() : null,
                workers,
              })
            }
            disabled={!canStart}
            className="inline-flex flex-[2] items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} ▶ Start Operation
          </button>
        </div>
      </div>
    </div>
  );
}
