// @vitest-environment jsdom
/**
 * `pages.mount()` läuft bei jedem Observer-Durchlauf. Die Text-Scans darin
 * sind teuer, dürfen aber nicht übersprungen werden, wenn das Portal den
 * Seiteninhalt neu gerendert hat – die Marker hängen dann an abgehängten
 * Knoten. Genau dieses Zusammenspiel prüfen die Tests hier.
 */
import { beforeEach, describe, expect, it } from "vitest";
import "../../src/logic.js";
import "../../src/util.js";
import "../../src/pages.js";

const pages = globalThis.stbib.pages;
const util = globalThis.stbib.util;

const RESERVATION_HTML = `
  <table>
    <tbody>
      <tr><td>Titel</td><td><span class="darkLink">Harry Potter</span></td></tr>
      <tr><td>Notation</td><td>21.Pb Rowling</td></tr>
    </tbody>
  </table>
  <table>
    <tbody>
      <tr><td>Bitte wählen Sie die Bibliothek für die Abholung</td></tr>
      <tr><td><select id="pickup"><option>Zentralbibliothek</option></select></td></tr>
    </tbody>
  </table>
  <p>Vormerkbare Exemplare: 2</p>
  <p>Das Entgelt für die Vormerkung beträgt 1,50 EUR.</p>
  <table>
    <tbody>
      <tr><td>Nummer des Bibliotheksausweises</td><td><input id="BRWR"></td></tr>
      <tr><td>PIN</td><td><input id="PIN" type="password"></td></tr>
      <tr><td><input type="submit" value="Bestätigen"> <a href="#">Abbrechen</a></td></tr>
    </tbody>
  </table>
`;

const QUICKSEARCH_HTML = `
  <form id="ExpertSearch">
    <div class="wrapper">
      <label for="Query">Suchanfrage eingeben</label>
      <input id="Query">
      <button id="buttonQuickSearch">Suchen</button>
    </div>
  </form>
`;

/** Alle Marker, die mountReservation() auf der Fixture setzen muss. */
const RESERVATION_MARKERS = [
  ".stbib-reservation-meta",
  ".stbib-reservation-pickup",
  ".stbib-reservation-status",
  ".stbib-reservation-fee",
  ".stbib-reservation-confirm",
  ".stbib-reservation-cancel",
  ".stbib-reservation-actions",
  ".stbib-reservation-login",
];

function markersPresent() {
  return RESERVATION_MARKERS.filter((selector) => document.querySelector(selector));
}

/** Zählt die Text-Scans, an denen die teuren Durchläufe erkennbar sind. */
function countingNormalizeSpace() {
  const original = util.normalizeSpace;
  let calls = 0;
  util.normalizeSpace = (value) => {
    calls += 1;
    return original(value);
  };
  return {
    get calls() {
      return calls;
    },
    restore() {
      util.normalizeSpace = original;
    },
  };
}

function setPage(url, inner) {
  window.history.replaceState({}, "", url);
  document.body.innerHTML = `<div id="pageContent">${inner}</div>`;
  return document.getElementById("pageContent");
}

beforeEach(() => {
  pages.unmount();
  document.documentElement.className = "";
});

describe("pages.mount – Vormerkung", () => {
  it("setzt alle semantischen Marker", () => {
    setPage("/?fn=MakeReservation", RESERVATION_HTML);
    pages.mount();

    expect(markersPresent()).toEqual(RESERVATION_MARKERS);
    expect(document.getElementById("pickup").getAttribute("aria-label")).toBe("Abholbibliothek");
    expect(document.getElementById("BRWR").getAttribute("autocomplete")).toBe("username");
    expect(document.getElementById("PIN").getAttribute("autocomplete")).toBe("current-password");
    expect(document.documentElement.classList.contains("stbib-form-document")).toBe(true);
  });

  it("überspringt die Text-Scans, solange die Marker stehen", () => {
    setPage("/?fn=MakeReservation", RESERVATION_HTML);
    pages.mount();

    const counter = countingNormalizeSpace();
    try {
      pages.mount();
      expect(counter.calls, "zweiter mount() darf nicht erneut scannen").toBe(0);
    } finally {
      counter.restore();
    }
  });

  it("setzt die Marker neu, wenn das Portal den Seiteninhalt neu rendert", () => {
    const page = setPage("/?fn=MakeReservation", RESERVATION_HTML);
    pages.mount();
    expect(markersPresent()).toEqual(RESERVATION_MARKERS);

    // Portal ersetzt den Formularinhalt (etwa nach einem Validierungsfehler):
    // derselbe #pageContent, komplett neue Kindknoten.
    page.innerHTML = RESERVATION_HTML;
    expect(markersPresent(), "nach dem Neu-Rendern sind die Marker weg").toEqual([]);

    pages.mount();
    expect(markersPresent(), "mount() muss die neuen Knoten markieren").toEqual(
      RESERVATION_MARKERS
    );
    expect(document.getElementById("pickup").getAttribute("aria-label")).toBe("Abholbibliothek");
  });

  it("nimmt beim unmount() auch die nach einem Neu-Rendern gesetzten Marker zurück", () => {
    const page = setPage("/?fn=MakeReservation", RESERVATION_HTML);
    pages.mount();
    page.innerHTML = RESERVATION_HTML;
    pages.mount();

    pages.unmount();
    expect(markersPresent()).toEqual([]);
    expect(document.getElementById("pickup").hasAttribute("aria-label")).toBe(false);
    expect(document.getElementById("BRWR").hasAttribute("autocomplete")).toBe(false);
    expect(document.documentElement.classList.contains("stbib-form-document")).toBe(false);
  });
});

describe("pages.mount – Schnellsuche", () => {
  it("beschriftet das Suchfeld und stellt es beim unmount() zurück", () => {
    setPage("/", QUICKSEARCH_HTML);
    pages.mount();

    expect(document.querySelector('label[for="Query"]').textContent).toBe("Suchbegriff");
    expect(document.getElementById("Query").getAttribute("autocomplete")).toBe("off");
    expect(document.querySelector(".stbib-quicksearch-intro")).toBeTruthy();

    pages.unmount();
    expect(document.querySelector('label[for="Query"]').textContent).toBe("Suchanfrage eingeben");
    expect(document.getElementById("Query").hasAttribute("autocomplete")).toBe(false);
    expect(document.querySelector(".stbib-quicksearch-intro")).toBeNull();
  });

  it("beschriftet ein neu gerendertes Suchfeld erneut", () => {
    const page = setPage("/", QUICKSEARCH_HTML);
    pages.mount();

    page.innerHTML = QUICKSEARCH_HTML;
    pages.mount();

    expect(document.querySelector('label[for="Query"]').textContent).toBe("Suchbegriff");
    expect(document.getElementById("Query").getAttribute("autocomplete")).toBe("off");
  });
});
