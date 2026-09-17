/**
 * Schneidet die Artikel-Icons aus den Spiel-Screenshots in assets-src/ frei und legt sie
 * als transparente PNGs unter client/public/assets/ ab.
 *
 * Aufruf: `npm run assets` (aus dem Repo-Root).
 *
 * Die Quellen sind Screenshots, keine Grafiken: die Flaschen messen im Original nur
 * ~60x110 px. Mehr Detail ist nicht herauszuholen — das Ziel ist ein sauberer Rand,
 * nicht mehr Schärfe.
 */
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// npm-Workspace-Skripte laufen mit cwd = server/, nicht mit dem Repo-Root. Alle Pfade
// deshalb aus der Moduladresse ableiten, niemals relativ zu cwd.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const SRC = path.join(ROOT, "assets-src");
const OUT = path.join(ROOT, "client", "public", "assets");

type Rgb = [number, number, number];

interface Raw {
  data: Buffer;
  width: number;
  height: number;
}

async function readRaw(file: string, region?: sharp.Region): Promise<Raw> {
  let pipeline = sharp(file);
  if (region) pipeline = pipeline.extract(region);
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** HSV-Sättigung. Graue Hintergründe liegen nahe 0, Obst und Säfte weit darüber. */
function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  if (max === 0) return 0;
  return (max - Math.min(r, g, b)) / max;
}

/** Medianfarbe des Bildrands — der verlässlichste Schätzer für "Hintergrund". */
function borderColor({ data, width, height }: Raw): Rgb {
  const channels: number[][] = [[], [], []];
  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) channels[c].push(data[i + c]);
  };
  for (let x = 0; x < width; x++) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    sample(0, y);
    sample(width - 1, y);
  }
  return channels.map((values) => {
    values.sort((a, b) => a - b);
    return values[values.length >> 1];
  }) as Rgb;
}

interface KeyOptions {
  /**
   * "color"      — alles nahe der Randfarbe entfernen (einfarbiger Hintergrund).
   * "saturated"  — nur Farbiges behalten. Graue Wände, Schatten und weiße
   *                Beschriftung fallen damit in einem Schritt weg.
   */
  mode: "color" | "saturated";
  /** Farbabstand bei "color"; bei "saturated" die Sättigungsschwelle (0..1). */
  tolerance: number;
  /** Nur bei "saturated": alles Dunklere gilt trotz Farbe als Hintergrund. */
  darkFloor?: number;
  /** Komponenten, die den Bildrand berühren, verwerfen (Rahmen, Titelzeile). */
  dropBorderTouching?: boolean;
  /** Komponenten breiter als dieser Anteil der Bildbreite verwerfen. */
  maxWidthRatio?: number;
  /** Nur massive Flächen zulassen: Pixel / Fläche der Bounding-Box. Siebt hohle Rahmen aus. */
  minFillRatio?: number;
  /** Nur hochkante Flächen zulassen. Siebt liegende Balken und Schriftzeilen aus. */
  portraitOnly?: boolean;
  /**
   * Statt nur der größten Fläche alle behalten, die mindestens diesen Anteil von ihr
   * erreichen. Nötig bei den Samen: die Körner liegen als eigene Flecken neben der Frucht.
   */
  keepAllAbove?: number;
}

/**
 * Baut eine Vordergrundmaske, sucht darin die zusammenhängenden Flächen und behält nur
 * die größte plausible — so fallen Rahmen, Beschriftung und Streulicht von selbst weg.
 */
function foregroundMask(raw: Raw, options: KeyOptions): Uint8Array {
  const { data, width, height } = raw;
  const background = borderColor(raw);
  const mask = new Uint8Array(width * height);

  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const isBackground =
      options.mode === "color"
        ? Math.hypot(r - background[0], g - background[1], b - background[2]) < options.tolerance
        : saturation(r, g, b) < options.tolerance || luma(r, g, b) < (options.darkFloor ?? 0);
    mask[p] = isBackground ? 0 : 1;
  }

  // Zusammenhangskomponenten (4er-Nachbarschaft, iterativer Flood-Fill).
  const label = new Int32Array(width * height).fill(-1);
  const stats: { size: number; minX: number; maxX: number; minY: number; maxY: number; touchesBorder: boolean }[] = [];
  const stack: number[] = [];

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] === 0 || label[start] !== -1) continue;
    const id = stats.length;
    const stat = { size: 0, minX: width, maxX: 0, minY: height, maxY: 0, touchesBorder: false };
    stats.push(stat);
    label[start] = id;
    stack.push(start);

    while (stack.length > 0) {
      const p = stack.pop()!;
      const x = p % width;
      const y = (p - x) / width;
      stat.size++;
      if (x < stat.minX) stat.minX = x;
      if (x > stat.maxX) stat.maxX = x;
      if (y < stat.minY) stat.minY = y;
      if (y > stat.maxY) stat.maxY = y;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) stat.touchesBorder = true;

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (mask[q] === 1 && label[q] === -1) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
  }

  // Erst filtern, dann auswählen: was hier durchfällt, darf auch über keepAllAbove
  // nicht wieder hereinkommen — der weiße Rahmen hat mehr Pixel als die Flasche.
  const maxWidth = (options.maxWidthRatio ?? 1) * width;
  const eligible = stats.flatMap((stat, id) => {
    if (options.dropBorderTouching && stat.touchesBorder) return [];
    const boxWidth = stat.maxX - stat.minX + 1;
    const boxHeight = stat.maxY - stat.minY + 1;
    if (boxWidth > maxWidth) return [];
    if (options.portraitOnly && boxHeight <= boxWidth) return [];
    if (stat.size / (boxWidth * boxHeight) < (options.minFillRatio ?? 0)) return [];
    return [id];
  });
  if (eligible.length === 0) throw new Error("Keine brauchbare Vordergrundfläche gefunden");

  const best = eligible.reduce((a, b) => (stats[b].size > stats[a].size ? b : a));
  const floor = (options.keepAllAbove ?? 1) * stats[best].size;
  const keep = new Set(eligible.filter((id) => id === best || stats[id].size >= floor));

  const result = new Uint8Array(width * height);
  for (let p = 0; p < result.length; p++) result[p] = keep.has(label[p]) ? 1 : 0;
  fillHoles(result, width, height);
  return result;
}

