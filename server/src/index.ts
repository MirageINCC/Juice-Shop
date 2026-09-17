import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express from "express";
import { ensureCatalog } from "./catalog.js";
import { env } from "./env.js";
import { HttpError } from "./httpError.js";
import { authRouter } from "./routes/auth.js";
import { inventoryRouter } from "./routes/inventory.js";
import { movementsRouter } from "./routes/movements.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Im Image liegt dieses Modul unter /app/dist, der Client-Build unter /app/public.
const publicDir = path.join(__dirname, "..", "public");

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRouter);
app.use("/api", inventoryRouter);
app.use("/api", movementsRouter);

app.use(express.static(publicDir));

// SPA-Fallback: jedes GET außerhalb von /api und /auth, das keine Datei getroffen hat,
// bekommt die index.html — sonst würde ein Reload auf /samen mit 404 enden.
app.get(/^(?!\/(api|auth)\/).*/, (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"), (error) => {
    if (error) res.status(404).send("Not found (Client-Build fehlt — `npm run build`)");
  });
});

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (res.headersSent) return;
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Interner Serverfehler" });
  },
);

// Erst den Katalog sicherstellen, dann annehmen — sonst könnte der erste Aufruf nach
// einem frischen Deploy auf eine leere Artikelliste treffen.
ensureCatalog()
  .then(() => {
    app.listen(env.PORT, () => console.log(`juice-shop server lauscht auf :${env.PORT}`));
  })
  .catch((error) => {
    console.error("Katalog konnte nicht angelegt werden:", error);
    process.exit(1);
  });
