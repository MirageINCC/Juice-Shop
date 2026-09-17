import { useEffect, useState } from "react";
import type { Item } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useInventory, itemsOfKind } from "@/inventory/InventoryContext";
import { ItemThumb } from "@/inventory/ItemThumb";
import { StockDialog } from "@/inventory/StockDialog";
import { cn } from "@/lib/utils";

export function ProducePage() {
  const { data, loading, error } = useInventory();
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState<Item | null>(null);

  useEffect(() => {
    if (!isAdmin) setEditing(null);
  }, [isAdmin]);

  if (loading) return <p className="p-8 text-sm text-muted-foreground">Lädt …</p>;
  if (error) return <p className="p-8 text-sm font-semibold text-destructive">{error}</p>;
  if (!data) return null;

  const produce = itemsOfKind(data, "PRODUCE");
  const needBySlug = new Map(data.recipe.map((entry) => [entry.slug, entry.amount]));

  // Die knappste Zutat bestimmt, wie oft hergestellt werden kann — sie wird hervorgehoben.
  const runsPerItem = produce.map((item) => {
    const need = needBySlug.get(item.slug) ?? 0;
    return need > 0 ? Math.floor(item.stock / need) : Infinity;
  });
  const bottleneck = Math.min(...runsPerItem);

  return (
    <div className="grid gap-4 p-8">
      <div>
        <h2 className="text-lg font-semibold">Rohstoffe</h2>
        <p className="text-sm text-muted-foreground">
          Diese Bestände reichen für{" "}
          <span className="font-mono tabular-nums text-brand-light">{data.craftable}</span>{" "}
          {data.craftable === 1 ? "Herstellung" : "Herstellungen"}. Die knappste Zutat ist markiert.
        </p>
      </div>

      <div className="grid gap-2">
        {produce.map((item, index) => {
          const need = needBySlug.get(item.slug) ?? 0;
          const runs = runsPerItem[index];
          const isBottleneck = need > 0 && runs === bottleneck;
          // Fortschritt gegenüber der Menge, die ein weiterer Durchlauf über den
          // gemeinsam möglichen hinaus bräuchte.
          const target = need * (bottleneck + 1);
          const progress = target > 0 ? Math.min(100, (item.stock / target) * 100) : 100;

          return (
            <Card
              key={item.id}
              className={cn(
                "flex-row flex-wrap items-center gap-4 border-border bg-panel p-4 shadow-glass backdrop-blur-lg",
                isBottleneck && "border-destructive/40",
              )}
            >
              <ItemThumb src={item.imagePath} alt={item.name} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-semibold">
                  {item.name}
                  {isBottleneck && (
                    <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-destructive uppercase">
                      <Icon name="danger" size={11} variant="bold" />
                      Engpass
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {need} pro Durchlauf · reicht für {Number.isFinite(runs) ? runs : "–"}
                </p>
                <div className="mt-2 h-1.5 w-full max-w-64 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={cn("h-full rounded-full", isBottleneck ? "bg-destructive" : "bg-primary")}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <p className="font-mono text-3xl tabular-nums">{item.stock}</p>
              {isAdmin && (
                <Button variant="outline" onClick={() => setEditing(item)}>
                  <Icon name="edit-2" size={16} />
                  Stand aktualisieren
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      {editing && <StockDialog mode="set" item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
