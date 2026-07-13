import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

export type WorkAreaPayload = {
  garmentPart: string;
  workArea: string | null;
  customArea: string | null;
  workers: string[];
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
const TOP_AREAS = ["Front Body", "Back Body", "Sleeve", "Other"] as const;

export function formatWorkArea(
  garmentPart: string | null,
  workArea: string | null,
  customArea: string | null,
): string | null {
  if (!garmentPart) return null;
  const area = workArea === "Other" ? customArea?.trim() || "Other" : workArea;
  return area ? `${garmentPart} • ${area}` : garmentPart;
}

export function WorkAreaDialog({
  operationName,
  workerOptions,
  initialWorkers,
  busy,
  onCancel,
  onConfirm,
}: {
  operationName: string;
  workerOptions: string[];
  initialWorkers?: string[];
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (payload: WorkAreaPayload) => void;
}) {
  const [garmentPart, setGarmentPart] = useState<string>("");
  const [workArea, setWorkArea] = useState<string>("");
  const [customArea, setCustomArea] = useState<string>("");
  const [workers, setWorkers] = useState<string[]>(initialWorkers ?? []);

  useEffect(() => {
    // Reset area when garment part changes away from Top
    if (garmentPart !== "Top") {
      setWorkArea("");
      setCustomArea("");
    }
  }, [garmentPart]);

  const requiresArea = garmentPart === "Top";
  const areaOk = !requiresArea || (workArea && (workArea !== "Other" || customArea.trim().length > 0));
  const canStart = Boolean(garmentPart) && areaOk && workers.length > 0 && !busy;

  function toggleWorker(w: string) {
    setWorkers((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Start Operation</p>
            <h3 className="text-base font-bold">{operationName}</h3>
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
            {GARMENT_PARTS.map((p) => (
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

        {/* Step 2 — Conditional Area (Top only) */}
        {requiresArea && (
          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Area</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {TOP_AREAS.map((a) => (
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

        {/* Step 3 — Workers */}
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Assigned Workers</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {workerOptions.map((w) => {
              const active = workers.includes(w);
              return (
                <button
                  key={w}
                  onClick={() => toggleWorker(w)}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-semibold transition " +
                    (active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-accent")
                  }
                >
                  {w}
                </button>
              );
            })}
          </div>
          {workers.length === 0 && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">Select at least one worker.</p>
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
