import { ItemKind } from "@prisma/client";
import { prisma } from "./db.js";

/**
 * Der Warenkatalog. `slug` ist der Schlüssel: er verbindet den Datensatz mit der Bilddatei
 * aus assets-src/ und mit dem Rezept in recipe.ts.
 */
const CATALOG: { slug: string; name: string; kind: ItemKind }[] = [
  { slug: "angriffssaft-10", name: "Angriffs Saft 10%", kind: ItemKind.JUICE },
  { slug: "schutzsaft-10", name: "Schutz Saft 10%", kind: ItemKind.JUICE },
  { slug: "angriffssaft-20", name: "Angriffs Saft 20%", kind: ItemKind.JUICE },
  { slug: "schutzsaft-20", name: "Schutz Saft 20%", kind: ItemKind.JUICE },
  { slug: "ausdauersaft", name: "Ausdauer Saft", kind: ItemKind.JUICE },
  { slug: "saft-der-fahrt", name: "Saft der Fahrt", kind: ItemKind.JUICE },
  { slug: "saft-der-kraft", name: "Saft der Kraft", kind: ItemKind.JUICE },
  { slug: "immunitaetssaft", name: "Immunitätssaft", kind: ItemKind.JUICE },

  { slug: "kohl", name: "Kohl", kind: ItemKind.PRODUCE },
  { slug: "kuerbis", name: "Kürbis", kind: ItemKind.PRODUCE },
  { slug: "mandarinen", name: "Mandarinen", kind: ItemKind.PRODUCE },
  { slug: "ananas", name: "Ananas", kind: ItemKind.PRODUCE },
  { slug: "erdbeeren", name: "Erdbeeren", kind: ItemKind.PRODUCE },

  { slug: "kohlsamen", name: "Kohlsamen", kind: ItemKind.SEED },
  { slug: "ananas-samen", name: "Ananas-Samen", kind: ItemKind.SEED },
  { slug: "mandarinen-samen", name: "Mandarinen-Samen", kind: ItemKind.SEED },
  { slug: "kuerbiskerne", name: "Kürbiskerne", kind: ItemKind.SEED },
];

const FOLDER: Record<ItemKind, string> = {
  [ItemKind.JUICE]: "juices",
  [ItemKind.PRODUCE]: "produce",
  [ItemKind.SEED]: "seeds",
};

/**
 * Legt den Katalog an bzw. zieht ihn nach. Läuft bei jedem Serverstart.
 *
 * Der Katalog ist feste Stammdaten, ohne die die App nichts anzuzeigen hätte — kein
 * Einrichtungsschritt, den man vergessen können soll. `upsert` auf `slug` macht den Aufruf
 * wiederholbar: Namen, Bildpfade und Reihenfolge werden nachgezogen, der gepflegte Bestand
 * bleibt unangetastet.
 */
export async function ensureCatalog(): Promise<void> {
  let sortOrder = 0;
  for (const entry of CATALOG) {
    const imagePath = `/assets/${FOLDER[entry.kind]}/${entry.slug}.png`;
    const order = sortOrder++;
    await prisma.item.upsert({
      where: { slug: entry.slug },
      create: { ...entry, imagePath, sortOrder: order },
      update: { name: entry.name, kind: entry.kind, imagePath, sortOrder: order },
    });
  }
  console.log(`Katalog bereit: ${CATALOG.length} Artikel.`);
}
