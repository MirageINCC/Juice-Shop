import { Icon } from "@/components/Icon";
import { useInventory } from "@/inventory/InventoryContext";
import { cn } from "@/lib/utils";

/**
 * Die Herstellbarkeits-Anzeige steht in der Kopfzeile und ist damit auf allen Seiten
 * sichtbar — sie ist die Zahl, wegen der man zwischen Juices und Rohstoffen hin- und
 * herspringt.
 */
export function TopBar({ title, subtitle }: { title: string; subtitle: string }) {
  const { data } = useInventory();
  const craftable = data?.craftable ?? 0;

  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-8 py-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div
        className={cn(
          "flex items-center gap-2.5 rounded-full border px-4 py-2 text-sm font-medium shadow-glass backdrop-blur-lg",
          craftable > 0
            ? "border-primary/30 bg-primary/10 text-brand-light"
            : "border-destructive/30 bg-destructive/10 text-destructive",
        )}
      >
        <Icon name="blend" size={18} variant="bold" />
        Du kannst <span className="font-mono text-base tabular-nums">{craftable}</span> mal Juices
        herstellen
      </div>
    </header>
  );
}
