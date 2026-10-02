import { describe, expect, it } from "vitest";
import "../../src/logic.js";

const logic = globalThis.stbib.logic;

const params = (url) => new URL(url).searchParams;

describe("searchUrl (Katalogsuche aus dem Popup)", () => {
  it("führt bei leerer Eingabe zur Schnellsuche", () => {
    for (const empty of ["", "   ", null, undefined]) {
      const url = logic.searchUrl(empty);
      expect(url.startsWith("https://katalog.stbib-koeln.de/alswww2.dll/APS_ZONES?")).toBe(true);
      expect(params(url).get("fn")).toBe("QuickSearch");
      expect(params(url).get("Style")).toBe("Portal3");
    }
  });

  it("baut eine Trefferliste mit normalisierter Anfrage", () => {
    const url = logic.searchUrl("  star   wars ");
    expect(params(url).get("fn")).toBe("Search");
    expect(params(url).get("q")).toBe("star wars");
    expect(params(url).get("Lang")).toBe("GER");
    expect(params(url).get("ResponseEncoding")).toBe("utf-8");
  });

  it("kodiert Sonderzeichen sicher", () => {
    const url = logic.searchUrl("Müller & Söhne #1");
    expect(params(url).get("q")).toBe("Müller & Söhne #1");
    expect(url).not.toContain("#");
  });

  it("schreibt eine ISBN um, solange die ISBN-Erkennung an ist", () => {
    expect(params(logic.searchUrl("978-3-551-55741-4")).get("q")).toBe(
      "isbn=9783551557414 or isbn=3551557411"
    );
    expect(
      params(logic.searchUrl("978-3-551-55741-4", { isbnRewrite: false })).get("q")
    ).toBe("978-3-551-55741-4");
  });
});
