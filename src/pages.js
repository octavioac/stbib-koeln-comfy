'use strict';

/** Semantische Marker für weitere formularlastige Portal-Seiten. */
var stbib = globalThis.stbib || (globalThis.stbib = {});

stbib.pages = (() => {
  const FORM_DOCUMENT_CLASS = 'stbib-form-document';
  const QUICK_PAGE_CLASS = 'stbib-quicksearch-page';
  const RESERVATION_PAGE_CLASS = 'stbib-reservation-page';
  const addedClasses = [];
  const originalAttributes = new Map();
  const originalTexts = new Map();
  let activePage = null;
  let activeKind = null;

  function addClass(element, className) {
    if (element && !element.classList.contains(className)) {
      element.classList.add(className);
      addedClasses.push([element, className]);
    }
  }

  function setAttribute(element, name, value) {
    if (!element || element.getAttribute(name) === value) {
      return;
    }
    if (!originalAttributes.has(element)) {
      originalAttributes.set(element, new Map());
    }
    const attributes = originalAttributes.get(element);
    if (!attributes.has(name)) {
      attributes.set(name, element.getAttribute(name));
    }
    element.setAttribute(name, value);
  }

  function setText(element, value) {
    if (!element || originalTexts.has(element)) {
      return;
    }
    originalTexts.set(element, element.textContent || '');
    element.textContent = value;
  }

  function mountQuickSearch(page, form) {
    addClass(document.documentElement, FORM_DOCUMENT_CLASS);
    addClass(page, QUICK_PAGE_CLASS);

    const wrapper = form.querySelector('.wrapper');
    const label = wrapper?.querySelector('label[for="Query"]');
    setText(label, 'Suchbegriff');

    if (wrapper && !wrapper.querySelector('.stbib-quicksearch-intro')) {
      wrapper.prepend(
        stbib.util.el('p', {
          className: 'stbib-quicksearch-intro',
          text: 'Suchen Sie nach Titel, Autor, Thema oder ISBN.',
        })
      );
    }

    setAttribute(form.querySelector('#Query'), 'autocomplete', 'off');
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
    addClass(document.documentElement, FORM_DOCUMENT_CLASS);
    addClass(page, RESERVATION_PAGE_CLASS);

    const titleValue = Array.from(page.querySelectorAll('span.darkLink')).find((element) =>
      tableContaining(element, 'Titel')
    );
    addClass(tableContaining(titleValue, 'Notation'), 'stbib-reservation-meta');

    // Select gezielt über den umgebenden Kontext finden: Das erste <select>
    // der Seite muss nicht die Abholbibliothek sein.
    const pickupHint = smallestTextContainer(page, 'Bitte wählen Sie die Bibliothek');
    const pickup = pickupHint?.closest('table')?.querySelector('select') || null;
    if (pickup) {
      addClass(tableContaining(pickup, 'Bitte wählen Sie die Bibliothek'), 'stbib-reservation-pickup');
      setAttribute(pickup, 'aria-label', 'Abholbibliothek');
    }

    addClass(
      smallestTextContainer(page, 'Vormerkbare Exemplare'),
      'stbib-reservation-status'
    );
    addClass(
      smallestTextContainer(page, 'Das Entgelt für die Vormerkung'),
      'stbib-reservation-fee'
    );

    const controls = page.querySelectorAll('a, button, input[type="submit"], input[type="button"]');
    controls.forEach((control) => {
      const label = stbib.util.normalizeSpace(
        control.tagName === 'INPUT' ? control.value : control.textContent
      );
      if (/^(Bestätigen|Senden)$/.test(label)) {
        addClass(control, 'stbib-reservation-confirm');
      } else if (label === 'Abbrechen') {
        addClass(control, 'stbib-reservation-cancel');
      }
    });

    const confirm = page.querySelector('.stbib-reservation-confirm');
    const cancel = page.querySelector('.stbib-reservation-cancel');
    if (confirm && cancel) {
      let actionRow = confirm.closest('tr');
      while (actionRow && !actionRow.contains(cancel)) {
        actionRow = actionRow.parentElement?.closest('tr') || null;
      }
      addClass(actionRow, 'stbib-reservation-actions');
    }

    const borrower = page.querySelector('#BRWR');
    const pin = page.querySelector('#PIN');
    if (borrower && pin) {
      addClass(tableContaining(pin, 'Bibliotheksausweises'), 'stbib-reservation-login');
      setAttribute(borrower, 'autocomplete', 'username');
      setAttribute(pin, 'autocomplete', 'current-password');
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
    activePage = page;
    activeKind = kind;

    if (kind === 'quick') {
      mountQuickSearch(page, quickForm);
      return;
    }
    mountReservation(page);
  }

  function unmount() {
    stbib.util.removeOwnNodes(document, '.stbib-quicksearch-intro');

    originalAttributes.forEach((attributes, element) => {
      attributes.forEach((value, name) => {
        if (value == null) {
          element.removeAttribute(name);
        } else {
          element.setAttribute(name, value);
        }
      });
    });
    originalAttributes.clear();

    originalTexts.forEach((value, element) => {
      element.textContent = value;
    });
    originalTexts.clear();

    addedClasses.reverse().forEach(([element, className]) => element.classList.remove(className));
    addedClasses.length = 0;
    activePage = null;
    activeKind = null;
  }

  return { name: 'pages', mount, unmount };
})();
