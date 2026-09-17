import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/api/client";
import { bulkSetStock } from "@/api/inventory";
import type { Item } from "@/api/types";
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
import { ItemThumb } from "./ItemThumb";

/** Pflegt den Bestand mehrerer Artikel in einem Fenster — die Samen-Seite nutzt das. */
export function BulkSetDialog({
  title,
  items,
  onClose,
}: {
  title: string;
  items: Item[];
  onClose: () => void;
}) {
  const { apply } = useInventory();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, String(item.stock)])),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entries = items.map((item) => {
    const parsed = Number.parseInt(values[item.id] ?? "", 10);
    return { item, stock: parsed, valid: Number.isFinite(parsed) && parsed >= 0 };
  });
  const allValid = entries.every((entry) => entry.valid);
  const changed = entries.filter((entry) => entry.valid && entry.stock !== entry.item.stock);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!allValid) return;
    setSubmitting(true);
    setError(null);
    try {
      apply(await bulkSetStock(entries.map(({ item, stock }) => ({ id: item.id, stock }))));
      toast.success(
        changed.length === 0
          ? "Keine Änderung — Bestand war schon aktuell."
          : `${changed.length} ${changed.length === 1 ? "Sorte" : "Sorten"} aktualisiert.`,
      );
      onClose();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Speichern fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Trage für jede Sorte den tatsächlichen Bestand ein. Alle Änderungen werden zusammen
            gespeichert und protokolliert.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            {entries.map(({ item, valid }) => (
              <label
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-white/[0.02] p-2.5"
              >
                <ItemThumb src={item.imagePath} alt="" size={48} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.name}</span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  bisher {item.stock}
                </span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  required
                  aria-invalid={!valid}
                  className="w-24 min-w-0"
                  value={values[item.id] ?? ""}
                  onChange={(event) =>
                    setValues((previous) => ({ ...previous, [item.id]: event.target.value }))
                  }
                />
              </label>
            ))}
          </div>

          {error && <p className="text-sm font-semibold text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={submitting || !allValid}>
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
