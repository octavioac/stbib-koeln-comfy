import { test, expect } from "@playwright/test";
import { launch_with_extension } from "./extension-fixture";

const CATALOG_ORIGIN = "https://katalog.stbib-koeln.de";
const QUICKSEARCH_PATH =
  "/alswww2.dll/APS_ZONES?fn=QuickSearch&Style=Portal3";

test.describe("Katalog mit Erweiterung", () => {
  test("Schnellsuche lädt und Suchergebnisse sind erreichbar", async () => {
    const context = await launch_with_extension();
    const page = await context.newPage();

    /*
     * Seitenfehler sammeln und gezielt auswerten: Das Portal selbst wirft
     * gelegentlich Fehler (z. B. „$(...).dialog is not a function“) – die
     * gehen uns nichts an. Failern sollen nur Fehler aus Erweiterungsdateien.
     */
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));
    const isExtensionError = (err: Error): boolean =>
      new RegExp(
        "stbib|content\\.js|src/(logic|util|facets|holdings|loadmore|query|account|pages)\\.js"
      ).test(err.stack ?? err.message);

    await page.goto(`${CATALOG_ORIGIN}${QUICKSEARCH_PATH}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await expect(page.getByRole("heading", { name: "Schnellsuche" })).toBeVisible({
      timeout: 20000,
    });

    await page.locator('input[name="q.Query"]').fill("star wars");
    await page.locator("#buttonQuickSearch").click();

    await expect(page.locator(".searchHits")).toContainText(/Ergebnisse\s*\(/, {
      timeout: 45000,
    });
    await expect(page.locator("#BrowseList")).toBeVisible();
    await expect(page.locator("#SortCriteria").first()).toBeVisible();

    expect(
      pageErrors.filter(isExtensionError),
      "keine Erweiterungsfehler auf der Seite"
    ).toEqual([]);
    await context.close();
  });

  test("Zones2-Einstieg lädt den Katalog (iframe)", async () => {
    const context = await launch_with_extension();
    const page = await context.newPage();

    await page.goto(`${CATALOG_ORIGIN}/Zones2/`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await expect
      .poll(() => page.frames().some((f) => f.url().includes("APS_ZONES")), {
        timeout: 30000,
        message: "IFrame mit APS_ZONES sollte geladen sein",
      })
      .toBe(true);
    const catalogFrame = page.frames().find((f) => f.url().includes("APS_ZONES"))!;
    await expect(
      catalogFrame.locator("h1.titleText1, h1").filter({ hasText: "Schnellsuche" })
    ).toBeVisible({
      timeout: 30000,
    });

    await context.close();
  });
});
