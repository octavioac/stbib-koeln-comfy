# Texte für den Chrome Web Store

Alle Texte zum Kopieren für das Developer Dashboard. Zielgruppe: Nutzerinnen und Nutzer
der Stadtbibliothek Köln, die sich mit der Bibliothek auskennen, aber nicht technisch sind.

Platzhalter in eckigen Klammern (z. B. `[deine E-Mail-Adresse]`) bitte vor dem Einreichen
ausfüllen – die habe ich bewusst nicht erfunden.

---

## 1. Name der Erweiterung

Bereits in `manifest.json` gesetzt (Store übernimmt ihn automatisch):

```
Stbib Köln Komfort-Ansicht (inoffiziell)
```

Chrome/Firefox erlauben im `name`-Feld maximal **45 Zeichen** – das hat die ursprünglich
längere Fassung („Komfort-Ansicht für die Stadtbibliothek Köln (inoffiziell)“, 58
Zeichen) überschritten und wurde deshalb gekürzt.

**Alternativen** (alle ≤ 45 Zeichen), falls dir eine Variante besser gefällt – einfach
im Feld „Name“ im Dashboard eintragen, das überschreibt den manifest-Namen nur für den
Store-Eintrag, nicht die Erweiterung selbst:

- `Komfort-Katalog Stbib Köln (inoffiziell)` (40 Zeichen)
- `Stbib Köln – Komfort-Katalog (inoffiziell)` (42 Zeichen)

Alle Varianten sagen unmissverständlich: für die Kölner Stadtbibliothek gemacht, aber
kein offizielles Angebot der Bibliothek.

---

## 2. Kurzbeschreibung (auch: manifest-Description, max. 132 Zeichen)

Bereits in `manifest.json` gesetzt (130 Zeichen):

```
Macht den Online-Katalog der Stadtbibliothek Köln übersichtlicher: Bestand sichtbar, ISBN-Suche, mehr Treffer laden. Inoffiziell.
```

Diese Fassung nennt zuerst den **Gesamtnutzen** („macht übersichtlicher“) und erst danach
Beispiele – nicht nur das zuletzt gebaute Feature.

---

## 3. Ausführliche Beschreibung (Store-Listing, Feld „Detaillierte Beschreibung“)

Direkt so ins Dashboard einfügen (reiner Text, keine Formatierung nötig):

```
Ich leihe selbst regelmäßig bei der Stadtbibliothek Köln aus – Angebot und Service
überzeugen mich total. Der Online-Katalog dagegen hat mich immer wieder genervt:
winzige Schrift, unübersichtliches Layout, und um herauszufinden, ob ein Buch gerade
verfügbar ist, musste ich jeden Treffer einzeln öffnen und wieder zurück. Irgendwann
hatte ich genug und habe mir diese Erweiterung selbst gebaut – zuerst nur für mich,
jetzt gebe ich sie an alle weiter, denen es ähnlich geht.

Wichtig zu wissen: Das ist mein eigenes, privates Projekt und KEIN offizielles Angebot
der Stadtbibliothek Köln. Ich verändere nichts am Katalog der Bibliothek selbst – die
Erweiterung sorgt nur dafür, dass die Website in deinem eigenen Browser übersichtlicher
aussieht und sich einfacher bedienen lässt.

WAS SIE KANN

✓ Verfügbarkeit auf einen Blick
Bei jedem Treffer in der Trefferliste siehst du sofort, ob ein Titel gerade ausleihbar
ist und in welcher Zweigstelle – ohne dass du jeden Titel einzeln öffnen musst. Ist
alles entliehen, siehst du gleich, ab wann es voraussichtlich wieder verfügbar ist.

✓ ISBN einfach eingeben
Eine ISBN direkt einzutippen findet im normalen Katalog oft gar nichts. Diese
Erweiterung erkennt eine ISBN automatisch und sucht richtig danach – mit oder ohne
Bindestriche.

✓ Mehr Treffer laden statt endlos blättern
Statt dich durch dutzende Seiten zu klicken, lädst du mit einem Klick weitere Treffer
direkt dazu.

✓ Lange Listen durchsuchen
Filter wie „Autor“ oder „Verlag“ liefern oft viele Werte. Ein Suchfeld direkt in der
Liste macht das Durchsuchen einfacher als endloses Scrollen.

✓ Angenehmeres Erscheinungsbild
Größere Schrift, mehr Abstand, klar abgegrenzte Trefferkarten und größere, leichter zu
treffende Buttons. Optional gibt es ein dunkles Farbschema (Beta).

ALLES EINZELN EIN- UND AUSSCHALTBAR

Über das Symbol der Erweiterung in der Werkzeugleiste öffnet sich ein kleines Menü,
in dem sich jede einzelne Funktion an- oder abschalten lässt. Soll der Katalog wieder
ganz im Original aussehen, reicht ein Klick auf den Hauptschalter.

DEINE DATEN BLEIBEN BEI DIR

Diese Erweiterung sammelt keine Daten, hat keinen eigenen Server und sendet nichts an
Dritte. Die einzige gespeicherte Information sind deine eigenen Anzeige-Einstellungen –
und die bleiben ausschließlich lokal in deinem Browser. Jede Anfrage, die die
Erweiterung stellt (etwa um den Bestand oder weitere Treffer zu laden), geht
ausschließlich an katalog.stbib-koeln.de – also genau dorthin, wo du dich beim
Katalogisieren ohnehin schon befindest.

WICHTIGER HINWEIS

Wie gesagt: ein privates, unabhängiges Projekt ohne Verbindung zur Stadtbibliothek
Köln. Weil ich den Katalog selbst jede Woche benutze, halte ich die Erweiterung auch
aktuell. Ändert sich am Katalog etwas und irgendwas funktioniert nicht mehr richtig,
freue ich mich über eine Rückmeldung: [deine Kontaktmöglichkeit, z. B. E-Mail oder
GitHub-Issues-Link]
```

