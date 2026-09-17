/**
 * Fehler mit Statuscode. Routen — auch solche, die innerhalb einer Prisma-Transaktion
 * laufen — werfen diesen Typ; der zentrale Error-Handler in index.ts übersetzt ihn.
 * Das hält `res.status(...)` aus den Transaktionsrümpfen heraus, wo ein vorzeitiges
 * Antworten die Transaktion offen zurücklassen würde.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
