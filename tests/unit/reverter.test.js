// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import "../../src/logic.js";
import "../../src/util.js";

const util = globalThis.stbib.util;

describe("util.reverter", () => {
  it("stellt neue Attribute durch Entfernen wieder her", () => {
    const node = document.createElement("input");
    const undo = util.reverter();

    undo.setAttribute(node, "autocomplete", "username");
    expect(node.getAttribute("autocomplete")).toBe("username");

    undo.restore();
    expect(node.hasAttribute("autocomplete")).toBe(false);
  });

  it("stellt veränderte Attributwerte wieder her", () => {
    const node = document.createElement("input");
    node.setAttribute("value", "original");
    const undo = util.reverter();

    undo.setAttribute(node, "value", "geändert");
    undo.restore();
    expect(node.getAttribute("value")).toBe("original");
  });

  it("stellt Text wieder her", () => {
    // setText zielt auf reine Textknoten; der Restore setzt textContent und
    // kann darum keine Kindelemente bewahren (so war es auch im Original).
    const label = document.createElement("label");
    label.textContent = "Benutzerkennung";
    const undo = util.reverter();

    undo.setText(label, "Ausweisnummer");
    expect(label.textContent).toBe("Ausweisnummer");

    undo.restore();
    expect(label.textContent).toBe("Benutzerkennung");
  });

  it("stellt ersetzte Kindknoten wieder her", () => {
    const pinLabel = document.createElement("label");
    pinLabel.append("PIN", document.createElement("small"));
    const undo = util.reverter();

    undo.setChildren(pinLabel, document.createTextNode("PIN oder Zugangscode"));
    expect(pinLabel.textContent).toBe("PIN oder Zugangscode");

    undo.restore();
    expect(pinLabel.textContent).toBe("PIN");
    expect(pinLabel.querySelectorAll("small")).toHaveLength(1);
  });

  it("entfernt hinzugefügte Klassen wieder, ohne fremde anzutasten", () => {
    const node = document.createElement("div");
    node.className = "portal-class";
    const undo = util.reverter();

    undo.addClass(node, "stbib-own");
    undo.restore();
    expect(node.className).toBe("portal-class");
  });

  it("setzt verschobene Knoten an die alte Position zurück", () => {
    const parent = document.createElement("div");
    const form = document.createElement("form");
    const advice = document.createElement("div");
    parent.append(advice, form); // Ausgangslage: Formular nach dem Hinweis
    document.body.append(parent); // Verschiebungen werden nur verbundener Teilbäume restauriert
    try {
      const undo = util.reverter();

      undo.moveBefore(form, advice);
      expect(parent.children[0]).toBe(form);
      expect(parent.children[1]).toBe(advice);

      undo.restore();
      expect(parent.children[0]).toBe(advice);
      expect(parent.children[1]).toBe(form);
    } finally {
      parent.remove();
    }
  });

  it("mehrfache restore()-Aufrufe sind harmlos", () => {
    const node = document.createElement("div");
    const undo = util.reverter();
    undo.addClass(node, "stbib-own");
    undo.restore();
    undo.restore();
    expect(node.className).toBe("");
  });
});
