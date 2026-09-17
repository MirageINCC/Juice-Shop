# Übergabe

Diese Anwendung ist als eigenständiger Dienst gebaut und läuft als solcher unter
https://juice.covern.cloud. Gedacht ist sie als Grundlage für den Einbau in die
**SQUADRA Family ACP** (`grand.tekknine.com`, Next.js).

Dieses Dokument beschreibt, was beim Portieren erhalten bleiben muss, was sich unverändert
übernehmen lässt und wo die Nähte liegen.

---

## Was die Anwendung fachlich tut

Bestandsführung für drei Artikelarten mit einer Produktionsmechanik.

| Art | Artikel |
|---|---|
| `JUICE` | Angriffs Saft 10 % / 20 %, Schutz Saft 10 % / 20 %, Ausdauer Saft, Saft der Fahrt, Saft der Kraft, Immunitätssaft |
| `PRODUCE` | Kohl, Kürbis, Mandarinen, Ananas, Erdbeeren |
| `SEED` | Kohlsamen, Ananas-Samen, Mandarinen-Samen, Kürbiskerne |

**Herstellung:** Ein Durchlauf verbraucht 50 Kohl, 40 Kürbisse, 32 Mandarinen, 26 Ananas
und 10 Erdbeeren und erzeugt **+10 Stück je Saftsorte** — bei acht Sorten also 80 Juices
pro Durchlauf.

**Wie oft das noch geht** (`craftable`) ist die knappste Zutat:
`min(⌊bestand / bedarf⌋)` über alle fünf Zutaten. Dieser Wert steht in der Kopfzeile auf
jeder Seite.

**Zwei Buchungsarten**, bewusst unterschieden:

- **Ausbuchen** zieht eine Menge vom Bestand ab (Entnahme/Verkauf) → Bewegung `ISSUE`.
- **Stand aktualisieren** setzt den Bestand absolut; protokolliert wird die Differenz →
  Bewegung `ADJUST`.

Bei den Juices und den Früchten geschieht das **pro Artikel**, bei den Samen **für alle vier
gemeinsam in einem Fenster** — das ist so gewünscht, keine Inkonsequenz.

---

## Invarianten, die beim Portieren erhalten bleiben müssen

Das sind die Punkte, an denen eine Neuverdrahtung leise etwas kaputt machen kann:

1. **Bestand und Bewegung entstehen zusammen oder gar nicht.** Jede Mutation läuft in einer
   Transaktion. Ein Bestand ohne zugehörige Bewegungszeile macht die Historie — und damit
   die Diagramme — wertlos.

2. **Der Rohstoffbestand wird *innerhalb* der Transaktion gelesen und geprüft.** Wird vorher
   gelesen, rechnen zwei gleichzeitige Herstell-Aufrufe gegen denselben Altbestand und
   ziehen ihn ins Minus. `craft()` in `server/src/inventory.ts` macht das richtig herum.

3. **Ein Herstell-Durchlauf schreibt alle 13 Bewegungen unter einer gemeinsamen `batchId`**
   (5 × `CRAFT_OUT`, 8 × `CRAFT_IN`). Nur dadurch bleibt später erkennbar, welche Abgänge
   und Zugänge zusammengehören.

4. **Das Rezept hat genau einen Eigentümer:** `server/src/recipe.ts`. Der Client bekommt es
   über `GET /api/inventory` geliefert und leitet nichts selbst ab. Dieselbe `maxRuns()`
   speist die Anzeige *und* validiert den Herstell-Aufruf — sonst können Anzeige und
   erlaubte Menge auseinanderlaufen. **Diese Zahlen nicht ins Frontend duplizieren.**

5. **Die Rechteprüfung gehört auf den Server.** Der Client blendet Buttons nur aus; jede
   Mutation prüft erneut. Beim Einbau in SQUADRA tritt dessen Auth an die Stelle von
   `requireAdmin` — die Prüfung selbst darf nicht entfallen.

---

## Datenmodell

`server/prisma/schema.prisma`, zwei Modelle, PostgreSQL, snake_case-Mapping.

