import type { Item, MovementType, Prisma } from "@prisma/client";
import type { SessionUser } from "./auth/session.js";
import { CRAFT_RECIPE, JUICE_YIELD_PER_RUN, maxRuns } from "./recipe.js";

/** Die Teilmenge von PrismaClient, die innerhalb einer Transaktion verfügbar ist. */
export type Tx = Prisma.TransactionClient;

export interface InventorySnapshot {
  items: Item[];
  recipe: { slug: string; amount: number }[];
  yieldPerRun: number;
  craftable: number;
}

export async function loadInventory(tx: Tx): Promise<InventorySnapshot> {
  const items = await tx.item.findMany({ orderBy: { sortOrder: "asc" } });
  return {
    items,
    recipe: CRAFT_RECIPE.map((entry) => ({ ...entry })),
    yieldPerRun: JUICE_YIELD_PER_RUN,
    craftable: maxRuns(stockBySlug(items)),
  };
}

export function stockBySlug(items: Item[]): Record<string, number> {
  return Object.fromEntries(items.map((item) => [item.slug, item.stock]));
}

/**
 * Setzt den Bestand eines Artikels und protokolliert die Änderung in einem Rutsch.
 * Immer innerhalb einer Transaktion aufrufen — Bestand und Bewegung müssen zusammen
 * gelten oder gar nicht.
 */
export async function applyStockChange(
  tx: Tx,
  item: Item,
  nextStock: number,
  type: MovementType,
  user: SessionUser,
  batchId?: string,
): Promise<void> {
  await tx.item.update({ where: { id: item.id }, data: { stock: nextStock } });
  await tx.movement.create({
    data: {
      itemId: item.id,
      type,
      delta: nextStock - item.stock,
      before: item.stock,
      after: nextStock,
      batchId: batchId ?? null,
      createdBy: user.id,
      createdByName: user.username,
    },
  });
}
