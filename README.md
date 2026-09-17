# Juice Shop — Lagerverwaltung

Interface für den Juice Shop: Bestand der Säfte, der Rohstoffe und des Saatguts, mit
Herstellung und lückenloser Bewegungshistorie.

## Aufbau

npm-Workspaces-Monorepo, gleiches Prinzip wie `gta-map`:

| | |
|---|---|
| `server/` | Express 4, Prisma 6 auf PostgreSQL, Discord-OAuth mit JWT im httpOnly-Cookie |
| `client/` | React 19, Vite 6, Tailwind v4 (CSS-first), shadcn/ui, Iconsax, Recharts |
| `assets-src/` | die Spiel-Screenshots, aus denen die Artikel-Icons geschnitten werden |

Der Express-Server liefert im Betrieb sowohl die API als auch den fertigen Vite-Build aus —
kein nginx davor.

## Seiten

- **Juices** — acht Saftsorten. Pro Sorte „Ausbuchen" (zieht ab) und „Stand aktualisieren"
  (setzt absolut), dazu Kennzahlen und ein Diagramm über Zu- und Abgänge der letzten 30 Tage.
  Der Button „Juices herstellen" verbraucht Rohstoffe und bringt je Sorte +10 pro Durchlauf.
- **Früchte & Gemüse** — die fünf Rohstoffe mit Bestand, Rezeptanteil und markiertem Engpass.
- **Samen** — vier Sorten, alle in einem Fenster zu pflegen.

Die Kopfzeile zeigt auf jeder Seite, wie oft mit dem aktuellen Rohstoffbestand noch
hergestellt werden kann.

## Rezept

Ein Durchlauf verbraucht 50 Kohl, 40 Kürbisse, 32 Mandarinen, 26 Ananas und 10 Erdbeeren
und ergibt +10 Stück je Saftsorte. Diese Zahlen stehen **ausschließlich** in
`server/src/recipe.ts`; der Client bekommt sie über `GET /api/inventory` geliefert und
leitet nichts selbst ab.

## Rechte

Lesen darf jeder, auch ohne Anmeldung. Jede Änderung am Bestand verlangt eine Discord-Rolle
aus `ADMIN_ROLE_IDS`. Der Client blendet die Buttons nur aus — die Prüfung findet bei jeder
Mutation erneut auf dem Server statt.

## Entwicklung

```bash
npm install
cp .env.example .env          # Werte eintragen, siehe unten
npm run dev:db                # Postgres im Container
cd server && npx prisma migrate dev

npm run dev:server            # :3000, legt den Warenkatalog beim Start selbst an
npm run dev:client            # :5173  ← im Browser öffnen, nicht :3000
```

Der Vite-Dev-Server leitet `/api` und `/auth` an `:3000` weiter.

### Artikel-Icons

`npm run assets` schneidet die Icons aus `assets-src/` frei und schreibt sie nach
`client/public/assets/` (nicht eingecheckt, wird im Docker-Build erzeugt). Wer bessere
Vorlagen hat, legt sie unter dem gleichen Dateinamen in `assets-src/` ab und lässt das
Skript neu laufen.

Die Quellen sind Spiel-Screenshots — die Flaschen messen im Original rund 22×63 px. Die
Icons werden deshalb nie hochskaliert, sondern in einer Kachel zentriert dargestellt.

### Voraussetzungen für den Login

Eine Discord-App mit `identify`-Scope. Drei Stolpersteine:

1. `http://localhost:5173/auth/discord/callback` muss **zusätzlich** zur Produktions-URI
   als Redirect-URI hinterlegt sein, sonst schlägt der lokale Login fehl.
2. `ADMIN_ROLE_IDS` vor dem Eintragen per `GET /guilds/{id}/roles` mit dem Bot-Token
   gegenprüfen. Discord-Server haben oft Bot-eigene Rollen, deren IDs oberflächlich wie
   Adminrollen aussehen.
3. `DATABASE_URL` lokal niemals auf die Produktionsdatenbank zeigen lassen.

Anders als bei gta-map beendet ein ungültiges `DISCORD_BOT_TOKEN` den Server **nicht**: der
Bot meldet sich erst beim ersten Login an. Fällt Discord aus, bleibt die Bestandsansicht
erreichbar, und niemand bekommt in dieser Zeit Adminrechte.

### Rollen ändern

Die Rollen werden beim Login in den JWT eingefroren. Wer eine Adminrolle bekommt oder
verliert, muss sich neu anmelden — spätestens nach 24 Stunden greift es von selbst.
