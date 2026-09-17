/**
 * Das Herstellungsrezept — die einzige Quelle der Wahrheit.
 *
 * Client und Server rechnen beide mit diesen Zahlen, aber nur diese Datei kennt sie:
 * der Client bekommt Rezept und `craftable` über GET /api/inventory geliefert und leitet
 * nichts selbst ab. Dieselbe maxRuns() validiert auch POST /api/craft, damit die Anzeige
 * und die tatsächlich erlaubte Menge nicht auseinanderlaufen können.
 */

/** Was ein einzelner Herstell-Durchlauf an Rohstoffen verbraucht. */
export const CRAFT_RECIPE = [
  { slug: "kohl", amount: 50 },
  { slug: "kuerbis", amount: 40 },
  { slug: "mandarinen", amount: 32 },
  { slug: "ananas", amount: 26 },
  { slug: "erdbeeren", amount: 10 },
] as const;

/** Was ein Durchlauf je Saftsorte einbringt. */
export const JUICE_YIELD_PER_RUN = 10;

/**
 * Wie oft der vorhandene Rohstoffbestand für einen Durchlauf reicht.
 * Die knappste Zutat bestimmt das Ergebnis; eine fehlende Zutat bedeutet 0.
 */
export function maxRuns(stockBySlug: Record<string, number>): number {
  let runs = Infinity;
  for (const { slug, amount } of CRAFT_RECIPE) {
    runs = Math.min(runs, Math.floor((stockBySlug[slug] ?? 0) / amount));
  }
  return Number.isFinite(runs) ? Math.max(0, runs) : 0;
}
