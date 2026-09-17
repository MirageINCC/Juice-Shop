import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { fetchInventory } from "@/api/inventory";
import type { Inventory, ItemKind } from "@/api/types";

interface InventoryState {
  data: Inventory | null;
  loading: boolean;
  error: string | null;
  /** Jede Mutation liefert den frischen Gesamtzustand zurück — hier wird er übernommen. */
  apply: (next: Inventory) => void;
  reload: () => Promise<void>;
}

const InventoryContext = createContext<InventoryState | null>(null);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await fetchInventory());
      setError(null);
    } catch {
      setError("Bestand konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <InventoryContext.Provider value={{ data, loading, error, apply: setData, reload }}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory(): InventoryState {
  const context = useContext(InventoryContext);
  if (!context) throw new Error("useInventory muss innerhalb von InventoryProvider verwendet werden");
  return context;
}

/** Artikel einer Art in Katalogreihenfolge. */
export function itemsOfKind(data: Inventory | null, kind: ItemKind) {
  return (data?.items ?? []).filter((item) => item.kind === kind);
}
