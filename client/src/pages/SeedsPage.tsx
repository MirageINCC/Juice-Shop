import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BulkSetDialog } from "@/inventory/BulkSetDialog";
import { useInventory, itemsOfKind } from "@/inventory/InventoryContext";
import { ItemThumb } from "@/inventory/ItemThumb";

export function SeedsPage() {
  const { data, loading, error } = useInventory();
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!isAdmin) setEditing(false);
  }, [isAdmin]);

  if (loading) return <p className="p-8 text-sm text-muted-foreground">Lädt …</p>;
  if (error) return <p className="p-8 text-sm font-semibold text-destructive">{error}</p>;
  if (!data) return null;

  const seeds = itemsOfKind(data, "SEED");

  return (
    <div className="grid gap-4 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Samen</h2>
          <p className="text-sm text-muted-foreground">
            Alle Sorten werden in einem Fenster gepflegt.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setEditing(true)}>
            <Icon name="edit-2" size={16} />
            Bestand aktualisieren
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {seeds.map((item) => (
          <Card
            key={item.id}
            className="gap-3 border-border bg-panel p-4 shadow-glass backdrop-blur-lg"
          >
            <ItemThumb src={item.imagePath} alt={item.name} size={140} className="w-full" />
            <div>
              <p className="truncate font-semibold">{item.name}</p>
              <p className="font-mono text-2xl tabular-nums">{item.stock}</p>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <BulkSetDialog
          title="Samenbestand aktualisieren"
          items={seeds}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
