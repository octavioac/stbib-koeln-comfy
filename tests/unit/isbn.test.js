// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import "../../src/logic.js";

const logic = globalThis.stbib.logic;

describe("rewrite (ISBN-Suche)", () => {
  it("schreibt ISBN-13 mit Bindestrichen in beide Schreibweisen um", () => {
    expect(logic.rewrite("978-3-551-55741-4")).toBe(
      "isbn=9783551557414 or isbn=3551557411"
    );
  });

  it("schreibt ISBN-13 ohne Trennzeichen genauso um", () => {
    expect(logic.rewrite("9783551557414")).toBe(
      "isbn=9783551557414 or isbn=3551557411"
    );
  });

  it("schreibt ISBN-10 (auch klein geschriebenem X) um", () => {
    expect(logic.rewrite("3551557411")).toBe(
      "isbn=9783551557414 or isbn=3551557411"
    );
    expect(logic.rewrite("080442957x")).toContain("isbn=080442957X");
  });

  it("lässt Nicht-ISBN unangetastet", () => {
    expect(logic.rewrite("harry potter")).toBeNull();
    expect(logic.rewrite("")).toBeNull();
    expect(logic.rewrite(null)).toBeNull();
  });

  it("lässt qualifizierte Anfragen unangetastet", () => {
    expect(logic.rewrite("au=rowling")).toBeNull();
    expect(logic.rewrite("isbn=3551557411")).toBeNull();
    expect(logic.rewrite("ti=harry potter")).toBeNull();
  });

  it("prüft die Prüfsummen wirklich", () => {
    expect(logic.rewrite("9783551557415")).toBeNull(); // falsche Prüfziffer
    expect(logic.rewrite("3551557412")).toBeNull(); // falsche Prüfziffer
    expect(logic.rewrite("1234567890123")).toBeNull(); // 13 Ziffern, keine gültige ISBN-13
  });

  it("liefert ISBN-13 ohne ISBN-10-Äquivalent ohne Variante", () => {
    // 979er-Bereich: kein 978-Präfix → keine ISBN-10-Rückübersetzung
    const nine79 = "9791234567896"; // Prüfsumme gültig
    expect(logic.rewrite(nine79)).toBe(`isbn=${nine79}`);
  });
});

describe("isbnVariants", () => {
  it("liefert beide Richtungen für 978-ISBN-13", () => {
    expect(logic.isbnVariants("9783551557414")).toEqual([
      "9783551557414",
      "3551557411",
    ]);
  });

  it("liefert null für Text", () => {
    expect(logic.isbnVariants("wochte")).toBeNull();
  });
});
