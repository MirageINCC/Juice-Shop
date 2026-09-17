import { useEffect, useState } from "react";
import type { Item, MovementStats } from "@/api/types";
import { fetchMovements } from "@/api/movements";
import { useAuth } from "@/auth/AuthContext";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CraftDialog } from "@/inventory/CraftDialog";
import { useInventory, itemsOfKind } from "@/inventory/InventoryContext";
import { ItemThumb } from "@/inventory/ItemThumb";
import { MovementChart } from "@/inventory/MovementChart";
import { StatTile } from "@/inventory/StatTile";
import { StockDialog, type StockDialogMode } from "@/inventory/StockDialog";

export function JuicesPage() {
  const { data, loading, error } = useInventory();
  const { isAdmin } = useAuth();
  const juices = itemsOfKind(data, "JUICE");

  const [dialog, setDialog] = useState<{ mode: StockDialogMode; item: Item } | null>(null);
  const [crafting, setCrafting] = useState(false);
  const [stats, setStats] = useState<MovementStats | null>(null);

  // Nach jeder Buchung ändert sich `data` — dann auch die Bewegungsauswertung neu holen.
  useEffect(() => {
    if (!data) return;
    fetchMovements("JUICE", 30)
      .then(setStats)
      .catch(() => setStats(null));
  }, [data]);

  // Ein Admin, dem die Rolle entzogen wurde, soll nicht in einem offenen Dialog sitzen.
  useEffect(() => {
    if (!isAdmin) {
      setDialog(null);
      setCrafting(false);
    }
  }, [isAdmin]);

  if (loading) return <p className="p-8 text-sm text-muted-foreground">Lädt …</p>;
  if (error) return <p className="p-8 text-sm font-semibold text-destructive">{error}</p>;
  if (!data) return null;

  const total = juices.reduce((sum, item) => sum + item.stock, 0);

  return (
    <div className="grid gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Übersicht</h2>
        {isAdmin && (
          <Button onClick={() => setCrafting(true)} disabled={data.craftable === 0}>
            <Icon name="blend" size={16} />
            Juices herstellen
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Gesamtbestand" value={total} hint={`${juices.length} Sorten`} icon="box" />
        <StatTile
          label="Zugang 30 Tage"
          value={stats ? `+${stats.totals.in}` : "–"}
          icon="import-arrow-01"
          tone="positive"
        />
        <StatTile
          label="Abgang 30 Tage"
          value={stats ? `−${stats.totals.out}` : "–"}
          icon="export-arrow-01"
          tone="negative"
        />
        <StatTile
          label="Herstellbar"
          value={data.craftable}
          hint={`je Durchlauf +${data.yieldPerRun} pro Sorte`}
          icon="blend"
        />
      </div>

      <Card className="gap-4 border-border bg-panel p-5 shadow-glass backdrop-blur-lg">
        <div>
          <h3 className="text-sm font-semibold">Zugang und Abgang</h3>
          <p className="text-xs text-muted-foreground">
            Bewegungen der letzten 30 Tage, über alle Saftsorten
          </p>
        </div>
        {stats ? (
          <MovementChart stats={stats} />
        ) : (
          <div className="h-64 animate-pulse rounded-lg bg-white/[0.02]" />
        )}
      </Card>

      <div className="grid gap-2">
        {juices.map((item) => (
          <Card
            key={item.id}
            className="flex-row flex-wrap items-center gap-4 border-border bg-panel p-4 shadow-glass backdrop-blur-lg"
          >
            <ItemThumb src={item.imagePath} alt={item.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{item.name}</p>
              <p className="text-xs text-muted-foreground">Bestand</p>
            </div>
            <p className="font-mono text-3xl tabular-nums">{item.stock}</p>
            {isAdmin && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDialog({ mode: "issue", item })}
                  disabled={item.stock === 0}
                >
                  <Icon name="export-arrow-01" size={16} />
                  Ausbuchen
                </Button>
                <Button variant="outline" onClick={() => setDialog({ mode: "set", item })}>
                  <Icon name="edit-2" size={16} />
                  Stand aktualisieren
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {dialog && (
        <StockDialog mode={dialog.mode} item={dialog.item} onClose={() => setDialog(null)} />
      )}
      {crafting && <CraftDialog data={data} onClose={() => setCrafting(false)} />}
    </div>
  );
}
