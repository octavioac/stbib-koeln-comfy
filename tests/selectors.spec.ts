import { test, expect, request as playwrightRequest } from "@playwright/test";

/**
 * Selektor-Gesundheitscheck.
 *
 * Die Erweiterung hängt an Klassen, IDs und URL-Parametern, die das Portal
 * serverseitig erzeugt. Ändert die Stadtbibliothek ihre Templates, sollen diese
 * Tests laut scheitern – nicht erst ein Nutzer, dem eine Funktion still fehlt.
 *
 * Läuft ohne Browser (reine HTTP-Abfragen) und damit schnell.
 */

const BASE = "https://katalog.stbib-koeln.de/alswww2.dll";
const SEARCH_URL = `${BASE}/APS_ZONES?fn=Search&q=harry+potter&Style=Portal3&Lang=GER&ResponseEncoding=utf-8`;
const QUICKSEARCH_URL = `${BASE}/APS_ZONES?fn=QuickSearch&Style=Portal3&Lang=GER&ResponseEncoding=utf-8`;
const ACCOUNT_URL = `${BASE}/APS_ZONES?fn=MyZone&Style=Portal3&Lang=GER&ResponseEncoding=utf-8`;

async function fetchText(url: string): Promise<string> {
  const context = await playwrightRequest.newContext();
  try {
    const response = await context.get(url, { timeout: 60000 });
    expect(response.status(), `HTTP-Status für ${url}`).toBe(200);
    return await response.text();
  } finally {
    await context.dispose();
  }
}

test.describe("Portal-Vertrag: Schnellsuche", () => {
  test("Suchformular und Auslöser sind unverändert", async () => {
    const html = await fetchText(QUICKSEARCH_URL);

    // query.js hängt an diesem Feld und diesem Button.
    expect(html, "Suchfeld q.Query").toContain('name=q.Query');
    expect(html, "Suchfeld-ID Query").toContain("id=Query");
    expect(html, "Such-Button").toContain('id="buttonQuickSearch"');
    // Der Button ruft form.submit() direkt auf – deshalb Capture-Listener
    // statt submit-Event. Ändert sich das, darf der Test auffallen.
    expect(html, "startSearch() als Auslöser").toContain("startSearch()");
  });
});

test.describe("Portal-Vertrag: Trefferliste", () => {
  let html = "";

  test.beforeAll(async () => {
    html = await fetchText(SEARCH_URL);
  });

  test("Trefferliste, Titel-ID und Blätter-Link sind vorhanden", () => {
    expect(html, "Trefferliste #BrowseList").toContain('id="BrowseList"');
    expect(html, "Trefferzahl „Ergebnisse (n)“").toMatch(/Ergebnisse\s*\(\s*\d+/);

    // holdings.js liest die Titel-ID aus einer dieser Stellen.
    expect(html, "Titel-ID (T…) in der Zeile").toMatch(/fn=MakeReservation&(?:amp;)?q=T\d+/);

    // loadmore.js braucht PageDown + die Seitenanzeige.
    expect(html, "PageDown-Link").toMatch(/Method=PageDown/);
    expect(html, "Seiten-Eingabefeld").toContain('name="Query.Page"');
  });

  test("Datenzelle der Trefferzeile trägt eine SummaryDataCell-Klasse", () => {
    expect(html, "SummaryDataCell(-Stripe)").toMatch(/class="[^"]*SummaryDataCell/);
  });

  test("Facetten-Struktur trägt das Kachel-Layout", () => {
    expect(html, "FacetBox").toContain('class="FacetBox"');
    expect(html, "FacetHeader").toMatch(/class="FacetHeader/);
    expect(html, "FacetsList").toMatch(/class="FacetsList/);
    expect(html, "Facettenlinks").toContain('class="FacetLinkA"');

    // facets.js verlässt sich darauf, dass „arrow_down“ = zugeklappt ist und
    // das Portal-JS per next() die Liste animiert.
    expect(html, "arrow_down am Header").toMatch(/class="FacetHeader arrow_down"/);
    expect(html, "slideToggle über next()").toContain(".next().slideToggle");
  });
});

test.describe("Portal-Vertrag: Bestand über den Permalink", () => {
  test("ViewNotice liefert den Bestand aller Zweigstellen ohne Session", async () => {
    const searchHtml = await fetchText(SEARCH_URL);
    const recordId = /fn=MakeReservation&(?:amp;)?q=(T\d+)/.exec(searchHtml)?.[1];
    expect(recordId, "Titel-ID aus der Trefferliste").toBeTruthy();

    const notice = await fetchText(
      `${BASE}/APS_ZONES?fn=ViewNotice&Style=Portal3&q=${recordId}`
    );

    // Ohne diese beiden Blöcke kann holdings.js nichts auslesen.
    expect(notice, "stock_header_<code>").toMatch(/id="stock_header_\w+"/);
    expect(notice, "stock_content_<code>").toMatch(/id="stock_content_\w+"/);

    // Status-Vokabular: Verfügbar / Entliehen werden farblich unterschieden.
    expect(notice, "Statusangabe").toMatch(/<b>\s*(?:Verf[üu]gbar|Entliehen)\s*<\/b>/);
  });
});

test.describe("Portal-Vertrag: ISBN-Suche", () => {
  test("blanke ISBN findet nichts, isbn= findet den Titel", async () => {
    const isbn = "9783551557414";

    const bare = await fetchText(
      `${BASE}/APS_ZONES?fn=Search&q=${isbn}&Style=Portal3&Lang=GER&ResponseEncoding=utf-8`
    );
    const qualified = await fetchText(
      `${BASE}/APS_ZONES?fn=Search&q=isbn%3D${isbn}&Style=Portal3&Lang=GER&ResponseEncoding=utf-8`
    );

    // Genau dieser Unterschied ist der Grund für query.js. Fällt er weg, kann
    // die Umschreibung raus.
    expect(bare, "blanke ISBN ohne Treffer").toContain("keine Titel");
    expect(qualified, "isbn= mit Treffer").toMatch(/Ergebnisse\s*\(\s*[1-9]/);

    // Der Hinweiskasten hängt an dieser Tabelle.
    expect(bare, "#ErrorAdvice").toContain('id="ErrorAdvice"');
  });
});

test.describe("Portal-Vertrag: Mein Konto", () => {
  test("Login-Seite liefert die erwarteten Felder und Hilfebereiche", async () => {
    const html = await fetchText(ACCOUNT_URL);

    expect(html, "Login-Formular").toContain('id="LoginForm"');
    expect(html, "Ausweisnummer").toContain('id="BRWR"');
    expect(html, "PIN").toContain('id="PIN"');
    expect(html, "PIN-Hinweise").toContain('class="loginAdvice"');
    expect(html, "PIN vergessen").toContain('class="LoginForgotPinCell"');
  });
});
