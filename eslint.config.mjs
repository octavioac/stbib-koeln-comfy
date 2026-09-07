import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/**", "test-results/**", "playwright-report/**", "tests/*.ts"] },
  js.configs.recommended,
  {
    // Content-Scripts: klassische Skripte in Browser-Umgebung.
    files: ["content.js", "src/**/*.js", "popup/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "script",
      globals: { ...globals.browser, chrome: "readonly", stbib: "readonly" },
    },
    rules: {
      // src-Module deklarieren den Namensraum bewusst per
      // `var stbib = globalThis.stbib || …` – kein Konflikt mit dem Global.
      "no-redeclare": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs", "tests/unit/**/*.js", "eslint.config.mjs", "vitest.config.mts"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
  },
];
