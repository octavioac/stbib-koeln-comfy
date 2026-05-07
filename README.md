# Stadtbibliothek Köln – Katalog komfortabler

Ungepackte **Chrome-Erweiterung (Manifest V3)** für [https://katalog.stbib-koeln.de/](https://katalog.stbib-koeln.de/): größere Schrift, mehr Abstand, klarere Trefferkarten und bessere Klickflächen. Der Katalog bleibt funktional unverändert.

## Warum dieses Projekt?

Ich nutze die **Stadtbibliothek Köln** gern und leihe dort regelmäßig aus – Angebot und Service sind für mich überzeugend. Die **Weboberfläche der Suche** wirkt daneben aber ziemlich **veraltet**: kleine Klickflächen, unruhiges Layout, wenig Raum für klare Typografie. Statt das nur hinzunehmen, wollte ich die Nutzung **auf einfache Weise** modernisieren: rein **clientseitig** mit einer **Browser-Erweiterung**, ohne den Katalog der Bibliothek zu verändern. Dieses Plugin habe ich mir **selbst gebaut** und stelle den Code sowie die Erweiterung **allen zur Verfügung**, die die **Experience** beim Stöbern und Suchen etwas angenehmer haben möchten. Es handelt sich weiterhin um ein **privates Projekt**, **kein** offizielles Produkt der Stadtbibliothek.

## Ein- und Ausschalten

Nach der Installation erscheint das Erweiterungs-**Symbol** in der Werkzeugleiste. Per Klick öffnet sich ein **Popup** mit den Schaltern **„Komfort-Design aktivieren“** und **„Dunkles Design“**.

- **Suchergebnisse:** Filter **„Einschränken der Suche“** erscheinen **über** der Trefferliste in **voller Breite**; einzelne Facetten liegen als **Kacheln** in einem **Raster** (ca. 5 Spalten auf großen Screens, weniger auf schmalen Viewports). Technisch wrappt `content.js` jedes Akkordeon (`.FacetHeader` + `.FacetsList`) in `.stbib-facet-tile` – bei **ausgeschaltetem** Komfort-Design wird das wieder rückgängig gemacht.
- **Komfort-Design aus:** alle injizierten Styles werden entfernt.
- **Dunkles Design:** greift nur, wenn das Komfort-Design aktiv ist – der Katalog erhält ein dunkles Farbschema (Hintergründe, Karten, Facetten, Eingaben, rote Akzentleisten angepasst). Das Popup spiegelt den Zustand mit dunklem Hintergrund wider.

Die Einstellungen liegen in `chrome.storage.local` (`stbibModernEnabled`, `stbibDarkMode`). Nach dem Umschalten die Katalog-Seite **hart neu laden** (**⌘+Shift+R** / **Strg+Shift+R**), falls der Zustand nicht sofort stimmt.

**Typografie** weiterhin zentral in `styles/tokens.css` anpassbar.

## Installation in Google Chrome

1. Adresse `chrome://extensions` öffnen.
2. **Entwicklermodus** aktivieren.
3. **Entpackte Erweiterung laden** wählen.
4. Den geklonten Projektordner auswählen (Root mit `manifest.json`).

Optional: Release-ZIP entpacken und denselben Ordner wählen.

## ZIP für die Weitergabe

```bash
npm run pack
```

Erzeugt eine ZIP-Datei mit `manifest.json`, `content.js`, `popup/`, `styles/`, `icons/`, `README.md`.

## Automatisierte Tests

Voraussetzungen: `npm install`, `npx playwright install chromium`.

```bash
npm test
```

Die Tests starten **Chromium mit sichtbarem Fenster** (Headless unterstützt Erweiterungen nicht zuverlässig). Es werden die Schnellsuche inkl. **Suchergebnisseite** und der Einstieg unter `/Zones2/` geprüft.

## Manuelle Testmatrix (Release-Check)

Für jede Zeile: Seite laden, **ohne** Überlappungen und mit bedienbaren Links/Buttons; bei Bedarf DevTools-Konsole auf Fehler prüfen.

| # | Szenario |
|---|----------|
| 1 | **Zones2** (`/Zones2/`): Katalog im iframe, Navigation, Schnellsuche sichtbar |
| 2 | **Direkt** `…/alswww2.dll/APS_ZONES?fn=QuickSearch&Style=Portal3` |
| 3 | **Suchergebnisseite**: Suchbegriff mit vielen Treffern; Zeile „Ergebnisse (n)“; **Sortierung** ändern; **Pagination** (nächste Seite); mindestens ein **Facetten-Link**; **Details/Bestand** öffnen |
| 4 | **Popup**: Design aus, Seite neu laden → Originaldarstellung; wieder an → modernisiert |
| 5 | **Desktop** ca. 1280px und **schmal** ca. 390px (Device-Toolbar) |
| 6 | **Mobile vs. klassisch**: Footer-Link zur mobilen Ansicht bzw. zurück – Layout brauchbar |
| 7 | Optional: **Drucken der Liste** – Inhalt sichtbar, nicht leer |

## Projektstruktur

- `manifest.json` – MV3, `content.js` mit `all_frames: true`; Styles per `web_accessible_resources` nur bei „an“
- `popup/` – Schalter im Toolbar-Popup
- `styles/tokens.css` … `print.css` – aufeinander aufbauende Overrides; `styles/theme-dark.css` für `data-stbib-theme="dark"` (wird zuletzt geladen)
- `icons/` – Platzhalter-Icons (optional austauschen)
- `tests/` – Playwright-Smoke-Tests

## Drittanbieter

Der Katalog selbst wird von der **Stadtbibliothek Köln** betrieben. Diese Erweiterung ist **kein** offizielles Angebot der Bibliothek.
