'use strict';

/** Semantische Marker für weitere formularlastige Portal-Seiten. */
var stbib = globalThis.stbib || (globalThis.stbib = {});

stbib.pages = (() => {
  const FORM_DOCUMENT_CLASS = 'stbib-form-document';
  const QUICK_PAGE_CLASS = 'stbib-quicksearch-page';
  const RESERVATION_PAGE_CLASS = 'stbib-reservation-page';
  const PAGE_FLAG = 'stbibPages';
  let undo = null;
  let activePage = null;
  let activeKind = null;

  function mountQuickSearch(page, form) {
    undo.addClass(document.documentElement, FORM_DOCUMENT_CLASS);
    undo.addClass(page, QUICK_PAGE_CLASS);

    const wrapper = form.querySelector('.wrapper');
    const label = wrapper?.querySelector('label[for="Query"]');
    undo.setText(label, 'Suchbegriff');

    if (wrapper && !wrapper.querySelector('.stbib-quicksearch-intro')) {
      wrapper.prepend(
        stbib.util.el('p', {
          className: 'stbib-quicksearch-intro',
          text: 'Suchen Sie nach Titel, Autor, Thema oder ISBN.',
        })
      );
    }

    undo.setAttribute(form.querySelector('#Query'), 'autocomplete', 'off');
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
    undo.addClass(tableContaining(titleValue, 'Notation'), 'stbib-reservation-meta');

    // Select gezielt über den umgebenden Kontext finden: Das erste <select>
    // der Seite muss nicht die Abholbibliothek sein.
    const pickupHint = smallestTextContainer(page, 'Bitte wählen Sie die Bibliothek');
    const pickup = pickupHint?.closest('table')?.querySelector('select') || null;
    if (pickup) {
      undo.addClass(
        tableContaining(pickup, 'Bitte wählen Sie die Bibliothek'),
        'stbib-reservation-pickup'
      );
      undo.setAttribute(pickup, 'aria-label', 'Abholbibliothek');
    }

    undo.addClass(
      smallestTextContainer(page, 'Vormerkbare Exemplare'),
      'stbib-reservation-status'
    );
    undo.addClass(
      smallestTextContainer(page, 'Das Entgelt für die Vormerkung'),
      'stbib-reservation-fee'
    );

    const controls = page.querySelectorAll('a, button, input[type="submit"], input[type="button"]');
    controls.forEach((control) => {
      const label = stbib.util.normalizeSpace(
        control.tagName === 'INPUT' ? control.value : control.textContent
      );
      if (/^(Bestätigen|Senden)$/.test(label)) {
        undo.addClass(control, 'stbib-reservation-confirm');
      } else if (label === 'Abbrechen') {
        undo.addClass(control, 'stbib-reservation-cancel');
      }
    });

    const confirm = page.querySelector('.stbib-reservation-confirm');
    const cancel = page.querySelector('.stbib-reservation-cancel');
    if (confirm && cancel) {
      let actionRow = confirm.closest('tr');
      while (actionRow && !actionRow.contains(cancel)) {
        actionRow = actionRow.parentElement?.closest('tr') || null;
      }
      undo.addClass(actionRow, 'stbib-reservation-actions');
    }

    const borrower = page.querySelector('#BRWR');
    const pin = page.querySelector('#PIN');
    if (borrower && pin) {
      undo.addClass(tableContaining(pin, 'Bibliotheksausweises'), 'stbib-reservation-login');
      undo.setAttribute(borrower, 'autocomplete', 'username');
      undo.setAttribute(pin, 'autocomplete', 'current-password');
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
    if (activePage === page && activeKind === kind && page.dataset[PAGE_FLAG] === kind) {
      return;
    }

    undo = undo || stbib.util.reverter();
    activePage = page;
    activeKind = kind;

    if (kind === 'quick') {
      mountQuickSearch(page, quickForm);
    } else {
      mountReservation(page);
    }
    page.dataset[PAGE_FLAG] = kind;
  }

  function unmount() {
    stbib.util.removeOwnNodes(document, '.stbib-quicksearch-intro');
    if (activePage) {
      delete activePage.dataset[PAGE_FLAG];
    }
    undo?.restore();
    undo = null;
    activePage = null;
    activeKind = null;
  }

  return { name: 'pages', mount, unmount };
})();
