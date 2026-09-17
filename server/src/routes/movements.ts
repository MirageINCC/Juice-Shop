import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const movementsRouter = Router();

const querySchema = z.object({
  kind: z.enum(["JUICE", "PRODUCE", "SEED"]).optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

/** Lokales Kalenderdatum als YYYY-MM-DD — Tagesgrenzen sollen dort liegen, wo der Laden steht. */
function localDay(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

movementsRouter.get("/movements", async (req, res, next) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { kind, days } = parsed.data;

  try {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const movements = await prisma.movement.findMany({
      where: { createdAt: { gte: since }, ...(kind ? { item: { kind } } : {}) },
      orderBy: { createdAt: "desc" },
      include: { item: { select: { name: true, slug: true, imagePath: true } } },
    });

    // Lückenlose Tagesreihe, damit das Diagramm keine Tage überspringt.
    const buckets = new Map<string, { date: string; in: number; out: number }>();
    for (let index = 0; index < days; index++) {
      const day = new Date(since);
      day.setDate(day.getDate() + index);
      buckets.set(localDay(day), { date: localDay(day), in: 0, out: 0 });
    }

    for (const movement of movements) {
      const bucket = buckets.get(localDay(movement.createdAt));
      if (!bucket) continue;
      if (movement.delta >= 0) bucket.in += movement.delta;
      else bucket.out += -movement.delta;
    }

    res.json({
      perDay: [...buckets.values()],
      recent: movements.slice(0, 50),
      totals: {
        in: movements.reduce((sum, m) => sum + Math.max(0, m.delta), 0),
        out: movements.reduce((sum, m) => sum + Math.max(0, -m.delta), 0),
      },
    });
  } catch (error) {
    next(error);
  }
});
