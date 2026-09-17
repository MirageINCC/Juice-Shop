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

> **Achtung — der Stack ist geteilt.** Das Projekt hat genau *einen* Stack (`default`), und
> darin läuft auch die **gta-map**. `mittwald_stack_deploy` ersetzt den **kompletten** Stack:
> was in der übergebenen Compose-Datei fehlt, wird gelöscht, inklusive Volumes.
>
> Vor jeder Änderung deshalb zwingend den Ist-Zustand auslesen und die eigene Änderung
> hineinmergen — mit `revealEnvironmentVariables=true`, sonst schickt man die Geheimnisse
> der Karte als `[REDACTED]` zurück und leert sie damit:
>
> ```
> mittwald_stack_list projectId=p-i0wsnq revealEnvironmentVariables=true
> ```
>
> Bleiben die Felder eines Dienstes unverändert, lässt Mittwald dessen Container in Ruhe
> (gleiche Container-ID, `requiresRecreate: false`). Das ist wichtig, weil der Virtualhost
> von `grand.covern.cloud` den gta-map-Container **per ID** adressiert — eine Neuanlage
> würde die Karte offline nehmen. Nach jedem Deploy `grand.covern.cloud` gegenprüfen.

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

Der Virtualhost `juice.covern.cloud` existiert im Projekt bereits, DNS und TLS verwaltet
Mittwald. Er muss auf Pfad `/` → Container **`juice-app` (`c-n1g7p5`)**, Port **3000**
zeigen.

**Das geht nur in mStudio, nicht über die API.** `mittwald_domain_virtualhost_create`
antwortet mit `403 PermissionDenied` — auch für einen bereits existierenden Hostnamen, also
eine Rechte- und keine Namensfrage. Ein Update-Endpunkt existiert nicht, und Löschen wäre
eine Einbahnstraße: neu anlegen ginge mit demselben 403 nicht mehr. Den Virtualhost daher
**nicht** über die API löschen.

In mStudio: *Domains → juice.covern.cloud → Ziel* auf den Container `juice-app`, Port 3000.

Die Domain `covern.cloud` selbst liegt nicht in diesem Projekt — `mittwald_domain_list` für
`p-i0wsnq` liefert nichts. Die Virtualhosts zeigen projektübergreifend darauf.

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

## Container

| Dienst | Short-ID | Rolle |
|---|---|---|
| `juice-app` | `c-n1g7p5` | Juice Shop |
| `juice-postgres` | `c-r1ban6` | dessen Datenbank, Volume `juice-pgdata` |
| `app` | `c-qz18dm` | gta-map — **nicht anfassen** |
| `postgres` | `c-t48jr5` | dessen Datenbank, Volume `pgdata` |

Die beiden Anwendungen teilen sich nur den Stack, nicht die Datenbank: eigener
Postgres-Dienst, eigenes Volume, eigene Zugangsdaten.

## Versionen

| Version | Commit | Digest | Deployed |
|---|---|---|---|
| `v1.0` | `ccc016f` | `sha256:db2466e3ce783a802499b9780efe2707b2a05e3d4682f2e88798894c142133d1` | 2026-09-17, läuft |

Nach jedem bestätigten stabilen Stand einen annotierten Git-Tag `vX.Y` setzen und hier
eintragen — so ist jeder historische Zustand aus Code *und* Image wiederherstellbar.
