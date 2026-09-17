import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { HttpError } from "../httpError.js";
import { applyStockChange, loadInventory, stockBySlug } from "../inventory.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { CRAFT_RECIPE, JUICE_YIELD_PER_RUN, maxRuns } from "../recipe.js";

export const inventoryRouter = Router();

const quantitySchema = z.object({ quantity: z.coerce.number().int().positive() });
const stockSchema = z.object({ stock: z.coerce.number().int().min(0) });
const bulkSchema = z.object({
  entries: z
    .array(z.object({ id: z.string().min(1), stock: z.coerce.number().int().min(0) }))
    .min(1),
});
const craftSchema = z.object({ runs: z.coerce.number().int().positive() });

inventoryRouter.get("/inventory", async (_req, res, next) => {
  try {
    res.json(await loadInventory(prisma));
  } catch (error) {
    next(error);
  }
});

/** Ausbuchen: eine Menge vom Bestand abziehen. */
inventoryRouter.post("/items/:id/issue", requireAdmin, async (req, res, next) => {
  const parsed = quantitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const snapshot = await prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id: req.params.id } });
      if (!item) throw new HttpError(404, "Artikel nicht gefunden");
      if (parsed.data.quantity > item.stock) {
        throw new HttpError(400, `Nur ${item.stock} Stück vorhanden.`);
      }
      await applyStockChange(tx, item, item.stock - parsed.data.quantity, "ISSUE", req.user!);
      return loadInventory(tx);
    });
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

/** Stand aktualisieren: den Bestand absolut setzen. */
inventoryRouter.post("/items/:id/set", requireAdmin, async (req, res, next) => {
  const parsed = stockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const snapshot = await prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id: req.params.id } });
      if (!item) throw new HttpError(404, "Artikel nicht gefunden");
      await applyStockChange(tx, item, parsed.data.stock, "ADJUST", req.user!);
      return loadInventory(tx);
    });
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

/** Sammelpflege — die Samen-Seite aktualisiert alle Sorten in einem Fenster. */
inventoryRouter.post("/items/bulk-set", requireAdmin, async (req, res, next) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const snapshot = await prisma.$transaction(async (tx) => {
      for (const entry of parsed.data.entries) {
        const item = await tx.item.findUnique({ where: { id: entry.id } });
        if (!item) throw new HttpError(404, `Artikel ${entry.id} nicht gefunden`);
        if (item.stock === entry.stock) continue; // keine Bewegung ohne Änderung
        await applyStockChange(tx, item, entry.stock, "ADJUST", req.user!);
      }
      return loadInventory(tx);
    });
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

/**
 * Herstellen. Rohstoffe werden *innerhalb* der Transaktion gelesen und geprüft — sonst
 * könnten zwei gleichzeitige Aufrufe beide gegen denselben Altbestand rechnen und den
 * Bestand ins Minus ziehen.
 */
inventoryRouter.post("/craft", requireAdmin, async (req, res, next) => {
  const parsed = craftSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { runs } = parsed.data;

  try {
    const snapshot = await prisma.$transaction(async (tx) => {
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
        await applyStockChange(tx, item, item.stock - amount * runs, "CRAFT_OUT", req.user!, batchId);
      }

      for (const item of items.filter((candidate) => candidate.kind === "JUICE")) {
        const gain = JUICE_YIELD_PER_RUN * runs;
        await applyStockChange(tx, item, item.stock + gain, "CRAFT_IN", req.user!, batchId);
      }

      return loadInventory(tx);
    });
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});
