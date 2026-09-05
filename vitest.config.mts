import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Nur die Offline-Unit-Tests; tests/*.spec.ts gehören zu Playwright.
    include: ["tests/unit/**/*.test.js"],
    environment: "node",
  },
});
