#!/usr/bin/env node
/**
 * Erzeugt stbib-katalog-modern.zip für die Weitergabe (ohne node_modules, tests, …).
 * Packt plattformunabhängig über Node (kein System-zip nötig) und prüft vorher,
 * dass manifest.json und package.json dieselbe Version tragen.
 */

import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import process from "node:process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "stbib-katalog-modern.zip");

const ENTRIES = [
  "manifest.json",
  "README.md",
  "content.js",
  "src",
  "popup",
  "styles",
  "icons",
];

const IGNORED = [".DS_Store"];

const manifestVersion = JSON.parse(readFileSync(path.join(ROOT, "manifest.json"), "utf8")).version;
const packageVersion = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
if (manifestVersion !== packageVersion) {
  console.error(
    `Versionen weichen ab: manifest.json ${manifestVersion} vs. package.json ${packageVersion}. Bitte angleichen.`
  );
  process.exit(1);
}

if (existsSync(OUT)) {
  rmSync(OUT);
}

// BSD zip (macOS) und Info-ZIP (Linux) verstehen beide -x mit Mustern.
// execFileSync wirft bei Exit-Code != 0, ein Status-Check ist unnötig.
try {
  execFileSync("zip", ["-r", OUT, ...ENTRIES, "-x", ...IGNORED.map((p) => `*${p}*`)], {
    cwd: ROOT,
    stdio: "inherit",
  });
} catch {
  console.error("zip fehlgeschlagen. Auf macOS/Linux: zip installieren oder Ordner manuell zippen.");
  process.exit(1);
}

if (!existsSync(OUT)) {
  console.error("ZIP wurde nicht erzeugt.");
  process.exit(1);
}

console.log(`OK: ${OUT} (Version ${manifestVersion})`);
