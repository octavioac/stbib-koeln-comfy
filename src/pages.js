'use strict';

/** Semantische Marker für weitere formularlastige Portal-Seiten. */
var stbib = globalThis.stbib || (globalThis.stbib = {});

stbib.pages = (() => {
  const FORM_DOCUMENT_CLASS = 'stbib-form-document';
  const QUICK_PAGE_CLASS = 'stbib-quicksearch-page';
  const RESERVATION_PAGE_CLASS = 'stbib-reservation-page';
  let undo = null;
  let activePage = null;
  let activeKind = null;

  /**
   * Die in diesem Durchlauf markierten Portal-Knoten *innerhalb* der Seite.
   * Verschwindet einer davon aus dem Dokument, hat das Portal den Inhalt neu
   * gerendert (etwa nach einem Validierungsfehler der Vormerkung) und die
   * Marker müssen neu gesetzt werden.
   *
   * `#pageContent` selbst taugt dafür nicht: Dieser Knoten überlebt das
   * Neu-Rendern, ein Flag daran würde den Neuaufbau nie bemerken.
   */
  let marked = [];

  /** Merkt einen markierten Knoten und gibt ihn weiter (`undo.x(mark(el), …)`). */
  function mark(element) {
    if (element) {
      marked.push(element);
    }
    return element;
  }

  /**
   * Sind alle Marker noch da? Bei `false` laufen die Text-Scans erneut – sie
   * sind zu teuer, um sie bei jedem Observer-Durchlauf zu wiederholen, aber
   * nicht teuer genug, um einen kaputten Seitenzustand zu rechtfertigen.
   * Ohne gefundene Marker (untypische Seitenvariante) wird immer neu gesucht.
   */
  function marksIntact() {
    return marked.length > 0 && marked.every((element) => element.isConnected);
  }

  function mountQuickSearch(page, form) {
    undo.addClass(document.documentElement, FORM_DOCUMENT_CLASS);
    undo.addClass(page, QUICK_PAGE_CLASS);

    const wrapper = form.querySelector('.wrapper');
    const label = wrapper?.querySelector('label[for="Query"]');
    undo.setText(mark(label), 'Suchbegriff');

    if (wrapper && !wrapper.querySelector('.stbib-quicksearch-intro')) {
      wrapper.prepend(
        stbib.util.el('p', {
          className: 'stbib-quicksearch-intro',
          text: 'Suchen Sie nach Titel, Autor, Thema oder ISBN.',
        })
      );
    }

    undo.setAttribute(mark(form.querySelector('#Query')), 'autocomplete', 'off');
  }

  function tableContaining(element, text) {
    let table = element?.closest('table') || null;
    while (table && !stbib.util.normalizeSpace(table.textContent).includes(text)) {
      table = table.parentElement?.closest('table') || null;
    }
    return table;
  }

  function smallestTextContainer(page, text) {
    return Array.from(page.querySelectorAll('td, p, div'))
      .filter((element) => stbib.util.normalizeSpace(element.textContent).includes(text))
      .sort(
        (left, right) =>
          stbib.util.normalizeSpace(left.textContent).length -
          stbib.util.normalizeSpace(right.textContent).length
      )[0];
  }

  function mountReservation(page) {
    undo.addClass(document.documentElement, FORM_DOCUMENT_CLASS);
    undo.addClass(page, RESERVATION_PAGE_CLASS);

    const titleValue = Array.from(page.querySelectorAll('span.darkLink')).find((element) =>
      tableContaining(element, 'Titel')
    );
    undo.addClass(mark(tableContaining(titleValue, 'Notation')), 'stbib-reservation-meta');

    // Select gezielt über den umgebenden Kontext finden: Das erste <select>
    // der Seite muss nicht die Abholbibliothek sein.
    const pickupHint = smallestTextContainer(page, 'Bitte wählen Sie die Bibliothek');
    const pickup = pickupHint?.closest('table')?.querySelector('select') || null;
    if (pickup) {
      undo.addClass(
        mark(tableContaining(pickup, 'Bitte wählen Sie die Bibliothek')),
        'stbib-reservation-pickup'
      );
      undo.setAttribute(mark(pickup), 'aria-label', 'Abholbibliothek');
    }

    undo.addClass(
      mark(smallestTextContainer(page, 'Vormerkbare Exemplare')),
      'stbib-reservation-status'
    );
    undo.addClass(
      mark(smallestTextContainer(page, 'Das Entgelt für die Vormerkung')),
      'stbib-reservation-fee'
    );

    const controls = page.querySelectorAll('a, button, input[type="submit"], input[type="button"]');
    controls.forEach((control) => {
      const label = stbib.util.normalizeSpace(
        control.tagName === 'INPUT' ? control.value : control.textContent
      );
      if (/^(Bestätigen|Senden)$/.test(label)) {
        undo.addClass(mark(control), 'stbib-reservation-confirm');
      } else if (label === 'Abbrechen') {
        undo.addClass(mark(control), 'stbib-reservation-cancel');
      }
    });

    const confirm = page.querySelector('.stbib-reservation-confirm');
    const cancel = page.querySelector('.stbib-reservation-cancel');
    if (confirm && cancel) {
      let actionRow = confirm.closest('tr');
      while (actionRow && !actionRow.contains(cancel)) {
        actionRow = actionRow.parentElement?.closest('tr') || null;
      }
      undo.addClass(mark(actionRow), 'stbib-reservation-actions');
    }

    const borrower = page.querySelector('#BRWR');
    const pin = page.querySelector('#PIN');
    if (borrower && pin) {
      undo.addClass(mark(tableContaining(pin, 'Bibliotheksausweises')), 'stbib-reservation-login');
      undo.setAttribute(mark(borrower), 'autocomplete', 'username');
      undo.setAttribute(mark(pin), 'autocomplete', 'current-password');
    }
  }

  function mount() {
    const page = document.querySelector('#pageContent');
    const quickForm = page?.querySelector('#ExpertSearch:has(#Query):has(#buttonQuickSearch)');
    const kind = quickForm
      ? 'quick'
      : new URLSearchParams(location.search).get('fn') === 'MakeReservation'
        ? 'reservation'
        : null;

    if (!page || !kind) {
      if (activePage && (!activePage.isConnected || !kind)) {
        unmount();
      }
      return;
    }

    if (activePage && (activePage !== page || activeKind !== kind)) {
      unmount();
    }

    // Bereits bearbeitete Seiten nicht erneut durchsuchen – mount() läuft bei
    // jedem Observer-Durchlauf, und die Text-Scans sind die teuersten Aufrufe.
    if (activePage === page && activeKind === kind && marksIntact()) {
      return;
    }

    undo = undo || stbib.util.reverter();
    activePage = page;
    activeKind = kind;
    // Frischer Durchlauf: Die alten Marker hängen nach einem Neu-Rendern
    // teils außerhalb des Dokuments und würden marksIntact() dauerhaft auf
    // `false` halten. Der Reverter behält seine Aufzeichnungen dagegen –
    // ein restore() vor dem Neu-Markieren würde die Seitenklassen kurz
    // abnehmen und wieder setzen, also sichtbar flackern.
    marked = [];

    if (kind === 'quick') {
      mountQuickSearch(page, quickForm);
    } else {
      mountReservation(page);
    }
  }

  function unmount() {
    stbib.util.removeOwnNodes(document, '.stbib-quicksearch-intro');
    undo?.restore();
    undo = null;
    marked = [];
    activePage = null;
    activeKind = null;
  }

  return { name: 'pages', mount, unmount };
})();
