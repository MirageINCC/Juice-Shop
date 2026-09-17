import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/api/client";
import { issueStock, setStock } from "@/api/inventory";
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

export type StockDialogMode = "issue" | "set";

interface StockDialogProps {
  mode: StockDialogMode;
  item: Item;
  onClose: () => void;
}

/**
 * Ausbuchen und Stand setzen sind dasselbe Formular mit unterschiedlicher Rechnung:
 * einmal ist die Eingabe eine Entnahme, einmal der neue Absolutwert. Beide zeigen den
 * aktuellen Stand und rechnen das Ergebnis live vor.
 */
export function StockDialog({ mode, item, onClose }: StockDialogProps) {
  const { apply } = useInventory();
  const [value, setValue] = useState(mode === "set" ? String(item.stock) : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number.parseInt(value, 10);
  const valid = Number.isFinite(parsed) && parsed >= (mode === "issue" ? 1 : 0);
  const nextStock = !valid ? item.stock : mode === "issue" ? item.stock - parsed : parsed;
  const tooMany = mode === "issue" && valid && parsed > item.stock;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid || tooMany) return;
    setSubmitting(true);
    setError(null);
    try {
      apply(mode === "issue" ? await issueStock(item.id, parsed) : await setStock(item.id, parsed));
      toast.success(
        mode === "issue"
          ? `${parsed} × ${item.name} ausgebucht.`
          : `${item.name} steht jetzt auf ${parsed}.`,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "issue" ? `${item.name} ausbuchen` : `Stand von ${item.name} aktualisieren`}
          </DialogTitle>
          <DialogDescription>
            {mode === "issue"
              ? "Die Menge wird vom Bestand abgezogen und als Abgang protokolliert."
              : "Der Bestand wird auf den eingegebenen Wert gesetzt. Die Differenz wird protokolliert."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="flex items-center gap-4 rounded-lg border border-border bg-white/[0.02] p-3">
            <ItemThumb src={item.imagePath} alt="" size={56} />
            <div>
              <p className="text-xs text-muted-foreground">Aktueller Bestand</p>
              <p className="font-mono text-2xl tabular-nums">{item.stock}</p>
            </div>
          </div>

          <label className="grid gap-1.5 text-sm font-semibold">
            {mode === "issue" ? "Menge ausbuchen" : "Neuer Bestand"}
            <Input
              type="number"
              inputMode="numeric"
              min={mode === "issue" ? 1 : 0}
              max={mode === "issue" ? item.stock : undefined}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
              required
            />
          </label>

          <p className="text-sm text-muted-foreground">
            {mode === "issue" ? "Neuer Bestand: " : "Veränderung: "}
            <span className="font-mono tabular-nums text-foreground">
              {mode === "issue"
                ? nextStock
                : `${nextStock - item.stock >= 0 ? "+" : ""}${nextStock - item.stock}`}
            </span>
          </p>

          {tooMany && (
            <p className="text-sm font-semibold text-destructive">
              Es sind nur {item.stock} Stück vorhanden.
            </p>
          )}
          {error && <p className="text-sm font-semibold text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={submitting || !valid || tooMany}>
              {mode === "issue" ? "Ausbuchen" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
