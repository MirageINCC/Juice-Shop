import { ItemKind, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Der Warenkatalog. `slug` ist der Schlüssel: er verbindet den Datensatz mit der
 * Bilddatei aus assets-src/ und mit dem Rezept in src/recipe.ts.
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

async function main() {
  let order = 0;
  for (const entry of CATALOG) {
    const imagePath = `/assets/${FOLDER[entry.kind]}/${entry.slug}.png`;
    const sortOrder = order++;

    // upsert statt create: ein erneuter Deploy darf Namen und Reihenfolge nachziehen,
    // aber niemals den gepflegten Bestand zurücksetzen.
    await prisma.item.upsert({
      where: { slug: entry.slug },
      create: { ...entry, imagePath, sortOrder },
      update: { name: entry.name, kind: entry.kind, imagePath, sortOrder },
    });
  }
  console.log(`Katalog eingespielt: ${CATALOG.length} Artikel.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
