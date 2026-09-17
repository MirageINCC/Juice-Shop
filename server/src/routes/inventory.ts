import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { bulkSetStock, craft, issueStock, loadInventory, setStock } from "../inventory.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

/**
 * Transportschicht: Rechte prüfen, Eingabe validieren, an die Bestandsführung übergeben.
 * Die Fachlogik steht in inventory.ts und kennt Express nicht.
 */
export const inventoryRouter = Router();

const quantitySchema = z.object({ quantity: z.coerce.number().int().positive() });
const stockSchema = z.object({ stock: z.coerce.number().int().min(0) });
const bulkSchema = z.object({
  entries: z.array(z.object({ id: z.string().min(1), stock: z.coerce.number().int().min(0) })).min(1),
});
const craftSchema = z.object({ runs: z.coerce.number().int().positive() });

/**
 * Bindet einen Handler an ein Zod-Schema: bei ungültiger Eingabe 400 mit den Feldfehlern,
 * sonst Aufruf mit den geprüften Daten. Fachliche Fehler (HttpError) übersetzt der zentrale
 * Error-Handler in index.ts.
 */
function handler<T>(schema: z.ZodType<T>, run: (data: T, req: import("express").Request) => Promise<unknown>) {
  return async (
    req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction,
  ) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      res.json(await run(parsed.data, req));
    } catch (error) {
      next(error);
    }
  };
}

inventoryRouter.get("/inventory", async (_req, res, next) => {
  try {
    res.json(await loadInventory(prisma));
  } catch (error) {
    next(error);
  }
});

inventoryRouter.post(
  "/items/:id/issue",
  requireAdmin,
  handler(quantitySchema, ({ quantity }, req) => issueStock(prisma, req.params.id, quantity, req.user!)),
);

inventoryRouter.post(
  "/items/:id/set",
  requireAdmin,
  handler(stockSchema, ({ stock }, req) => setStock(prisma, req.params.id, stock, req.user!)),
);

inventoryRouter.post(
  "/items/bulk-set",
  requireAdmin,
  handler(bulkSchema, ({ entries }, req) => bulkSetStock(prisma, entries, req.user!)),
);

inventoryRouter.post(
  "/craft",
  requireAdmin,
  handler(craftSchema, ({ runs }, req) => craft(prisma, runs, req.user!)),
);
