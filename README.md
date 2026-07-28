# Stadtbibliothek Köln – Katalog komfortabler

Ungepackte **Chrome-Erweiterung (Manifest V3)** für [https://katalog.stbib-koeln.de/](https://katalog.stbib-koeln.de/). Version **1.3.0** ergänzt den Katalog um echte Komfort-Funktionen – der Katalog selbst bleibt unverändert, alles läuft clientseitig im Browser.

**Kurzüberblick:**

- **Verfügbarkeit direkt in der Trefferliste** – ohne jeden Titel einzeln zu öffnen: „1 von 3 verfügbar“, „Alle entliehen bis …“ oder „Kein Bestand“ als Badge in der Zeile
- **ISBN-Suche** – ISBN mit oder ohne Bindestriche wird automatisch als `isbn=…` gesucht
- **„Mehr laden“** – weitere Treffer anhängen statt dutzende Seiten zu blättern
- **Facetten-Filter** – lange Autoren-/Verlagslisten durchsuchen, geöffnete Facette breiter
- **Komfort-Design** – größere Schrift, mehr Abstand, klarere Trefferkarten, optional dunkles Farbschema (Beta)

## Warum dieses Projekt?

Ich nutze die **Stadtbibliothek Köln** gern und leihe dort regelmäßig aus – Angebot und Service sind für mich überzeugend. Die **Weboberfläche der Suche** wirkt daneben aber ziemlich **veraltet**: kleine Klickflächen, unruhiges Layout, wenig Raum für klare Typografie. Statt das nur hinzunehmen, wollte ich die Nutzung **auf einfache Weise** modernisieren: rein **clientseitig** mit einer **Browser-Erweiterung**, ohne den Katalog der Bibliothek zu verändern. Dieses Plugin habe ich mir **selbst gebaut** und stelle den Code sowie die Erweiterung **allen zur Verfügung**, die die **Experience** beim Stöbern und Suchen etwas angenehmer haben möchten. Es handelt sich weiterhin um ein **privates Projekt**, **kein** offizielles Produkt der Stadtbibliothek.

## Komfort-Funktionen

### Bestand in der Trefferliste

Die Trefferliste des Portals zeigt nur Titel, Verfasser, Signatur, Jahr, Auflage, Sprache und Verlag – **nicht**, ob und wo ein Titel ausleihbar ist. Bisher musste man jeden Treffer einzeln öffnen, den Bestand prüfen und wieder zurücknavigieren.

Jede Trefferzeile bekommt darum eine Schaltfläche **„Bestand anzeigen“** (oder **„Bestand für alle Treffer laden“** über der Liste). Nach dem Laden – auch ohne Aufklappen – erscheint direkt in der Zeile ein **Status-Badge**:

| Badge | Bedeutung |
|---|---|
| **„1 von 3 verfügbar“** (grün) | Mindestens ein Exemplar ausleihbar |
| **„Alle 5 Exemplare entliehen“** + frühestes Rückgabedatum (orange) | Derzeit nichts frei |
| **„Kein Bestand“** | z. B. reines E-Medium ohne physische Exemplare |

Ein zweiter Klick auf **„Bestand je Zweigstelle“** klappt die Details auf: je Zweigstelle Signatur und Status der einzelnen Exemplare. Zweigstellen mit verfügbaren Exemplaren stehen oben.

Mit **„Bestand automatisch laden“** im Popup lädt die Erweiterung alle Treffer der Seite sofort im Hintergrund – praktisch am Schreibtisch, im Mobilfunknetz eher aus (jeder Bestand ist eine zusätzliche Abfrage an den Katalog).

Technisch: Der **Permalink** eines Titels (`APS_ZONES?fn=ViewNotice&q=<ID>`) liefert den Bestand aller Zweigstellen bereits im HTML – ohne Session, gleiche Origin. `src/holdings.js` holt ihn per `fetch` (höchstens 4 parallel) und liest die Blöcke `stock_header_<code>` / `stock_content_<code>` aus.

### ISBN-Suche

Eine blank eingegebene ISBN findet im Katalog **nichts** – weder `9783551557414` noch `978-3-551-55741-4`. Erst der Index-Präfix `isbn=` (klein geschrieben; `ISBN=` wird als Wort behandelt) führt zum Titel.

`src/query.js` erkennt ISBN-10 und ISBN-13 inklusive Prüfsumme und schreibt die Eingabe vor dem Absenden um – in **beide** Schreibweisen, damit auch Titel gefunden werden, die nur mit der jeweils anderen ISBN erfasst sind:

```
978-3-551-55741-4   →   isbn=9783551557414 or isbn=3551557411
```

Bereits qualifizierte Anfragen (`au=`, `ti=`, `isbn=` …) bleiben unangetastet, ebenso Zahlen, die keine gültige ISBN sind. Landet man trotzdem auf einer Nulltrefferseite – etwa über ein Lesezeichen oder die erweiterte Suche – erscheint dort ein Hinweis mit dem Link **„Als ISBN suchen“**.

### „Mehr laden“ statt Blättern

Das Portal liefert fest **10 Treffer pro Seite**; ein `PageSize` in der URL wird ignoriert. 2026 Treffer bedeuten 203 Seitenaufrufe.

Unter der Trefferliste steht darum **„Weitere 10 Treffer laden“** samt Zähler („Treffer 1–20 von 2026“). `src/loadmore.js` ruft `Method=PageDown` gegen das Session-Handle der laufenden Suche auf und hängt die Zeilen an die Liste an. Weil dieser Aufruf den serverseitigen Cursor vorrückt, wird die Seitenanzeige des Portals mitgeschrieben – dessen eigene Blätter-Links bleiben damit stimmig und benutzbar.

### Facetten

Die Facetten („Einschränken der Suche“) liegen als Kacheln in einem Raster **über** der Trefferliste. Neu:

- **Filterfeld** in jeder Facette mit mindestens 10 Werten – bei bis zu 50 Autoren oder Verlagen ist Tippen schneller als Scrollen.
- Die **geöffnete** Facette belegt mehrere Rasterspalten, damit lange Werte („A. F. Steadman ; aus dem Englischen von …“) nicht in einer Fünftel-Spalte umbrechen.

### Komfort-Design & Layout

Unabhängig von den Funktionen oben modernisiert das Komfort-Design die Darstellung:

- größere Schrift, mehr Abstand, klarere Trefferkarten und bessere Klickflächen
- Facetten **über** der Trefferliste in **voller Breite**, einzelne Facetten als **Kacheln** in einem Raster (ca. 5 Spalten auf großen Screens, weniger auf schmalen Viewports); technisch wrappt `src/facets.js` jedes Akkordeon (`.FacetHeader` + `.FacetsList`) in `.stbib-facet-tile`
- optional **dunkles Farbschema** (Beta) – greift nur bei aktivem Komfort-Design

Bei **ausgeschaltetem** Komfort-Design werden alle injizierten Styles und Funktionen entfernt; der Katalog steht wieder im Original da.

## Ein- und Ausschalten

Nach der Installation erscheint das Erweiterungs-**Symbol** in der Werkzeugleiste. Per Klick öffnet sich ein **Popup**:

| Schalter | Vorgabe | Wirkung |
|---|---|---|
| **Komfort-Design aktivieren** | an | Hauptschalter. Aus = alle injizierten Styles und Funktionen werden entfernt, der Katalog steht wieder im Original da. |
| **Dunkles Design** | aus | Dunkles Farbschema (**Beta**). Greift nur bei aktivem Komfort-Design. |
| **Bestand in der Trefferliste** | an | Schaltflächen und Bestandsanzeige je Treffer. |
| **Bestand automatisch laden** | aus | Lädt den Bestand aller Treffer sofort, ohne Klick. |
| **„Mehr laden“ statt Blättern** | an | Leiste unter der Trefferliste. |
| **ISBN-Suche erkennen** | an | Umschreibung der Eingabe und Hinweis auf Nulltrefferseiten. |

Die Einstellungen liegen in `chrome.storage.local`. Änderungen greifen sofort auf offenen Katalogseiten; sollte etwas nicht stimmen, die Seite **hart neu laden** (**⌘+Shift+R** / **Strg+Shift+R**).

**Typografie und Farben** weiterhin zentral in `styles/tokens.css` anpassbar.

## Installation in Google Chrome

1. Adresse `chrome://extensions` öffnen.
2. **Entwicklermodus** aktivieren.
3. **Entpackte Erweiterung laden** wählen.
4. Den geklonten Projektordner auswählen (Root mit `manifest.json`).

Optional: Release-ZIP entpacken und denselben Ordner wählen.

Firefox ab **121** (`browser_specific_settings.gecko`): Das Facetten-Layout nutzt den CSS-Selektor `:has()`, der erst dort verfügbar ist.

## ZIP für die Weitergabe

```bash
npm run pack
```

Erzeugt eine ZIP-Datei mit `manifest.json`, `content.js`, `src/`, `popup/`, `styles/`, `icons/`, `README.md`.

## Automatisierte Tests

Voraussetzungen: `npm install`, `npx playwright install chromium`.

```bash
npm test
```

Drei Ebenen:

- **`tests/selectors.spec.ts`** – Selektor-Gesundheitscheck ohne Browser (reine HTTP-Abfragen, wenige Sekunden). Prüft, dass die Klassen, IDs und URL-Parameter noch existieren, auf denen die Erweiterung aufbaut, und dass die blanke ISBN-Suche tatsächlich noch ins Leere läuft. Ändert die Stadtbibliothek ihre Templates, scheitern diese Tests laut – statt dass Nutzern still eine Funktion fehlt.
- **`tests/features.spec.ts`** – Bestand, „Mehr laden“, ISBN-Erkennung und Facettenfilter im echten Browser mit geladener Erweiterung.
- **`tests/smoke.spec.ts`** – Schnellsuche, Suchergebnisseite und Einstieg unter `/Zones2/`.

Die Tests starten **Chromium mit sichtbarem Fenster** (Headless unterstützt Erweiterungen nicht zuverlässig) und laufen gegen den **echten Katalog**. Bei vielen Aufrufen kurz hintereinander antwortet das Portal gelegentlich mit `503`; darum ist ein Wiederholungsversuch konfiguriert und zwischen den Feature-Tests liegt eine kurze Pause.

## Manuelle Testmatrix (Release-Check)

Für jede Zeile: Seite laden, **ohne** Überlappungen und mit bedienbaren Links/Buttons; bei Bedarf DevTools-Konsole auf Fehler prüfen.

| # | Szenario |
|---|----------|
| 1 | **Zones2** (`/Zones2/`): Katalog im iframe, Navigation, Schnellsuche sichtbar |
| 2 | **Direkt** `…/alswww2.dll/APS_ZONES?fn=QuickSearch&Style=Portal3` |
| 3 | **Suchergebnisseite**: Suchbegriff mit vielen Treffern; Zeile „Ergebnisse (n)“; **Sortierung** ändern; **Pagination** (nächste Seite); mindestens ein **Facetten-Link**; **Details/Bestand** öffnen |
| 4 | **Bestand**: einzelne Zeile aufklappen; **„Bestand für alle Treffer laden“**; ein Titel ohne physischen Bestand (E-Medium) zeigt „Kein Bestand“ |
| 5 | **Mehr laden**: zweimal nachladen, Zähler stimmt, Blätter-Links des Portals funktionieren weiterhin |
| 6 | **ISBN**: ISBN mit und ohne Bindestriche im Suchfeld; Nulltrefferseite direkt aufrufen → Hinweis erscheint |
| 7 | **Facetten**: „Autor“ öffnen, filtern, leeren |
| 8 | **Popup**: Design aus, Seite neu laden → Originaldarstellung; wieder an → modernisiert; Funktionsschalter einzeln prüfen |
| 9 | **Desktop** ca. 1280px und **schmal** ca. 390px (Device-Toolbar) |
| 10 | **Mobile vs. klassisch**: Footer-Link zur mobilen Ansicht bzw. zurück – Layout brauchbar |
| 11 | Optional: **Drucken der Liste** – Inhalt sichtbar, geladener Bestand wird mitgedruckt |

## Projektstruktur

- `manifest.json` – MV3, Content-Scripts mit `all_frames: true`; Styles per `web_accessible_resources` nur bei „an“
- `content.js` – Bootstrap: Styles einhängen, Theme setzen, Module anwenden, DOM beobachten
- `src/util.js` – gemeinsame Helfer (Namensraum `globalThis.stbib`, `fetch` + `DOMParser`, Parallelitätsbegrenzung)
- `src/facets.js`, `src/holdings.js`, `src/loadmore.js`, `src/query.js` – die vier Funktionsmodule, jedes mit `mount()` / `unmount()`
- `popup/` – Schalter im Toolbar-Popup
- `styles/tokens.css` … `print.css` – aufeinander aufbauende Overrides; `styles/features.css` für die ergänzten Bausteine; `styles/theme-dark.css` für `data-stbib-theme="dark"` (wird zuletzt geladen)
- `icons/` – Platzhalter-Icons (optional austauschen)
- `tests/` – Playwright-Tests (siehe oben)

### Wie die Module zusammenspielen

`content.js` liest die Einstellungen und ruft je Modul `mount(settings)` oder `unmount()` auf. Beide sind **idempotent**: Ein zweiter `mount()`-Aufruf fügt nichts doppelt ein, `unmount()` stellt den ursprünglichen DOM wieder her (Facetten werden ausgepackt, eingefügte Knoten sind über `data-stbib-own` markiert und werden entfernt).

Ein **MutationObserver** hält das synchron, denn Teile der Seite kommen erst nach `document_idle`: jQuery sortiert Facettenlisten um, Dialoge werden nachgeladen, und „Mehr laden“ hängt neue Trefferzeilen an, die ebenfalls Bestands-Schaltflächen brauchen. Eigene Einfügungen erkennt der Observer an `data-stbib-own` und ignoriert sie, damit er sich nicht selbst triggert.

## Drittanbieter

Der Katalog selbst wird von der **Stadtbibliothek Köln** betrieben (Software: MondoIn Zones). Diese Erweiterung ist **kein** offizielles Angebot der Bibliothek. Sie sendet keine Daten an Dritte; alle Abfragen gehen ausschließlich an `katalog.stbib-koeln.de` – dieselbe Adresse, die der Browser beim normalen Blättern im Katalog aufruft.
