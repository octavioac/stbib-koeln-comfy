'use strict';

/**
 * Feature: „Mehr laden" statt Seitenblättern.
 *
 * Das Portal liefert fest 10 Treffer pro Seite; `PageSize` in der URL wird
 * ignoriert. 2026 Treffer bedeuten also 203 Seitenaufrufe.
 *
 * `Method=PageDown` gegen das Session-Handle der laufenden Suche liefert
 * jeweils die nächsten 10 Treffer und rückt den serverseitigen Cursor vor.
 * Wir holen die Seite per `fetch`, hängen die Zeilen an die Liste an und
 * schreiben die Seitenanzeige des Portals mit, damit dessen eigene Blätter-
 * Links weiterhin stimmen.
 */
var stbib = globalThis.stbib || (globalThis.stbib = {});

stbib.loadmore = (() => {
  const util = stbib.util;

  const BAR_CLASS = 'stbib-loadmore';
  const PAGE_DOWN_SELECTOR = 'a.pageNavLink[href*="Method=PageDown"]';
  const PAGE_INPUT_SELECTOR = 'input[name="Query.Page"]';

  let nextUrl = '';
  let loading = false;
  let exhausted = false;
  /** Fehlermeldung für die Statusanzeige; bleibt stehen, bis ein Versuch klappt. */
  let statusError = '';
  /**
   * Das BrowseList-Element, für das `nextUrl`/`baseOffset` ermittelt wurden.
   * Ein neues Element bedeutet eine neue Suche – dann wird neu initialisiert.
   * (Normalerweise navigiert das Portal pro Suche im iframe, sodass die
   * Content-Script-Welt ohnehin neu startet; das hier ist die Absicherung
   * für den Fall, dass die Liste im selben Dokument ausgetauscht wird.)
   */
  let initialisedFor = null;

  function list() {
    return document.getElementById('BrowseList') || document.querySelector('table.browseList');
  }

  function tbody() {
    const table = list();
    return table ? table.querySelector('tbody') : null;
  }

  function rowCount() {
    const body = tbody();
    return body ? body.querySelectorAll(':scope > tr').length : 0;
  }

  /** Gesamttrefferzahl aus „Ergebnisse (555)". */
  function totalHits() {
    const scope = document.querySelector('.searchHits');
    const match = /\(\s*([\d.]+)\s*\)/.exec(scope ? scope.textContent || '' : '');
    return match ? Number(match[1].replace(/\./g, '')) : 0;
  }

  /** Aktuelle Seite laut Portal-Anzeige (1-basiert). */
  function currentPage() {
    const input = document.querySelector(PAGE_INPUT_SELECTOR);
    const value = input ? Number(input.value) : 1;
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  /** Wie viele Treffer vor der ersten angezeigten Zeile liegen. */
  let baseOffset = 0;

  function loadedThrough() {
    return baseOffset + rowCount();
  }

  function pageDownUrl(scope) {
    const link = scope.querySelector(PAGE_DOWN_SELECTOR);
    return link ? link.getAttribute('href') || '' : '';
  }

  /** Seitenanzeige des Portals auf den neuen Server-Cursor setzen. */
  function syncPortalPageDisplay(doc) {
    const source = doc.querySelector(PAGE_INPUT_SELECTOR);
    if (!source) {
      return;
    }
    for (const input of util.qsa(PAGE_INPUT_SELECTOR)) {
      input.value = source.value;
    }
  }

  /**
   * Hängt die Zeilen aus `doc` an die Liste an.
   * @returns {number | null} Anzahl übernommener Zeilen; `null`, wenn das
   *   geholte Dokument keine Trefferliste enthält (z. B. abgelaufene Session
   *   oder Portal-Störung) – das ist ein wiederholbarer Fehlfall, kein Listenende.
   */
  function importRows(doc) {
    const sourceBody = doc.querySelector('#BrowseList > tbody, table.browseList > tbody');
    const target = tbody();
    if (!sourceBody || !target) {
      return null;
    }

    const rows = Array.from(sourceBody.querySelectorAll(':scope > tr'));
    let added = 0;
    for (const row of rows) {
      const imported = document.importNode(row, true);
      /*
       * Vorsichtsmaßnahme: keine Skripte aus geholtem Markup übernehmen.
       *
       * Inline-Handler (`onclick="MakeNote('T…')"` & Co.) bleiben bewusst
       * stehen: Das Portal bindet die Zeilenaktionen genau so, und die
       * Antwort kommt von derselben Herkunft und Sitzung wie die erste
       * Seite. Sie zu entfernen würde nachgeladene Zeilen anders behandeln
       * als die schon vorhandenen – die Aktionen wären dort tot, und
       * `util.recordId()` verlöre seinen MakeNote-Fallback.
       */
      imported.querySelectorAll('script').forEach((node) => node.remove());
      target.appendChild(imported);
      added += 1;
    }
    return added;
  }

  function updateBar() {
    const bar = document.querySelector(`.${BAR_CLASS}`);
    if (!bar) {
      return;
    }

    const button = bar.querySelector(`.${BAR_CLASS}__button`);
    const status = bar.querySelector(`.${BAR_CLASS}__status`);
    const total = totalHits();
    const shown = loadedThrough();

    status.textContent = statusError
      ? statusError
      : total
        ? `Treffer ${baseOffset + 1}–${shown} von ${total}`
        : `${rowCount()} Treffer geladen`;

    if (loading) {
      button.disabled = true;
      button.textContent = 'Wird geladen …';
      return;
    }

    const allShown = exhausted || (total > 0 && shown >= total);
    button.disabled = allShown;
    button.textContent = allShown ? 'Alle Treffer geladen' : 'Weitere 10 Treffer laden';
  }

  async function loadMore() {
    if (loading || exhausted || !nextUrl) {
      return;
    }
    loading = true;
    updateBar();

    try {
      const fetchedUrl = new URL(nextUrl, location.href).href;
      // Mit Wiederholung: Das Portal drosselt auf zwei gleichzeitige Abfragen,
      // und das Auto-Laden des Bestands kann dieselbe Drossel belegen.
      const doc = await util.fetchDocumentRetrying(fetchedUrl);
      const added = importRows(doc);

      if (added == null) {
        // Keine Trefferliste in der Antwort: Session weg oder Portal gestört.
        // Nicht als Listenende interpretieren – der Nutzer kann es erneut versuchen.
        console.warn('[stbib] Nachladen lieferte keine Trefferliste:', fetchedUrl);
        statusError = 'Laden fehlgeschlagen – bitte erneut versuchen.';
      } else {
        statusError = '';
        syncPortalPageDisplay(doc);
        const followUp = pageDownUrl(doc);
        // Fehlt der Link, war das die letzte Seite. Auflösen gegen die geholte
        // URL, nicht gegen location.href – die Basis der Weiterführung ist die
        // Seite, von der der Link stammt.
        nextUrl = followUp ? new URL(followUp, fetchedUrl).href : '';
        if (!followUp) {
          exhausted = true;
        }
      }
    } catch (error) {
      console.warn('[stbib] Weitere Treffer konnten nicht geladen werden:', error);
      statusError = 'Laden fehlgeschlagen – bitte erneut versuchen.';
    } finally {
      loading = false;
      updateBar();
      // Die neuen Zeilen bekommen ihre Bestands-Schaltflächen über den
      // MutationObserver in content.js.
    }
  }

  function mountBar() {
    const table = list();
    if (!table || document.querySelector(`.${BAR_CLASS}`)) {
      return;
    }

    const button = util.el('button', {
      className: `${BAR_CLASS}__button`,
      text: 'Weitere 10 Treffer laden',
      attrs: { type: 'button' },
    });
    button.addEventListener('click', loadMore);

    const bar = util.el('div', {
      className: BAR_CLASS,
      children: [button, util.el('span', { className: `${BAR_CLASS}__status` })],
    });

    table.parentNode.insertBefore(bar, table.nextSibling);
    updateBar();
  }

  function mount() {
    const table = list();
    if (!table) {
      return;
    }

    if (initialisedFor !== table) {
      /*
       * Nur für eine neue Liste: `Query.Page` wird nach jedem Nachladen auf den
       * neuen Server-Cursor geschrieben. Würde `baseOffset` bei einem späteren
       * mount() – etwa nach Aus- und Wiedereinschalten – erneut daraus
       * berechnet, zählte die Leiste falsch. Eine andere Tabellen-Instanz ist
       * dagegen eine neue Suche und wird neu initialisiert.
       */
      nextUrl = pageDownUrl(document);
      exhausted = !nextUrl;
      baseOffset = (currentPage() - 1) * 10;
      // Die Fehlermeldung gehört zur alten Liste – sonst startet die neue
      // Suche mit „Laden fehlgeschlagen“ statt mit der Trefferzahl.
      statusError = '';
      initialisedFor = table;
    }

    mountBar();
    updateBar();
  }

  function unmount() {
    // Bereits nachgeladene Trefferzeilen bleiben stehen: Sie sind echter
    // Katalog-Inhalt, kein Beiwerk der Erweiterung.
    util.removeOwnNodes(document, `.${BAR_CLASS}`);
  }

  return {
    name: 'loadmore',
    storageKey: 'stbibLoadMore',
    mount,
    unmount,
  };
})();
