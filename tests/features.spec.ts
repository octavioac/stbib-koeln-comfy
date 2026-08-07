import { test, expect, type Page } from "@playwright/test";
import { launch_with_extension } from "./extension-fixture";

/**
 * Ende-zu-Ende-Tests der Komfort-Funktionen gegen den echten Katalog.
 * Der reine Selektor-Vertrag steckt in selectors.spec.ts.
 */

const CATALOG_ORIGIN = "https://katalog.stbib-koeln.de";
const QUICKSEARCH_PATH = "/alswww2.dll/APS_ZONES?fn=QuickSearch&Style=Portal3";
const ACCOUNT_PATH =
  "/alswww2.dll/APS_ZONES?fn=MyZone&Style=Portal3&Lang=GER&ResponseEncoding=utf-8";

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
    await expect
      .poll(async () => toggles.count(), {
        message: "eine Schaltfläche pro Trefferzeile",
        timeout: 20000,
      })
      .toBeGreaterThan(1);

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
  test("filtert lange Facetten und stellt aktive Filter entfernbar dar", async () => {
    const context = await launch_with_extension();
    const page = await context.newPage();

    await searchFor(page, "harry potter");
    await expect(page.locator("#BrowseList")).toBeVisible({ timeout: 45000 });

    // Kachel-Wrapping der Erweiterung
    await expect(page.locator(".stbib-facet-tile").first()).toBeVisible({ timeout: 20000 });
    const resultsShell = await page.locator("#Global").boundingBox();
    expect(resultsShell).not.toBeNull();
    expect(resultsShell!.width).toBeLessThanOrEqual(940);
    const facetsBox = await page.locator(".FacetsContainer").boundingBox();
    const headingBox = await page.locator(".FacetBoxHeader").boundingBox();
    const firstTileBox = await page.locator(".stbib-facet-tile").first().boundingBox();
    expect(facetsBox).not.toBeNull();
    expect(headingBox).not.toBeNull();
    expect(firstTileBox).not.toBeNull();
    expect(headingBox!.x).toBe(firstTileBox!.x);
    expect(headingBox!.x).toBeGreaterThan(facetsBox!.x);

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
    const resultsY = (await page.locator("#BrowseList").boundingBox())!.y;
    await authorTile.locator(".FacetHeader").click();

    const filter = authorTile.locator(".stbib-facet-filter__input");
    await expect(filter).toBeVisible({ timeout: 20000 });
    const listBox = await authorTile.locator(".FacetsList").boundingBox();
    const facetBox = await page.locator(".FacetBox").boundingBox();
    expect(listBox).not.toBeNull();
    expect(facetBox).not.toBeNull();
    expect(Math.abs((await page.locator("#BrowseList").boundingBox())!.y - resultsY)).toBeLessThan(2);
    expect(listBox!.x).toBeGreaterThanOrEqual(facetBox!.x);
    expect(listBox!.x + listBox!.width).toBeLessThanOrEqual(facetBox!.x + facetBox!.width + 1);

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

    await links.first().click();
    const activeFilter = page.locator(".stbib-active-filter").first();
    await expect(activeFilter).toBeVisible({ timeout: 45000 });
    const removeFilter = activeFilter.locator(".stbib-active-filter__remove");
    await expect(removeFilter).toHaveAttribute("aria-label", /Filter .+ entfernen/);
    expect(
      await removeFilter.evaluate((element) => getComputedStyle(element, "::before").content)
    ).toContain("×");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(390);
    await expect(activeFilter).toBeVisible();

    await removeFilter.click();
    await expect(page.locator(".stbib-active-filter")).toHaveCount(0, { timeout: 45000 });

    await context.close();
  });
});

