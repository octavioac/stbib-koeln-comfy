'use strict';

/** Kleine semantische Ergänzungen für die vom Portal gelieferte Login-Seite. */
var stbib = globalThis.stbib || (globalThis.stbib = {});

stbib.account = (() => {
  const DOCUMENT_CLASS = 'stbib-form-document';
  const PAGE_CLASS = 'stbib-account-page';
  const originalAttributes = new Map();
  const originalTexts = new Map();
  const originalPinLabels = new Map();
  const formPlacements = [];
  let activePage = null;

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

  function moveFormBeforeAdvice(form, advice) {
    if (!advice?.parentElement) {
      return;
    }
    const container = Array.from(advice.parentElement.children).find((child) => child.contains(form));
    if (!container || container.nextElementSibling === advice) {
      return;
    }
    formPlacements.push({ node: container, parent: container.parentNode, next: container.nextSibling });
    advice.parentElement.insertBefore(container, advice);
  }

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
    activePage = page;

    document.documentElement.classList.add(DOCUMENT_CLASS);
    page.classList.add(PAGE_CLASS);

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
    moveFormBeforeAdvice(form, advice);

    setText(page.querySelector('.MyZonetitleText'), 'In Ihr Bibliothekskonto einloggen');

    const borrower = form.querySelector('#BRWR');
    const pin = form.querySelector('#PIN');
    setAttribute(borrower, 'autocomplete', 'username');
    setAttribute(pin, 'autocomplete', 'current-password');

    const pinLabel = form.querySelector('label[for="PIN"]');
    if (pinLabel && !originalPinLabels.has(pinLabel)) {
      originalPinLabels.set(
        pinLabel,
        Array.from(pinLabel.childNodes, (node) => node.cloneNode(true))
      );
      pinLabel.textContent = 'PIN oder vorläufiger Zugangscode';
    }

    setText(form.querySelector('.LoginHelpCell a'), 'Hilfe zur Anmeldung');
  }

  function unmount() {
    document.documentElement.classList.remove(DOCUMENT_CLASS);
    activePage?.classList.remove(PAGE_CLASS);
    stbib.util.removeOwnNodes(document, '.stbib-account-intro, .stbib-account-advice-title');

    formPlacements.reverse().forEach(({ node, parent, next }) => {
      if (parent?.isConnected) {
        parent.insertBefore(node, next?.parentNode === parent ? next : null);
      }
    });
    formPlacements.length = 0;

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

    originalPinLabels.forEach((nodes, label) => {
      label.replaceChildren(...nodes);
    });
    originalPinLabels.clear();
    activePage = null;
  }

  return { name: 'account', mount, unmount };
})();
