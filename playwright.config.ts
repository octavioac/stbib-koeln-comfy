import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // Nur die Live-Specs; tests/unit/*.test.js gehören zu Vitest (npm run test:unit).
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  /*
   * Die Tests laufen gegen den echten Katalog. Bei vielen Aufrufen kurz
   * hintereinander liefert das Portal gelegentlich Fehler- statt Inhaltsseiten –
   * ein Wiederholungsversuch trennt das von echten Regressionen.
   */
  retries: process.env.CI ? 2 : 1,
  use: {
    trace: "on-first-retry",
  },
});
