import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/api/client";
import { craftJuices } from "@/api/inventory";
import type { Inventory } from "@/api/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInventory } from "./InventoryContext";

export function CraftDialog({ data, onClose }: { data: Inventory; onClose: () => void }) {
  const { apply } = useInventory();
  const [value, setValue] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const juiceCount = data.items.filter((item) => item.kind === "JUICE").length;
  const byslug = new Map(data.items.map((item) => [item.slug, item]));

  const parsed = Number.parseInt(value, 10);
  const valid = Number.isFinite(parsed) && parsed >= 1;
  const tooMany = valid && parsed > data.craftable;
  const runs = valid ? parsed : 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid || tooMany) return;
    setSubmitting(true);
    setError(null);
    try {
      apply(await craftJuices(parsed));
      toast.success(
        `${parsed} × hergestellt — je Sorte +${data.yieldPerRun * parsed} Juices.`,
      );
      onClose();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Herstellen fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Juices herstellen</DialogTitle>
          <DialogDescription>
            Ein Durchlauf verbraucht Früchte und Gemüse und bringt je Saftsorte{" "}
            {data.yieldPerRun} Stück. Mit dem aktuellen Rohstoffbestand sind{" "}
            <span className="font-mono tabular-nums">{data.craftable}</span> Durchläufe möglich.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="grid gap-1.5 text-sm font-semibold">
            Anzahl Durchläufe
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={data.craftable || undefined}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
              required
            />
          </label>

          <div className="grid gap-2 rounded-lg border border-border bg-white/[0.02] p-3 text-sm">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Verbraucht
            </p>
            {data.recipe.map((entry) => {
              const item = byslug.get(entry.slug);
              const need = entry.amount * runs;
              const short = item ? need > item.stock : true;
              return (
                <div key={entry.slug} className="flex justify-between gap-3">
                  <span>{item?.name ?? entry.slug}</span>
                  <span
                    className={`font-mono tabular-nums ${short ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    −{need} <span className="opacity-60">von {item?.stock ?? 0}</span>
                  </span>
                </div>
              );
            })}
            <div className="mt-1 border-t border-border pt-2">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Ergibt
              </p>
              <p className="mt-1 flex justify-between gap-3">
                <span>Je Saftsorte ({juiceCount} Sorten)</span>
                <span className="font-mono text-brand-light tabular-nums">
                  +{data.yieldPerRun * runs}
                </span>
              </p>
            </div>
          </div>

          {tooMany && (
            <p className="text-sm font-semibold text-destructive">
              {data.craftable === 0
                ? "Die Rohstoffe reichen für keinen Durchlauf."
                : `Die Rohstoffe reichen nur für ${data.craftable} Durchläufe.`}
            </p>
          )}
          {error && <p className="text-sm font-semibold text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={submitting || !valid || tooMany}>
              Herstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
