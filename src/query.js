'use strict';

/**
 * Feature: ISBN-Erkennung in der Suche.
 *
 * Das Portal findet einen Titel nur über den Index-Präfix `isbn=`; eine blank
 * eingegebene ISBN läuft ins Leere ("Leider wurden keine Titel … gefunden"),
 * mit oder ohne Bindestriche. Wir schreiben die Eingabe vor dem Absenden um und
 * bieten auf Nulltreffer-Seiten zusätzlich einen Wiederholen-Link an.
 *
 * Der Präfix muss klein geschrieben sein – `ISBN=` behandelt das Portal als Wort.
 */
var stbib = globalThis.stbib || (globalThis.stbib = {});

stbib.query = (() => {
  const util = stbib.util;

  const QUERY_INPUT_SELECTOR = 'input#Query, input[name="q.Query"]';
  const HINT_CLASS = 'stbib-isbn-hint';
  /** Bereits qualifizierte Suchen (au=, ti=, isbn=, …) nicht anfassen. */
  const QUALIFIED_QUERY = /^[a-z][a-z0-9]{1,12}\s*=/i;

  /**
   * Die Listener hängen ab dem Laden dieser Datei – nicht erst in `mount()`.
   *
   * `mount()` läuft erst, wenn `chrome.storage.local.get` geantwortet hat. In
   * diesem Zeitfenster ist die Seite schon bedienbar: Wer sofort tippt und
   * abschickt, würde die Umschreibung sonst verpassen. Bis die Einstellungen
   * vorliegen, gilt die Vorgabe „an“ – genau wie im Rest der Erweiterung.
   *
   * Abgeschaltet gilt das für wenige Millisekunden nicht. Der Effekt wäre eine
   * einzelne als ISBN gesuchte Eingabe – sichtbar in der Suchanzeige und
   * harmloser als der umgekehrte Fall (Titel wird nicht gefunden).
   */
  let featureEnabled = true;

  function stripSeparators(value) {
    return String(value || '').replace(/[\s-]/g, '');
  }

  function isbn10ChecksumOk(value) {
    let sum = 0;
    for (let i = 0; i < 9; i += 1) {
      sum += (10 - i) * Number(value[i]);
    }
    const last = value[9].toUpperCase();
    sum += last === 'X' ? 10 : Number(last);
    return sum % 11 === 0;
  }

  function isbn13ChecksumOk(value) {
    let sum = 0;
    for (let i = 0; i < 13; i += 1) {
      sum += Number(value[i]) * (i % 2 === 0 ? 1 : 3);
    }
    return sum % 10 === 0;
  }

  function isbn10To13(value) {
    const core = `978${value.slice(0, 9)}`;
    let sum = 0;
    for (let i = 0; i < 12; i += 1) {
      sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
    }
    return `${core}${(10 - (sum % 10)) % 10}`;
  }

  function isbn13To10(value) {
    if (!value.startsWith('978')) {
      return null;
    }
    const core = value.slice(3, 12);
    let sum = 0;
    for (let i = 0; i < 9; i += 1) {
      sum += (10 - i) * Number(core[i]);
    }
    const check = (11 - (sum % 11)) % 11;
    return `${core}${check === 10 ? 'X' : check}`;
  }

  /**
   * Erkennt eine ISBN und liefert alle Schreibweisen, unter denen der Katalog
   * sie führen kann (ISBN-10 und ISBN-13). Sonst `null`.
   * @returns {string[] | null}
   */
  function isbnVariants(rawQuery) {
    const compact = stripSeparators(rawQuery);

    if (/^\d{9}[\dX]$/i.test(compact) && isbn10ChecksumOk(compact)) {
      return [isbn10To13(compact), compact.toUpperCase()];
    }

    if (/^97[89]\d{10}$/.test(compact) && isbn13ChecksumOk(compact)) {
      const as10 = isbn13To10(compact);
      return as10 ? [compact, as10] : [compact];
    }

    return null;
  }

  /**
   * Baut aus einer Roheingabe die Katalog-Suchanfrage.
   * @returns {string | null} umgeschriebene Anfrage oder `null`, wenn nichts zu tun ist
   */
  function rewrite(rawQuery) {
    const trimmed = String(rawQuery || '').trim();
    if (!trimmed || QUALIFIED_QUERY.test(trimmed)) {
      return null;
    }
    const variants = isbnVariants(trimmed);
    if (!variants) {
      return null;
    }
    return variants.map((isbn) => `isbn=${isbn}`).join(' or ');
  }

  /** Schreibt den Wert des Suchfelds um, bevor das Portal-JS `form.submit()` aufruft. */
  function rewriteInput(input) {
    if (!input) {
      return;
    }
    const rewritten = rewrite(input.value);
    if (rewritten) {
      input.value = rewritten;
    }
  }

  function onKeyDownCapture(event) {
    if (!featureEnabled || event.key !== 'Enter' || event.defaultPrevented) {
      return;
    }
    const target = event.target;
    if (target instanceof HTMLInputElement && target.matches(QUERY_INPUT_SELECTOR)) {
      rewriteInput(target);
    }
  }

  function onClickCapture(event) {
    if (!featureEnabled) {
      return;
    }
    const trigger = event.target instanceof Element
      ? event.target.closest('#buttonQuickSearch')
      : null;
    if (!trigger) {
      return;
    }
    const form = trigger.closest('form') || document;
    rewriteInput(form.querySelector(QUERY_INPUT_SELECTOR));
  }

  /** Die Suchanfrage der aktuellen Seite – aus URL oder Suchfeld. */
  function currentQuery() {
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get('q') || params.get('q.Query');
    if (fromUrl) {
      return fromUrl;
    }
    const input = document.querySelector(QUERY_INPUT_SELECTOR);
    return (input && input.value) || '';
  }

  /**
   * Nulltreffer-Seite: Wenn die Anfrage wie eine ISBN aussieht, einen Link auf
   * die korrekt qualifizierte Suche anbieten. Fängt auch Aufrufe ab, die nicht
   * über das Suchfeld liefen (Lesezeichen, erweiterte Suche, geteilte Links).
   */
  function mountZeroResultHint() {
    const advice = document.getElementById('ErrorAdvice');
    if (!advice || advice.querySelector(`.${HINT_CLASS}`)) {
      return;
    }

    const rewritten = rewrite(currentQuery());
    if (!rewritten) {
      return;
    }

    const params = new URLSearchParams({
      fn: 'Search',
      q: rewritten,
      Style: util.currentStyle(),
      Lang: 'GER',
      ResponseEncoding: 'utf-8',
    });

    const link = util.el('a', {
      className: 'stbib-isbn-hint__link',
      text: 'Als ISBN suchen',
      attrs: { href: `${util.CATALOG_BASE}APS_ZONES?${params.toString()}` },
    });

    const row = util.el('tr', {
      className: HINT_CLASS,
      children: [
        util.el('td', {
          attrs: { colspan: '99' },
          children: [
            util.el('span', {
              className: 'stbib-isbn-hint__text',
              text: 'Das sieht nach einer ISBN aus. Der Katalog findet ISBN nur mit dem Präfix „isbn=“. ',
            }),
            link,
          ],
        }),
      ],
    });

    const body = advice.querySelector('tbody') || advice;
    body.appendChild(row);
  }

  /*
   * Capture-Phase: läuft vor dem Inline-Handler des Portals. Der Such-Button
   * ist ein `javascript:startSearch()`-Link und ruft `form.submit()` direkt auf –
   * dabei feuert kein submit-Event, an das wir uns hängen könnten.
   *
   * Die Listener bleiben für die Lebensdauer der Seite hängen und sind inaktiv,
   * solange `featureEnabled` false ist. Das vermeidet Wettläufe beim Ab- und
   * Wiederanmelden.
   */
  document.addEventListener('keydown', onKeyDownCapture, true);
  document.addEventListener('click', onClickCapture, true);

  function mount() {
    featureEnabled = true;
    mountZeroResultHint();
  }

  function unmount() {
    featureEnabled = false;
    util.removeOwnNodes(document, `.${HINT_CLASS}`);
  }

  return {
    name: 'query',
    storageKey: 'stbibSmartQuery',
    mount,
    unmount,
    // für Tests
    _internals: { rewrite, isbnVariants },
  };
})();
