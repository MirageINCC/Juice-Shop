# Deployment

Der Juice Shop läuft als Container-Stack im Mittwald-Projekt **„Grönd" (`p-i0wsnq`)** —
demselben Projekt wie die gta-map — und ist unter **https://juice.covern.cloud** erreichbar.

## Wie das Image entsteht

Mittwald-Container-Stacks ziehen ihr Image aus einer Registry und können nicht aus dem
Quellcode bauen. Der Build passiert deshalb in GitHub Actions:

`.github/workflows/docker-publish.yml` baut bei jedem Push auf `main` aus `server/Dockerfile`
und schiebt das Ergebnis nach `ghcr.io/mirageincc/juice-shop` — einmal als `:latest` und
einmal als `:<commit-sha>`.

Das Repository ist öffentlich, das Paket damit ebenfalls anonym abrufbar. Der Stack braucht
keine Registry-Zugangsdaten.

### Warum der Stack per Digest referenziert wird, nie per `:latest`

`:latest` ist ein beweglicher Zeiger. Steht im Stack ein Digest, ist jederzeit belegbar,
welcher Stand läuft, und ein Rollback ist ein Ein-Zeilen-Wechsel. Genau so hält es die
gta-map auch.

Digest nach einem grünen CI-Lauf ermitteln:

```bash
SHA=$(git rev-parse HEAD)
TOKEN=<GitHub-PAT mit read:packages>
curl -s -H "Authorization: Bearer $(printf '%s' "$TOKEN" | base64)" \
     -H "Accept: application/vnd.oci.image.index.v1+json" \
     -D - -o /dev/null "https://ghcr.io/v2/mirageincc/juice-shop/manifests/$SHA" \
  | grep -i docker-content-digest
```

## Stack

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: juice
      POSTGRES_PASSWORD: <geheim>
      POSTGRES_DB: juiceshop
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    image: ghcr.io/mirageincc/juice-shop@sha256:<digest>
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://juice:<geheim>@postgres:5432/juiceshop
      SESSION_SECRET: <geheim, mind. 16 Zeichen>
      DISCORD_CLIENT_ID: <…>
      DISCORD_CLIENT_SECRET: <…>
      DISCORD_REDIRECT_URI: https://juice.covern.cloud/auth/discord/callback
      DISCORD_BOT_TOKEN: <…>
      DISCORD_GUILD_ID: <…>
      ADMIN_ROLE_IDS: <kommagetrennt>
    ports:
      - "3000:3000"

volumes:
  pgdata:
```

Der Container führt beim Start `prisma migrate deploy` aus, der Server stellt danach den
Warenkatalog sicher und nimmt erst dann Anfragen an. Schema- und Katalogänderungen kommen
also mit dem Deploy von selbst mit, ohne Handgriff im Container.

> **Achtung:** `mittwald_stack_deploy` ersetzt den **kompletten** Stack. Was in der
> übergebenen Compose-Datei fehlt, wird gelöscht — inklusive Volumes. Vor jeder Änderung
> den bestehenden Stand auslesen und die Änderung hineinmergen, nie eine Teilkonfiguration
> schicken.

### Secrets

Die Geheimnisse stehen ausschließlich als Stack-Umgebungsvariablen in mStudio, nie im
Repository. `.env` ist in `.gitignore`.

Ein Wechsel von `SESSION_SECRET` macht alle bestehenden Cookies ungültig und meldet damit
sämtliche Benutzer ab. Beim Umzug auf einen neuen Stack den Wert mitnehmen.

## Warenkatalog

Es gibt keinen manuellen Seed-Schritt. Die Migration legt die Tabellen an, und der Server
stellt beim Start den Katalog aus `server/src/catalog.ts` per `upsert` auf `slug` sicher —
wiederholbar, ohne gepflegte Bestände anzufassen. Ein frischer Deploy ist damit sofort
benutzbar, und eine Artikeländerung kommt mit dem nächsten Deploy von selbst mit.

## Domain

Virtualhost für `juice.covern.cloud`, Pfad `/` → Container `app`, Port 3000. TLS verwaltet
Mittwald selbst.

## Discord-App

Der Juice Shop bekommt eine **eigene** Discord-App, nicht die der gta-map. Discord bietet
keine API zum Anlegen von Anwendungen — die folgenden Schritte gehen nur von Hand über
https://discord.com/developers/applications:

1. **New Application** anlegen, Name z. B. „Juice Shop Lager".
2. Unter **OAuth2**: `CLIENT ID` und ein neu erzeugtes `CLIENT SECRET` notieren. Als
   **Redirect** genau diese beiden Einträge hinterlegen — die Produktions-URI und die
   lokale, sonst funktioniert jeweils die andere Seite nicht:
   - `https://juice.covern.cloud/auth/discord/callback`
   - `http://localhost:5173/auth/discord/callback`
3. Unter **Bot**: Bot anlegen und das Token notieren. Es wird nur gebraucht, um beim Login
   die Rollen eines Benutzers nachzuschlagen — es sind keine privilegierten Intents nötig,
   nur der Gateway-Intent `Guilds`, den der Server selbst anfordert.
4. Den Bot über **OAuth2 → URL Generator** (Scope `bot`, keine weiteren Rechte) auf den
   Server einladen. Ohne Mitgliedschaft in der Guild kann er keine Rollen lesen, und
   niemand bekäme Adminrechte.
5. `DISCORD_GUILD_ID` ist die ID des Servers (Rechtsklick auf den Server → „ID kopieren",
   setzt den Entwicklermodus voraus).

### `ADMIN_ROLE_IDS` gegenprüfen, nicht raten

Die IDs vor dem Eintragen mit dem Bot-Token abfragen und anhand der Namen auswählen:

```bash
curl -s -H "Authorization: Bot <BOT_TOKEN>" \
  https://discord.com/api/v10/guilds/<GUILD_ID>/roles \
  | python3 -c "import json,sys; [print(r['id'], r['name']) for r in json.load(sys.stdin)]"
```

Discord-Server tragen oft Bot-eigene Integrationsrollen mit unscheinbaren Namen, deren IDs
oberflächlich wie Adminrollen aussehen. Bei der gta-map war deshalb einmal die
Bot-Integrationsrolle statt der Admin-Rolle eingetragen.

## Versionen

| Version | Commit | Digest | Deployed |
|---|---|---|---|
| — | `bf74ce6` | `sha256:07525d18e0f11d5221d7338664d7ca32292cd6d9f7deacbb9df49f2a4634ce11` | noch nicht |

Nach jedem bestätigten stabilen Stand einen annotierten Git-Tag `vX.Y` setzen und hier
eintragen — so ist jeder historische Zustand aus Code *und* Image wiederherstellbar.
