/**
 * Verträge zwischen Dateien, die keineImporte teilen können: Die
 * Content-Script-Dateien laden über das Manifest, das Popup kennt nur seine
 * eigenen Schlüssel. Diese Tests werfen Erschleichungen auf, wenn eine Seite
 * der Liste gepflegt wird und die andere vergessen geht.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const contentSource = read("content.js");
const manifest = JSON.parse(read("manifest.json"));

function stylesheetsFromContentJs() {
  const match = /const STYLESHEETS = (\[[^\]]+\])/.exec(contentSource);
  expect(match, "STYLESHEETS in content.js gefunden").toBeTruthy();
  // Trailing comma ist im JS-Quelltext erlaubt, in JSON nicht.
  return JSON.parse(match[1].replace(/'/g, '"').replace(/,(\s*\])/g, "$1"));
}

function storageDefaultsFromContentJs() {
  const match = /const STORAGE_DEFAULTS = \{([^}]+)\}/.exec(contentSource);
  expect(match, "STORAGE_DEFAULTS in content.js gefunden").toBeTruthy();
  const defaults = {};
  for (const [, key, value] of match[1].matchAll(/(\w+):\s*(true|false)/g)) {
    defaults[key] = value === "true";
  }
  return defaults;
}

function togglesFromPopupJs() {
  const source = read("popup/popup.js");
  const toggles = {};
  for (const [, key, fallback] of source.matchAll(/key:\s*'(\w+)',\s*fallback:\s*(true|false)/g)) {
    toggles[key] = fallback === "true";
  }
  return toggles;
}

describe("Manifest-Verträge", () => {
  it("web_accessible_resources entspricht STYLESHEETS aus content.js (Reihenfolge inklusive)", () => {
    expect(manifest.web_accessible_resources[0].resources).toEqual(
      stylesheetsFromContentJs()
    );
  });

  it("alle Content-Scripts und Stylesheets existieren auf der Platte", () => {
    const files = [
      ...manifest.content_scripts.flatMap((script) => script.js),
      ...manifest.web_accessible_resources.flatMap((entry) => entry.resources),
    ];
    for (const file of files) {
      expect(() => readFileSync(new URL(file, root)), file).not.toThrow();
    }
  });

  it("lädt src/logic.js vor src/util.js", () => {
    /*
     * `util.js` liest `stbib.logic.nodesToText` & Co. beim Auswerten seines
     * IIFE – nicht erst beim Aufruf. Steht logic.js im Manifest dahinter, ist
     * `stbib.logic` noch undefined, util.js wirft beim Laden, und damit fällt
     * die komplette Erweiterung aus. Klassische Content-Scripts haben keine
     * Imports, die das erzwingen könnten; also prüft es der Test.
     */
    const scripts = manifest.content_scripts[0].js;
    expect(scripts).toContain("src/logic.js");
    expect(scripts.indexOf("src/logic.js")).toBeLessThan(scripts.indexOf("src/util.js"));
  });

  it("lädt src/util.js vor allen Modulen, die es beim Laden auslesen", () => {
    // holdings.js/query.js greifen im IIFE auf stbib.util und stbib.logic zu.
    const scripts = manifest.content_scripts[0].js;
    const utilAt = scripts.indexOf("src/util.js");
    for (const module of ["src/holdings.js", "src/query.js", "src/facets.js"]) {
      expect(scripts.indexOf(module), module).toBeGreaterThan(utilAt);
    }
    // content.js bindet alle Module ein und muss zuletzt kommen.
    expect(scripts[scripts.length - 1]).toBe("content.js");
  });

  it("style/theme-Dateien sind nicht doppelt gelistet", () => {
    const resources = manifest.web_accessible_resources[0].resources;
    expect(new Set(resources).size).toBe(resources.length);
  });
});

describe("Storage-Verträge", () => {
  it("Popup-Schalter und STORAGE_DEFAULTS decken dieselben Keys ab", () => {
    const defaults = storageDefaultsFromContentJs();
    const toggles = togglesFromPopupJs();

    expect(Object.keys(toggles).sort()).toEqual(Object.keys(defaults).sort());
    for (const [key, fallback] of Object.entries(toggles)) {
      expect({ key, fallback: defaults[key] }).toEqual({ key, fallback });
    }
  });
});