/**
 * Schließt Löcher im Motiv. Ein weißes Kohlblatt oder eine Glanzstelle ist zu blass, um
 * die Sättigungsschwelle zu nehmen — ausgestanzt gehört sie trotzdem nicht.
 */
function fillHoles(mask: Uint8Array, width: number, height: number): void {
  const outside = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (p: number) => {
    if (mask[p] === 0 && outside[p] === 0) {
      outside[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (stack.length > 0) {
    const p = stack.pop()!;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) push(p - 1);
    if (x < width - 1) push(p + 1);
    if (y > 0) push(p - width);
    if (y < height - 1) push(p + width);
  }
  for (let p = 0; p < mask.length; p++) if (mask[p] === 0 && outside[p] === 0) mask[p] = 1;
}

/** Maske anwenden, auf den Inhalt zuschneiden und schreiben. */
async function writeMasked(raw: Raw, mask: Uint8Array, destination: string): Promise<void> {
  const { data, width, height } = raw;
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let p = 0; p < mask.length; p++) {
    if (mask[p] === 0) continue;
    const x = p % width;
    const y = (p - x) / width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const outWidth = maxX - minX + 1;
  const outHeight = maxY - minY + 1;
  const out = Buffer.alloc(outWidth * outHeight * 4);

  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x++) {
      const source = ((y + minY) * width + (x + minX)) * 4;
      const target = (y * outWidth + x) * 4;
      out[target] = data[source];
      out[target + 1] = data[source + 1];
      out[target + 2] = data[source + 2];
      out[target + 3] = mask[(y + minY) * width + (x + minX)] === 1 ? 255 : 0;
    }
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await sharp(out, { raw: { width: outWidth, height: outHeight, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(destination);
  console.log(`  ${path.relative(ROOT, destination)}  ${outWidth}x${outHeight}`);
}

async function extract(
  source: string,
  destination: string,
  options: KeyOptions,
  region?: sharp.Region,
): Promise<void> {
  const raw = await readRaw(source, region);
  await writeMasked(raw, foregroundMask(raw, options), destination);
}

/** Unveränderter Ausschnitt, ohne Freistellen. */
async function crop(source: string, destination: string, region: sharp.Region): Promise<void> {
  await mkdir(path.dirname(destination), { recursive: true });
  await sharp(source).extract(region).png({ compressionLevel: 9 }).toFile(destination);
  console.log(`  ${path.relative(ROOT, destination)}  ${region.width}x${region.height}`);
}

/**
 * Die Samen kommen als Inventarkarten aus dem Spiel: helle, getönte Karte mit Frucht und
 * Körnern darauf. Hier wird nicht freigestellt — die Karte *ist* das Motiv, und Frucht wie
 * Körner würden bei einer Sättigungs- oder Helligkeitsschwelle auseinanderfallen (die
 * Körner sind dunkelbraun, die Kohlblätter fast weiß). Stattdessen feste Ausschnitte, die
 * die Mengenangabe oben und die Namenszeile unten weglassen.
 *
 * Die Werte stammen aus den Helligkeitsprofilen der Quellbilder; wer eine neue Vorlage
 * einlegt, misst sie dort nach.
 */
const SEED_STRIP = "_strip-kohl-ananas-mandarinen.png";
const SEED_CROPS: { slug: string; source: string; region: sharp.Region }[] = [
  { slug: "kohlsamen", source: SEED_STRIP, region: { left: 30, top: 64, width: 212, height: 148 } },
  { slug: "ananas-samen", source: SEED_STRIP, region: { left: 298, top: 60, width: 216, height: 152 } },
  { slug: "mandarinen-samen", source: SEED_STRIP, region: { left: 562, top: 60, width: 214, height: 152 } },
  { slug: "kuerbiskerne", source: "kuerbiskerne.png", region: { left: 20, top: 54, width: 196, height: 138 } },
];

async function main() {
  console.log("Juices:");
  for (const file of (await readdir(path.join(SRC, "juices"))).filter((f) => f.endsWith(".png"))) {
    await extract(path.join(SRC, "juices", file), path.join(OUT, "juices", file), {
      mode: "color",
      tolerance: 48,
      dropBorderTouching: true,
      maxWidthRatio: 0.45,
      // Der weiße Rahmen ist hohl, die Bodenleiste liegt quer — die Flasche ist beides nicht.
      minFillRatio: 0.35,
      portraitOnly: true,
    });
  }

  console.log("Früchte & Gemüse:");
  for (const file of (await readdir(path.join(SRC, "produce"))).filter((f) => f.endsWith(".png"))) {
    await extract(path.join(SRC, "produce", file), path.join(OUT, "produce", file), {
      mode: "saturated",
      // 0.5 statt 0.3: der braune Sandboden hinter Ananas, Kürbis und Mandarinen ist
      // selbst gesättigt genug, um eine niedrigere Schwelle zu überspringen.
      tolerance: 0.5,
      darkFloor: 32,
    });
  }

  console.log("Samen:");
  for (const tile of SEED_CROPS) {
    await crop(path.join(SRC, "seeds", tile.source), path.join(OUT, "seeds", `${tile.slug}.png`), tile.region);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
