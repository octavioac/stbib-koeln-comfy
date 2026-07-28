import { test, expect, type Page } from "@playwright/test";
import { launch_with_extension } from "./extension-fixture";

/**
 * Ende-zu-Ende-Tests der Komfort-Funktionen gegen den echten Katalog.
 * Der reine Selektor-Vertrag steckt in selectors.spec.ts.
 */

const CATALOG_ORIGIN = "https://katalog.stbib-koeln.de";
const QUICKSEARCH_PATH = "/alswww2.dll/APS_ZONES?fn=QuickSearch&Style=Portal3";

/**
 * Jeder Test startet ein eigenes Browserprofil ohne Cache und lädt damit die
 * komplette Seite samt Assets neu. Kommen diese Läufe dicht hintereinander,
 * antwortet der Katalog gelegentlich mit 503. Die Pause hält die Suite
 * verträglich – für den Server und für die Aussagekraft der Ergebnisse.
 */
test.afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 3000));
});

async function searchFor(page: Page, term: string): Promise<void> {
  await page.goto(`${CATALOG_ORIGIN}${QUICKSEARCH_PATH}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // Der Such-Button ist ein `javascript:startSearch()`-Link. Vor dem Klick muss
  // das Portal-JS geladen sein, sonst passiert schlicht nichts.
  await expect(page.getByRole("heading", { name: "Schnellsuche" })).toBeVisible({
    timeout: 30000,
  });
  await page.waitForFunction(() => typeof (window as any).startSearch === "function", null, {
    timeout: 30000,
  });

  // Und die Erweiterung muss aktiv sein: Die eingehängten Stylesheets sind das
  // Signal dafür, dass content.js die Einstellungen gelesen und die Module
  // angewendet hat.
  await page
    .locator('link[data-stbib-katalog-modern]')
    .first()
    .waitFor({ state: "attached", timeout: 30000 });

  await page.locator('input[name="q.Query"]').fill(term);
  await page.locator("#buttonQuickSearch").click();
}

test.describe("Bestand in der Trefferliste", () => {
  test("zeigt Verfügbarkeit ohne den Treffer zu öffnen", async () => {
    const context = await launch_with_extension();
    const page = await context.newPage();

    await searchFor(page, "harry potter");
    await expect(page.locator("#BrowseList")).toBeVisible({ timeout: 45000 });

    const toggles = page.locator(".stbib-holdings__toggle");
    await expect(toggles.first()).toBeVisible({ timeout: 20000 });
    expect(await toggles.count(), "eine Schaltfläche pro Trefferzeile").toBeGreaterThan(1);

    await expect(page.locator(".stbib-toolbar__button")).toBeVisible();

    const firstRow = page.locator(".stbib-holdings").first();
    await firstRow.locator(".stbib-holdings__toggle").click();

    // Nach dem Laden gibt es eine Zusammenfassung und je Zweigstelle einen Block.
    await expect(firstRow.locator(".stbib-holdings__badge")).toBeVisible({ timeout: 30000 });
    await expect(firstRow).toHaveAttribute("data-stbib-state", /done|empty/, {
      timeout: 30000,
    });

    const state = await firstRow.getAttribute("data-stbib-state");
    if (state === "done") {
      await expect(firstRow.locator(".stbib-branch").first()).toBeVisible();
      await expect(firstRow.locator(".stbib-branch__name").first()).not.toBeEmpty();
    }

    await context.close();
  });
});

test.describe("Mehr laden", () => {
  test("hängt weitere Treffer an die Liste an", async () => {
    const context = await launch_with_extension();
    const page = await context.newPage();

    await searchFor(page, "koeln");
    await expect(page.locator("#BrowseList")).toBeVisible({ timeout: 45000 });

    const bar = page.locator(".stbib-loadmore");
    await expect(bar).toBeVisible({ timeout: 20000 });
    await expect(bar.locator(".stbib-loadmore__status")).toContainText(/Treffer 1–10 von \d+/);

    const rows = page.locator("#BrowseList > tbody > tr");
    const before = await rows.count();

    await bar.locator(".stbib-loadmore__button").click();

    await expect
      .poll(async () => rows.count(), { timeout: 45000 })
      .toBeGreaterThan(before);
    await expect(bar.locator(".stbib-loadmore__status")).toContainText(/Treffer 1–20 von \d+/);

    await context.close();
  });
});

test.describe("ISBN-Erkennung", () => {
  test("findet einen Titel über die blanke ISBN", async () => {
    const context = await launch_with_extension();
    const page = await context.newPage();

    // Ohne die Erweiterung liefert diese Eingabe „keine Titel“ (s. selectors.spec.ts).
    await searchFor(page, "978-3-551-55741-4");

    await expect(page.locator(".searchHits")).toContainText(/Ergebnisse\s*\(/, {
      timeout: 45000,
    });
    await expect(page.locator("#BrowseList")).toBeVisible();

    await context.close();
  });

  test("bietet auf der Nulltrefferseite einen ISBN-Link an", async () => {
    const context = await launch_with_extension();
    const page = await context.newPage();

    // Direkter Aufruf ohne Suchfeld – hier greift nur der Hinweiskasten.
    await page.goto(
      `${CATALOG_ORIGIN}/alswww2.dll/APS_ZONES?fn=Search&q=9783551557414&Style=Portal3&Lang=GER&ResponseEncoding=utf-8`,
      { waitUntil: "domcontentloaded", timeout: 60000 }
    );

    const hint = page.locator(".stbib-isbn-hint");
    await expect(hint).toBeVisible({ timeout: 20000 });

    await hint.locator(".stbib-isbn-hint__link").click();
    await expect(page.locator(".searchHits")).toContainText(/Ergebnisse\s*\(/, {
      timeout: 45000,
    });

    await context.close();
  });
});

test.describe("Facetten", () => {
  test("lange Facette bekommt ein Filterfeld", async () => {
    const context = await launch_with_extension();
    const page = await context.newPage();

    await searchFor(page, "harry potter");
    await expect(page.locator("#BrowseList")).toBeVisible({ timeout: 45000 });

    // Kachel-Wrapping der Erweiterung
    await expect(page.locator(".stbib-facet-tile").first()).toBeVisible({ timeout: 20000 });

    /*
     * Das Auf-/Zuklappen der Facette ist kein Verhalten der Erweiterung,
     * sondern von jQuery gebunden – innerhalb eines `$(document).ready(...)`,
     * das erst nach vollständigem Parsen feuert. Die Erweiterung selbst
     * mountet inzwischen (`document_start`, gegen FOUC) oft schon vorher, das
     * Kachel-Wrapping kann also sichtbar sein, bevor der Klick überhaupt etwas
     * bewirkt. `document.readyState` ist dafür kein verlässlicher Ersatz –
     * jQuery 1.4.2 hat einen eigenen, teils asynchronen Ready-Mechanismus, der
     * knapp nach dem reinen Statuswechsel feuern kann. Wir fragen daher
     * jQuery selbst: Ein über `window.jQuery(fn)` registriertes Callback
     * feuert garantiert erst NACH allen zuvor registrierten – darunter dem
     * Portal-eigenen Klick-Handler.
     */
    await page.evaluate(() => new Promise((resolve) => (window as any).jQuery(resolve)));

    // „Autor“ liefert bis zu 50 Werte – hier lohnt der Filter.
    const authorTile = page
      .locator(".stbib-facet-tile")
      .filter({ has: page.locator(".FacetHeader", { hasText: "Autor" }) })
      .first();
    await authorTile.locator(".FacetHeader").click();

    const filter = authorTile.locator(".stbib-facet-filter__input");
    await expect(filter).toBeVisible({ timeout: 20000 });

    const links = authorTile.locator(".FacetLinkA:visible");
    const before = await links.count();
    expect(before, "Facettenwerte vor dem Filtern").toBeGreaterThan(1);

    await filter.fill("zzzzzz-gibt-es-nicht");
    await expect(authorTile.locator(".stbib-facet-filter__empty")).toBeVisible();
    expect(await links.count(), "nach dem Filtern nichts mehr sichtbar").toBe(0);

    await filter.fill("");
    await expect
      .poll(async () => links.count(), { timeout: 10000 })
      .toBe(before);

    await context.close();
  });
});
