#!/usr/bin/env node
/**
 * Erzeugt stbib-katalog-modern.zip für die Weitergabe (ohne node_modules, tests, …).
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unlinkSync, existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = "stbib-katalog-modern.zip";

const entries = ["manifest.json", "README.md", "content.js", "popup", "styles", "icons"];

if (existsSync(path.join(ROOT, OUT))) {
  unlinkSync(path.join(ROOT, OUT));
}

const r = spawnSync(
  "zip",
  ["-r", OUT, ...entries],
  { cwd: ROOT, stdio: "inherit" }
);

if (r.status !== 0) {
  console.error("zip fehlgeschlagen. Auf macOS/Linux: zip installieren oder Ordner manuell zippen.");
  process.exit(r.status ?? 1);
}

console.log(`OK: ${path.join(ROOT, OUT)}`);
