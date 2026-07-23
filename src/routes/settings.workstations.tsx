import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { SettingsCard, SettingsGate } from "@/components/settings/shared";
import {
  generateWorkstationIds,
  useUpdateWorkstationType,
  useWorkstationTypes,
  type WorkstationType,
} from "@/lib/api/workstations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/settings/workstations")({
  head: () => ({ meta: [{ title: "Workstations — Settings" }] }),
  component: () => (
    <SettingsGate permission="settings.edit">
      <WorkstationsSettings />
    </SettingsGate>
  ),
});

function WorkstationsSettings() {
  const { data, isLoading } = useWorkstationTypes();

  return (
    <SettingsCard
      title="Workstations"
      description="Configure the physical machines and working positions in your factory. IDs are generated automatically from the prefix and count."
    >
      {isLoading || !data ? (
        <div className="grid place-items-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((w) => (
            <WorkstationRow key={w.id} type={w} />
          ))}
        </div>
      )}
    </SettingsCard>
  );
}

function WorkstationRow({ type }: { type: WorkstationType }) {
  const [prefix, setPrefix] = useState(type.prefix);
  const [count, setCount] = useState<number>(type.count);
  const update = useUpdateWorkstationType();

  useEffect(() => {
    setPrefix(type.prefix);
    setCount(type.count);
  }, [type.prefix, type.count]);

  const ids = generateWorkstationIds(prefix, count);
  const dirty = prefix !== type.prefix || count !== type.count;
  const valid = prefix.trim().length > 0 && count >= 0 && count <= 200;

  const onSave = async () => {
    try {
      await update.mutateAsync({ id: type.id, prefix: prefix.trim(), count });
      toast.success(`${type.label} updated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">{type.label}</h3>
          <p className="text-xs text-muted-foreground">
            {ids.length} workstation{ids.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button size="sm" onClick={onSave} disabled={!dirty || !valid || update.isPending}>
          {update.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="mr-1.5 h-4 w-4" /> Save
            </>
          )}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[120px_160px]">
        <div>
          <Label htmlFor={`prefix-${type.id}`} className="text-xs">Prefix</Label>
          <Input
            id={`prefix-${type.id}`}
            value={prefix}
            maxLength={4}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
          />
        </div>
        <div>
          <Label htmlFor={`count-${type.id}`} className="text-xs">Workstation count</Label>
          <Input
            id={`count-${type.id}`}
            type="number"
            min={0}
            max={200}
            value={count}
            onChange={(e) => setCount(Math.max(0, Math.min(200, Number(e.target.value) || 0)))}
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-muted-foreground">Preview</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ids.length === 0 ? (
            <span className="text-xs text-muted-foreground">No workstations</span>
          ) : (
            ids.map((id) => (
              <span
                key={id}
                className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-mono"
              >
                {id}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