test.describe("Mein Konto", () => {
  test("stellt das Login-Formular responsiv und autofill-freundlich dar", async () => {
    const context = await launch_with_extension();
    const page = await context.newPage();

    await page.goto(`${CATALOG_ORIGIN}${ACCOUNT_PATH}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const accountPage = page.locator("#pageContent.stbib-account-page");
    await expect(accountPage).toBeVisible({ timeout: 20000 });
    await expect(page.locator("#BRWR")).toHaveAttribute("autocomplete", "username");
    await expect(page.locator("#PIN")).toHaveAttribute("autocomplete", "current-password");
    await expect(page.locator(".stbib-account-intro")).toBeVisible();
    await expect(page.locator(".MyZonetitleText")).toHaveText(
      "In Ihr Bibliothekskonto einloggen"
    );
    await expect(page.locator('label[for="PIN"]')).toHaveText(
      "PIN oder vorläufiger Zugangscode"
    );

    const borrowerBox = await page.locator("#BRWR").boundingBox();
    const pinBox = await page.locator("#PIN").boundingBox();
    expect(borrowerBox).not.toBeNull();
    expect(pinBox).not.toBeNull();
    expect(borrowerBox!.height).toBe(pinBox!.height);
    expect(
      await page.locator("#LoginForm").evaluate((form) => {
        const advice = document.querySelector(".loginAdvice");
        const container = advice?.parentElement
          ? Array.from(advice.parentElement.children).find((child) => child.contains(form))
          : null;
        return container?.nextElementSibling === advice;
      })
    ).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("#buttonLoginSubmit")).toHaveCSS("width", /\d+px/);
    const formBox = await page.locator("#LoginForm").boundingBox();
    expect(formBox).not.toBeNull();
    expect(formBox!.x).toBeGreaterThanOrEqual(0);
    expect(formBox!.x + formBox!.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await context.close();
  });
});

test.describe("Formularseiten", () => {
  test("stellt die Schnellsuche als kompakte responsive Karte dar", async () => {
    const context = await launch_with_extension();
    const page = await context.newPage();

    await page.goto(`${CATALOG_ORIGIN}${QUICKSEARCH_PATH}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await expect(page.locator("#pageContent.stbib-quicksearch-page")).toBeVisible({
      timeout: 20000,
    });
    await expect(page.locator('label[for="Query"]')).toHaveText("Suchbegriff");
    await expect(page.locator(".stbib-quicksearch-intro")).toBeVisible();
    const labelBox = await page.locator('label[for="Query"]').boundingBox();
    const queryBox = await page.locator("#Query").boundingBox();
    expect(labelBox).not.toBeNull();
    expect(queryBox).not.toBeNull();
    expect(queryBox!.x).toBe(labelBox!.x);
    const pageBox = await page.locator("#pageContent.stbib-quicksearch-page").boundingBox();
    const formBox = await page.locator("#ExpertSearch").boundingBox();
    const eventsBox = await page.locator(".Exemple").boundingBox();
    expect(pageBox).not.toBeNull();
    expect(formBox).not.toBeNull();
    expect(eventsBox).not.toBeNull();
    expect(Math.abs((pageBox!.x + pageBox!.width / 2) - (formBox!.x + formBox!.width / 2))).toBeLessThan(1);
    expect(eventsBox!.width).toBe(formBox!.width);
    expect(eventsBox!.x).toBe(formBox!.x);

    await page.evaluate(() => {
      const form = document.querySelector("#ExpertSearch")!;
      const replacement = form.cloneNode(true) as HTMLFormElement;
      replacement.querySelector(".stbib-quicksearch-intro")?.remove();
      replacement.querySelector('label[for="Query"]')!.textContent = "Mot recherché";
      replacement.querySelector("#Query")!.removeAttribute("autocomplete");
      form.replaceWith(replacement);
    });
    await expect(page.locator('label[for="Query"]')).toHaveText("Suchbegriff", {
      timeout: 10000,
    });
    await expect(page.locator(".stbib-quicksearch-intro")).toBeVisible();
    await expect(page.locator("#Query")).toHaveAttribute("autocomplete", "off");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(390);
    const searchBox = await page.locator("#buttonQuickSearch").boundingBox();
    const clearBox = await page.locator("#buttonQuickSearchClr").boundingBox();
    expect(searchBox).not.toBeNull();
    expect(clearBox).not.toBeNull();
    expect(searchBox!.width).toBe(clearBox!.width);

    await context.close();
  });

  test("gliedert die Vormerkseite und hält den Login mobil nutzbar", async () => {
    const context = await launch_with_extension();
    const page = await context.newPage();

    await searchFor(page, "kirby");
    await expect(page.locator("#BrowseList")).toBeVisible({ timeout: 45000 });
    const reservationHref = await page.locator('a[href*="MakeReservation"]').first().getAttribute("href");
    expect(reservationHref).toBeTruthy();
    await page.goto(new URL(reservationHref!, page.url()).href, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await expect(page.locator("#pageContent.stbib-reservation-page")).toBeVisible({
      timeout: 20000,
    });
    await expect(page.locator(".stbib-reservation-meta")).toBeVisible();
    await expect(page.locator("#BRWR")).toHaveAttribute("autocomplete", "username");
    await expect(page.locator("#PIN")).toHaveAttribute("autocomplete", "current-password");

    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await context.close();
  });
});
