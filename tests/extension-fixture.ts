/**
 * Chromium mit entpackter Erweiterung (nur content_scripts – kein Service Worker nötig).
 * @see https://playwright.dev/docs/chrome-extensions
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { chromium, type BrowserContext } from "@playwright/test";

export const EXTENSION_ROOT = path.resolve(__dirname, "..");

export async function launch_with_extension(): Promise<BrowserContext> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "stbib-pw-"));
  return chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_ROOT}`,
      `--load-extension=${EXTENSION_ROOT}`,
    ],
  });
}
