import type { Item, MovementType, Prisma, PrismaClient } from "@prisma/client";
import type { SessionUser } from "./auth/session.js";
import { HttpError } from "./httpError.js";
import { CRAFT_RECIPE, JUICE_YIELD_PER_RUN, maxRuns } from "./recipe.js";

/**
 * Die Bestandsführung — die gesamte Fachlogik der Anwendung, ohne Express.
 *
 * Nichts hier kennt Request oder Response. Die Routen in routes/inventory.ts prüfen nur
 * Rechte, validieren die Eingabe und rufen diese Funktionen auf. Wer die Anwendung in eine
 * andere Umgebung portiert (Next.js Route Handler, Server Action, Cronjob), übernimmt diese
 * Datei unverändert und ersetzt nur die Transportschicht.
 *
 * Gemeinsame Regeln aller Funktionen hier:
 *   - Bestandsänderung und Bewegungszeile entstehen immer zusammen in einer Transaktion.
 *   - Gelesen wird *innerhalb* der Transaktion, sonst rechnen zwei gleichzeitige Aufrufe
 *     gegen denselben Altbestand und ziehen ihn ins Minus.
 *   - Zurück kommt immer der frische Gesamtzustand, damit der Aufrufer nicht nachladen muss.
 *   - Fachliche Fehler werden als HttpError geworfen, nicht als Antwort formuliert.
 */

/** Die Teilmenge von PrismaClient, die innerhalb einer Transaktion verfügbar ist. */
export type Tx = Prisma.TransactionClient;

export interface InventorySnapshot {
  items: Item[];
  recipe: { slug: string; amount: number }[];
  yieldPerRun: number;
  craftable: number;
}

export async function loadInventory(tx: Tx | PrismaClient): Promise<InventorySnapshot> {
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

/** Setzt den Bestand eines Artikels und protokolliert die Änderung in einem Rutsch. */
async function applyStockChange(
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

async function requireItem(tx: Tx, id: string): Promise<Item> {
  const item = await tx.item.findUnique({ where: { id } });
  if (!item) throw new HttpError(404, "Artikel nicht gefunden");
  return item;
}

/** Ausbuchen: eine Menge vom Bestand abziehen. */
export function issueStock(
  prisma: PrismaClient,
  itemId: string,
  quantity: number,
  user: SessionUser,
): Promise<InventorySnapshot> {
  return prisma.$transaction(async (tx) => {
    const item = await requireItem(tx, itemId);
    if (quantity > item.stock) throw new HttpError(400, `Nur ${item.stock} Stück vorhanden.`);
    await applyStockChange(tx, item, item.stock - quantity, "ISSUE", user);
    return loadInventory(tx);
  });
}

/** Stand aktualisieren: den Bestand absolut setzen. */
export function setStock(
  prisma: PrismaClient,
  itemId: string,
  stock: number,
  user: SessionUser,
): Promise<InventorySnapshot> {
  return prisma.$transaction(async (tx) => {
    const item = await requireItem(tx, itemId);
    await applyStockChange(tx, item, stock, "ADJUST", user);
    return loadInventory(tx);
  });
}

/** Sammelpflege — die Samen-Seite aktualisiert alle Sorten in einem Fenster. */
export function bulkSetStock(
  prisma: PrismaClient,
  entries: { id: string; stock: number }[],
  user: SessionUser,
): Promise<InventorySnapshot> {
  return prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      const item = await requireItem(tx, entry.id);
      if (item.stock === entry.stock) continue; // keine Bewegung ohne Änderung
      await applyStockChange(tx, item, entry.stock, "ADJUST", user);
    }
    return loadInventory(tx);
  });
}

/**
 * Herstellen: Rohstoffe nach Rezept verbrauchen, jede Saftsorte um den Ertrag erhöhen.
 * Alle Bewegungen eines Durchlaufs teilen sich eine batchId, damit später nachvollziehbar
 * bleibt, welche Abgänge und Zugänge zusammengehören.
 */
export function craft(
  prisma: PrismaClient,
  runs: number,
  user: SessionUser,
): Promise<InventorySnapshot> {
  return prisma.$transaction(async (tx) => {
    const items = await tx.item.findMany();
    const allowed = maxRuns(stockBySlug(items));
    if (runs > allowed) {
      throw new HttpError(
        400,
        allowed === 0
          ? "Die Rohstoffe reichen für keinen Durchlauf."
          : `Die Rohstoffe reichen nur für ${allowed} Durchläufe.`,
      );
    }

    const batchId = crypto.randomUUID();

    for (const { slug, amount } of CRAFT_RECIPE) {
      const item = items.find((candidate) => candidate.slug === slug);
      if (!item) throw new HttpError(500, `Rezeptzutat "${slug}" fehlt im Katalog.`);
      await applyStockChange(tx, item, item.stock - amount * runs, "CRAFT_OUT", user, batchId);
    }

    for (const item of items.filter((candidate) => candidate.kind === "JUICE")) {
      await applyStockChange(
        tx,
        item,
        item.stock + JUICE_YIELD_PER_RUN * runs,
        "CRAFT_IN",
        user,
        batchId,
      );
    }

    return loadInventory(tx);
  });
}