```prisma
enum ItemKind     { JUICE PRODUCE SEED }
enum MovementType { ISSUE ADJUST CRAFT_IN CRAFT_OUT }

model Item {
  id        String   @id @default(uuid())
  slug      String   @unique   // Schlüssel zu Bild und Rezept
  name      String
  kind      ItemKind
  imagePath String
  stock     Int      @default(0)
  sortOrder Int      @default(0)
  movements Movement[]
}

model Movement {
  id            String       @id @default(uuid())
  itemId        String
  type          MovementType
  delta         Int          // vorzeichenbehaftet, tatsächlich angewandt
  before        Int
  after         Int
  batchId       String?      // klammert einen Herstell-Durchlauf
  createdBy     String       // Benutzer-ID
  createdByName String
  createdAt     DateTime     @default(now())
}
```

`Movement` ist bewusst **eine** Tabelle für alle drei Artikelarten: „wie viel ist rein- und
rausgegangen" ist überall dieselbe Frage.

Beim Einfügen in ein bestehendes Schema kollidieren `Item` und `Movement` womöglich mit
vorhandenen Namen — dann umbenennen (z. B. `JuiceItem`, `JuiceMovement`) und die
`@@map`-Tabellennamen mitziehen.

### Warenkatalog

Es gibt keinen Seed-Schritt. Der Server stellt den Katalog beim Start selbst sicher —
`ensureCatalog()` in `server/src/catalog.ts`, `upsert` auf `slug`. Wiederholbar: Namen,
Bildpfade und Reihenfolge werden nachgezogen, gepflegte Bestände bleiben unangetastet.

---

## API-Kontrakt

| Methode | Pfad | Recht | Wirkung |
|---|---|---|---|
| `GET` | `/api/inventory` | offen | `{ items, recipe, yieldPerRun, craftable }` — der gesamte Zustand in einem Aufruf |
| `POST` | `/api/items/:id/issue` | admin | `{ quantity }` → abziehen |
| `POST` | `/api/items/:id/set` | admin | `{ stock }` → absolut setzen |
| `POST` | `/api/items/bulk-set` | admin | `{ entries: [{ id, stock }] }` → mehrere in einer Transaktion |
| `POST` | `/api/craft` | admin | `{ runs }` → herstellen |
| `GET` | `/api/movements?kind=JUICE&days=30` | offen | `{ perDay, recent, totals }` für die Diagramme |

**Jede Mutation gibt den frischen Gesamtzustand zurück** — dieselbe Form wie
`GET /api/inventory`. Der Client ersetzt damit seinen State und muss nicht nachladen. Das
lohnt sich beizubehalten.

`perDay` ist eine **lückenlose** Tagesreihe über den angefragten Zeitraum (Tage ohne
Bewegung mit Nullen), damit das Diagramm keine Tage überspringt.

---

## Was sich unverändert übernehmen lässt

| Datei | Inhalt |
|---|---|
| `server/src/recipe.ts` | Rezept und `maxRuns()`. Keine Abhängigkeiten. |
| `server/src/inventory.ts` | **Die komplette Fachlogik.** Kennt weder Request noch Response — nimmt `PrismaClient`, Argumente und einen Benutzer, gibt den Zustand zurück, wirft `HttpError`. Direkt aus einem Next.js Route Handler oder einer Server Action aufrufbar. |
| `server/src/catalog.ts` | Warenkatalog und `ensureCatalog()`. |
| `server/prisma/schema.prisma` | Die beiden Modelle. |
| `client/src/inventory/*`, `client/src/pages/*` | Die React-Komponenten. Reines React mit shadcn/ui und Tailwind v4 — keine Vite-Besonderheiten. |

**Express-gebunden und damit zu ersetzen:** `server/src/index.ts` (Wiring, Static-Serving,
SPA-Fallback), `server/src/routes/*` (dünne Transportschicht), `server/src/middleware/*` und
`server/src/auth/*` (wird durch SQUADRAs Auth ersetzt).