---

## 4. „Single purpose“-Beschreibung (Pflichtfeld im Dashboard, kurzer Zweck-Satz)

```
Verbessert Darstellung und Bedienbarkeit des öffentlich zugänglichen Online-Katalogs
der Stadtbibliothek Köln (katalog.stbib-koeln.de): größere Schrift, klareres Layout,
Anzeige der Verfügbarkeit direkt in der Trefferliste, funktionierende ISBN-Suche und
Nachladen weiterer Treffer. Arbeitet rein clientseitig im Browser, ohne den Katalog
selbst zu verändern.
```

---

## 5. Begründung der Berechtigungen (Permission Justification)

Das Dashboard fragt bei der Einreichung nach jeder einzelnen Berechtigung, wofür sie
gebraucht wird.

**`storage`:**
```
Speichert ausschließlich die vom Nutzer gewählten Anzeige-Einstellungen (z. B. ob das
Komfort-Design oder das dunkle Design aktiv ist) lokal im Browser. Es werden keine
Daten an einen Server der Erweiterung übertragen – ein solcher Server existiert nicht.
```

**Host-Zugriff auf `katalog.stbib-koeln.de`:**
```
Die Erweiterung wird ausschließlich auf der Website des Online-Katalogs der
Stadtbibliothek Köln (katalog.stbib-koeln.de) aktiv, um dort Darstellung und
Bedienbarkeit zu verbessern. Auf keiner anderen Website wird sie ausgeführt.
```

---

## 6. Datenschutz-Angaben (Tab „Privacy practices“ im Dashboard)

**Frage: „Sammelt diese Erweiterung Nutzerdaten?“**
→ **Nein.**

**Erläuternder Text, falls ein Freitextfeld verlangt wird:**
```
Diese Erweiterung erhebt, speichert und überträgt keine personenbezogenen Daten. Es
gibt keinen eigenen Server. Die einzige gespeicherte Information sind die vom Nutzer
selbst gewählten Anzeige-Einstellungen, gespeichert lokal im Browser über die
Speicherfunktion von Chrome (chrome.storage.local). Alle Netzwerkanfragen der
Erweiterung gehen ausschließlich an katalog.stbib-koeln.de – dieselbe Adresse, die der
Browser ohnehin beim normalen Bedienen des Katalogs aufruft.
```

Falls das Dashboard zusätzlich eine **gehostete Datenschutzerklärung (URL)** verlangt:
Den obigen Text z. B. als `PRIVACY.md` ins GitHub-Repository legen und den Link zur
GitHub-Seite der Datei im entsprechenden Feld eintragen.

---

## 7. Kategorie & Sprache

- **Kategorie:** Produktivität
- **Sprache:** Deutsch
- **Land/Region (falls abgefragt):** Deutschland

---

## 8. Kontakt / Support (Pflichtfeld im Dashboard)

Trag hier deine bevorzugte Kontaktmöglichkeit ein, z. B.:

```
Fragen, Fehler oder Feedback bitte über [deine E-Mail-Adresse] oder als Issue im
GitHub-Repository: [Link zum Repository, falls öffentlich]
```

---

## Offene Punkte vor dem Einreichen

- [ ] Platzhalter oben ausfüllen (Kontakt, ggf. Datenschutz-URL)
- [ ] Mindestens 1 Screenshot hochladen (1280×800 oder 640×400 px) – ich kann dir bei
      Bedarf welche vom laufenden Katalog erstellen
- [x] Icon-Set ersetzt (16/32/48/128 px, transparente Ecken, 16px als vereinfachte
      Silhouette ohne Fensterdetails für Lesbarkeit in der Werkzeugleiste)
