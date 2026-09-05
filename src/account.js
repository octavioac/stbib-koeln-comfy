'use strict';

/** Kleine semantische Ergänzungen für die vom Portal gelieferte Login-Seite. */
var stbib = globalThis.stbib || (globalThis.stbib = {});

stbib.account = (() => {
  const DOCUMENT_CLASS = 'stbib-form-document';
  const PAGE_CLASS = 'stbib-account-page';
  let undo = null;
  let activePage = null;

  function mount() {
    const form = document.querySelector('#LoginForm');
    const page = form && form.closest('#pageContent');
    if (!form || !page) {
      if (activePage) {
        unmount();
      }
      return;
    }

    if (activePage && activePage !== page) {
      unmount();
    }
    undo = undo || stbib.util.reverter();
    activePage = page;

    undo.addClass(document.documentElement, DOCUMENT_CLASS);
    undo.addClass(page, PAGE_CLASS);

    if (!form.querySelector('.stbib-account-intro')) {
      form.prepend(
        stbib.util.el('p', {
          className: 'stbib-account-intro',
          text: 'Melden Sie sich mit Ihrer Ausweisnummer und Ihrer PIN an.',
        })
      );
    }

    const advice = page.querySelector('.loginAdvice');
    if (advice && !advice.querySelector('.stbib-account-advice-title')) {
      advice.prepend(
        stbib.util.el('h3', {
          className: 'stbib-account-advice-title',
          text: 'Hinweise zu Ihrer PIN',
        })
      );
    }

    const container = Array.from(advice?.parentElement?.children || []).find((child) =>
      child.contains(form)
    );
    if (container && container.nextElementSibling !== advice) {
      undo.moveBefore(container, advice);
    }

    undo.setText(page.querySelector('.MyZonetitleText'), 'In Ihr Bibliothekskonto einloggen');

    undo.setAttribute(form.querySelector('#BRWR'), 'autocomplete', 'username');
    undo.setAttribute(form.querySelector('#PIN'), 'autocomplete', 'current-password');

    const pinLabel = form.querySelector('label[for="PIN"]');
    if (pinLabel) {
      undo.setChildren(
        pinLabel,
        stbib.util.el('span', { text: 'PIN oder vorläufiger Zugangscode' })
      );
    }

    undo.setText(form.querySelector('.LoginHelpCell a'), 'Hilfe zur Anmeldung');
  }

  function unmount() {
    stbib.util.removeOwnNodes(document, '.stbib-account-intro, .stbib-account-advice-title');
    undo?.restore();
    undo = null;
    activePage = null;
  }

  return { name: 'account', mount, unmount };
})();
