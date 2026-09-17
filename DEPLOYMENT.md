# Deployment

Der Juice Shop läuft als Container-Stack im Mittwald-Projekt **„Grönd" (`p-i0wsnq`)** —
demselben Projekt wie die gta-map.

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
      DISCORD_REDIRECT_URI: https://<subdomain>/auth/discord/callback
      DISCORD_BOT_TOKEN: <…>
      DISCORD_GUILD_ID: <…>
      ADMIN_ROLE_IDS: <kommagetrennt>
    ports:
      - "3000:3000"

volumes:
  pgdata:
```

Der Container führt beim Start `prisma migrate deploy` aus und startet erst danach den
Server — Schemaänderungen kommen also mit dem Deploy von selbst mit.

> **Achtung:** `mittwald_stack_deploy` ersetzt den **kompletten** Stack. Was in der
> übergebenen Compose-Datei fehlt, wird gelöscht — inklusive Volumes. Vor jeder Änderung
> den bestehenden Stand auslesen und die Änderung hineinmergen, nie eine Teilkonfiguration
> schicken.

### Secrets

Die Geheimnisse stehen ausschließlich als Stack-Umgebungsvariablen in mStudio, nie im
Repository. `.env` ist in `.gitignore`.

Ein Wechsel von `SESSION_SECRET` macht alle bestehenden Cookies ungültig und meldet damit
sämtliche Benutzer ab. Beim Umzug auf einen neuen Stack den Wert mitnehmen.

## Katalog einspielen

Die Migration legt leere Tabellen an; der Warenkatalog kommt aus dem Seed. Einmalig nach dem
ersten Deploy:

```bash
# im app-Container
npx prisma db seed
```

Der Seed arbeitet mit `upsert` auf `slug` — er darf jederzeit erneut laufen. Namen, Bildpfade
und Reihenfolge werden nachgezogen, der gepflegte Bestand bleibt unangetastet.

## Domain

Virtualhost auf die gewünschte Subdomain, Pfad `/` → Container `app`, Port 3000. TLS
verwaltet Mittwald selbst.

Die Subdomain muss anschließend in der Discord-App als Redirect-URI eingetragen **und** in
`DISCORD_REDIRECT_URI` gesetzt werden — beide Seiten müssen exakt übereinstimmen.

## Versionen

| Version | Commit | Digest | Deployed |
|---|---|---|---|
| — | `bf74ce6` | `sha256:07525d18e0f11d5221d7338664d7ca32292cd6d9f7deacbb9df49f2a4634ce11` | noch nicht |

Nach jedem bestätigten stabilen Stand einen annotierten Git-Tag `vX.Y` setzen und hier
eintragen — so ist jeder historische Zustand aus Code *und* Image wiederherstellbar.
