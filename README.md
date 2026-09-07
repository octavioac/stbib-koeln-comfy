# Stadtbibliothek Köln – Katalog komfortabler

Ungepackte **Browser-Erweiterung (Manifest V3)** für den [Katalog der Stadtbibliothek Köln](https://katalog.stbib-koeln.de/). Sie verbessert ausschließlich die Darstellung und Interaktion im Browser. Der Katalog, das Benutzerkonto und die Daten der Bibliothek bleiben unverändert.

> Dieses private Projekt ist kein offizielles Angebot der Stadtbibliothek Köln.

## Überblick

- **Übersichtlich suchen:** kompakte Schnellsuche, größere Klickflächen und responsives Layout
- **Besser filtern:** Facetten über den Treffern, Suchfeld für lange Listen, aktive Filter als entfernbare Chips
- **Verfügbarkeit sehen:** Bestand direkt in der Trefferliste nachladen, ohne jeden Titel zu öffnen
- **ISBN finden:** ISBN-10 und ISBN-13 automatisch als Katalogabfrage behandeln
- **Weniger blättern:** weitere Treffer an die aktuelle Liste anhängen
- **Konto und Vormerkung:** klarere, mobil nutzbare Formulare mit besserer Ausrichtung und Autofill-Unterstützung
- **Optional dunkel:** dunkles Farbschema für die Komfort-Ansicht

## Warum dieses Projekt?

Die Oberfläche des Katalogs ist funktional, wirkt bei Suche, Filtern und Formularen aber unnötig technisch. Diese Erweiterung modernisiert genau diese Stellen clientseitig: ohne Zugang zu Bibliotheksdaten, ohne eigenen Server und ohne Änderung am Katalog selbst.

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

Die Facetten („Einschränken der Suche“) liegen als Kacheln in einem Raster **über** der Trefferliste:

- **Filterfeld** in jeder Facette mit mindestens 10 Werten – bei bis zu 50 Autoren oder Verlagen ist Tippen schneller als Scrollen.
- Eine geöffnete Facette erscheint als ausreichend breites Panel über dem Inhalt. Die Trefferliste springt beim Öffnen und Schließen nicht.
- Aktive Filter erscheinen neben der Suchanfrage als Chip mit einer klar beschrifteten `×`-Schaltfläche zum Entfernen.

### Komfort-Design & Layout

Unabhängig von den Funktionen oben modernisiert die Komfort-Ansicht die Darstellung:

- größere Schrift, klarere Trefferkarten und besser erreichbare Klickflächen
- kompakte Trefferbreite: Medienbild, Titel und Aktionen bleiben auch auf großen Bildschirmen gut zusammen lesbar
- responsive Schnellsuche mit sichtbarem Label und eindeutiger Primäraktion
- überarbeitete Seiten für **Mein Konto** und **Vormerken**: klare Eingabefelder, verständliche Hinweise und mobil nutzbare Aktionen
- optionales dunkles Farbschema – greift nur bei aktivierter Komfort-Ansicht

Bei ausgeschalteter Komfort-Ansicht werden alle injizierten Styles und Ergänzungen entfernt. Der Katalog steht wieder im Original da.

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

## Installation

### Chrome, Chromium, Edge und Brave

Benötigt wird Chrome bzw. Chromium ab **105** (die Styles nutzen `:has()`).

1. Die Erweiterungsseite öffnen, etwa `chrome://extensions`.
2. **Entwicklermodus** aktivieren.
3. **Entpackte Erweiterung laden** wählen.
4. Den Projektordner mit `manifest.json` auswählen.

Optional: Release-ZIP entpacken und denselben Ordner wählen.

### Firefox

Firefox ab **121** unterstützt die verwendeten Selektoren. Die Erweiterung lässt sich für lokale Tests temporär über `about:debugging` laden. Für eine dauerhafte Installation benötigt Firefox eine signierte Erweiterung.

## ZIP für die Weitergabe

```bash
npm run pack
```

Erzeugt eine ZIP-Datei mit `manifest.json`, `content.js`, `src/`, `popup/`, `styles/`, `icons/`, `README.md`.

## Automatisierte Tests

Voraussetzungen: Node.js, npm und Playwright Chromium.

```bash
npm install
npx playwright install chromium
npm test
```

Zusätzlich gibt es Offline-Prüfungen, die ohne den Katalog laufen:

```bash
npm run test:unit   # Vitest: ISBN-Logik, Bestands-Parser, Reverter, Manifest-/Storage-Verträge
npm run test:lint   # ESLint + Stylelint
npm run lint:webext # web-ext: Manifest- und Paketprüfung
```

Die Tests laufen gegen den echten Katalog:

- **`tests/selectors.spec.ts`** prüft den Serververtrag ohne Browser: Selektoren, Parameter und HTML-Strukturen, von denen die Erweiterung abhängt.
- **`tests/features.spec.ts`** prüft Bestand, Nachladen, ISBN, Facetten, Konto, Schnellsuche und Vormerkung mit geladener Erweiterung.
- **`tests/smoke.spec.ts`** deckt Schnellsuche, Trefferliste und den Einstieg unter `/Zones2/` ab.

Die Unit-Tests in **`tests/unit/`** (Vitest) laufen dagegen offline: Die reine Logik (ISBN-Prüfsummen, Bestands-Parsing) lebt in `src/logic.js` und wird gegen Fixtures geprüft; Verträge zwischen `content.js`, Manifest und Popup sind als Paritätstests gesichert.

Die Tests starten Chromium mit sichtbarem Fenster, weil Erweiterungen im Headless-Modus nicht zuverlässig unterstützt werden. Der externe Katalog antwortet bei vielen schnellen Aufrufen gelegentlich mit `503`; deshalb ist ein Wiederholungsversuch konfiguriert und zwischen Feature-Tests liegt eine kurze Pause.

## Manuelle Testmatrix (Release-Check)

Für jede Zeile: Seite laden, **ohne** Überlappungen und mit bedienbaren Links/Buttons; bei Bedarf DevTools-Konsole auf Fehler prüfen.

| # | Szenario |
|---|----------|
| 1 | **Zones2** (`/Zones2/`): Katalog im iframe, Navigation, Schnellsuche sichtbar |
| 2 | **Direkt** `…/alswww2.dll/APS_ZONES?fn=QuickSearch&Style=Portal3` |
| 3 | **Suchergebnisseite**: Suchbegriff mit vielen Treffern; Zeile „Ergebnisse (n)“; **Sortierung** ändern; **Pagination** (nächste Seite); mindestens eine Facette öffnen und schließen, ohne dass die Trefferliste springt |
| 4 | **Bestand**: einzelne Zeile aufklappen; **„Bestand für alle Treffer laden“**; ein Titel ohne physischen Bestand (E-Medium) zeigt „Kein Bestand“ |
| 5 | **Mehr laden**: zweimal nachladen, Zähler stimmt, Blätter-Links des Portals funktionieren weiterhin |
| 6 | **ISBN**: ISBN mit und ohne Bindestriche im Suchfeld; Nulltrefferseite direkt aufrufen → Hinweis erscheint |
| 7 | **Facetten**: „Autor“ öffnen, filtern, leeren; einen Filter setzen und über das `×` wieder entfernen |
| 8 | **Popup**: Design aus, Seite neu laden → Originaldarstellung; wieder an → modernisiert; Funktionsschalter einzeln prüfen |
| 9 | **Desktop** ca. 1280px und **schmal** ca. 390px: keine horizontale Scrollleiste, bedienbare Aktionen |
| 10 | **Mein Konto**: Felder, PIN-Hinweise, „Geheimnummer vergessen?“ und beide Aktionen prüfen |
| 11 | **Vormerken**: Medienangaben, Abholbibliothek, Hinweis zum Entgelt und Bestätigen/Abbrechen prüfen |
| 12 | **Mobile vs. klassisch**: Footer-Link zur mobilen Ansicht bzw. zurück – Layout brauchbar |
| 13 | Optional: **Drucken der Liste** – Inhalt sichtbar, geladener Bestand wird mitgedruckt |

## Projektstruktur

- `manifest.json` – MV3, Content-Scripts mit `all_frames: true`; Styles per `web_accessible_resources` nur bei „an“
- `content.js` – Bootstrap: Styles einhängen, Theme setzen, Module anwenden, DOM beobachten
- `src/logic.js` – reine Logik ohne DOM: ISBN-Erkennung und Bestands-Parsing (auch für Node-Tests)
- `src/util.js` – gemeinsame Helfer: DOM-Knoten, Viewport, Reverter für reversible Eingriffe, `fetch` mit `DOMParser` und Parallelitätsbegrenzung
- `src/facets.js` – Kachel- und Panel-Layout für Facetten, Suchfelder und entfernbare Filter-Chips
- `src/holdings.js`, `src/loadmore.js`, `src/query.js` – Bestand, weitere Treffer und ISBN-Erkennung
- `src/account.js` – Konto-Login mit reversiblen semantischen Ergänzungen
- `src/pages.js` – Schnellsuche und Vormerkung mit reversiblen Seitenmarkern
- `popup/` – Schalter im Toolbar-Popup
- `styles/tokens.css` – Design-Tokens; alle Farben der Komfort-Ansicht, dunkles Schema überschreibt nur Tokens (`theme-dark.css`)
- `styles/base.css` … `components.css`, `results.css`, `pages.css`, `features.css`, `print.css` – aufeinander aufbauende Overrides; `pages.css` für Konto/Quicksearch/Vormerkung
- `icons/` – Platzhalter-Icons (optional austauschen)
- `tests/` – Playwright-Tests gegen den Live-Katalog (`*.spec.ts`) und Vitest-Unit-Tests offline (`unit/`)

### Wie die Module zusammenspielen

`content.js` liest die Einstellungen und ruft je Modul `mount(settings)` oder `unmount()` auf. Die Module sind idempotent: Ein zweiter `mount()` fügt nichts doppelt ein. `unmount()` stellt den ursprünglichen DOM wieder her; eigene Knoten tragen `data-stbib-own`.

Ein **MutationObserver** hält das synchron, denn Teile der Seite kommen erst nach `document_idle`: jQuery sortiert Facettenlisten um, Dialoge werden nachgeladen, und „Mehr laden“ hängt neue Trefferzeilen an, die ebenfalls Bestands-Schaltflächen brauchen. Eigene Einfügungen erkennt der Observer an `data-stbib-own` und ignoriert sie, damit er sich nicht selbst triggert.

## Drittanbieter

Der Katalog selbst wird von der **Stadtbibliothek Köln** betrieben (Software: MondoIn Zones). Diese Erweiterung ist **kein** offizielles Angebot der Bibliothek. Sie sendet keine Daten an Dritte; alle Abfragen gehen ausschließlich an `katalog.stbib-koeln.de` – dieselbe Adresse, die der Browser beim normalen Blättern im Katalog aufruft.