Die Fachlogik erwartet einen Benutzer der Form `{ id, username }` — in `inventory.ts` als
`SessionUser` typisiert. Beim Einbau genügt es, diesen Typ auf das Benutzerobjekt von
SQUADRA zu mappen; nur `id` und `username` werden verwendet, und zwar für die
Bewegungshistorie.

---

## Frontend

React 19, Tailwind v4 CSS-first (**keine** `tailwind.config.js`), shadcn/ui im Stil
`new-york`, Icons von [Iconsax](https://iconsax.io), Diagramme mit Recharts.

Die Design-Tokens stehen in `client/src/index.css` und sind auf `:root` **und** `.dark`
gesetzt — die `dark:`-Zweige der shadcn-Komponenten fallen sonst still auf ihre
Hell-Variante zurück. Akzentfarbe ist `#2ee6a8`.

Iconsax kommt als natives Custom Element (`<iconsax-icon>`), gekapselt in
`client/src/components/Icon.tsx`; die JSX-Deklaration liegt in
`client/src/types/iconsax.d.ts`. Das Paket lagert seine Icon-Daten in Kategorie-Chunks aus,
die zur Laufzeit nachgeladen werden — wer nur eine Handvoll Icons braucht, fährt mit
inline-SVG leichter.

Zustand hält `client/src/inventory/InventoryContext.tsx`: ein `GET /api/inventory` beim
Start, danach ersetzt jede Mutation den State mit ihrer Antwort. Kein react-query, kein
Formular-Framework — die Dialoge arbeiten mit `useState` und nativen HTML-Constraints.

### Artikel-Icons

`assets-src/` enthält die Spiel-Screenshots, `server/scripts/extract-assets.ts` schneidet
daraus per sharp die Icons frei nach `client/public/assets/` (nicht eingecheckt, entsteht im
Docker-Build über `npm run assets`).

Zwei Verfahren, weil die Vorlagen unterschiedlich gebaut sind:

- **Juices und Früchte** werden freigestellt. Juices über den Farbabstand zum einfarbigen
  Oliv-Hintergrund, Früchte über die Sättigung (die Hintergründe sind grau, das Obst
  kräftig). Anschließend Zusammenhangskomponenten: die größte massive, hochkante Fläche ist
  die Flasche — der weiße Rahmen ist hohl, die Bodenleiste liegt quer, beide fallen so von
  selbst weg.
- **Samen** werden nur zugeschnitten. Dort ist die helle Karte das Motiv und die Körner sind
  dunkelbraun; jede Schwelle würde beides auseinanderreißen.

**Auflösungsgrenze:** Die Flaschen messen im Original ~22 × 63 px. Sie werden deshalb nie
hochskaliert, sondern in einer Kachel zentriert (`client/src/inventory/ItemThumb.tsx`).
Bessere Vorlagen kann man unter demselben Dateinamen in `assets-src/` ablegen und das Skript
neu laufen lassen.

---

## Stand und bekannte Grenzen

- Alle Endpunkte sind gegen die Live-Instanz abgenommen: Rechte (401/403/200), Rezeptrechnung,
  Engpass-Sperre, Grenzfälle, Ausbuchen inklusive Überziehschutz, Sammelpflege und die
  Bewegungsauswertung — 14 von 14.
- **Keine automatisierten Tests.** Die Abnahme lief als Skript gegen die laufende Instanz.
  Wer die Fachlogik portiert, sollte `inventory.ts` mit Unit-Tests absichern; sie ist dafür
  jetzt frei von Express.
- **Kein Linter, kein Formatter** — wie im Schwesterprojekt gta-map.
- Die Bewegungshistorie wächst unbegrenzt. Bei den zu erwartenden Mengen unkritisch, aber
  `GET /api/movements` lädt den Zeitraum vollständig und aggregiert in JavaScript; bei sehr
  vielen Zeilen gehört das in eine SQL-Aggregation.
- Die Rollen werden beim Login in den JWT eingefroren (24 h). Entfällt beim Einbau in
  SQUADRA, sofern dessen Auth das anders löst.
