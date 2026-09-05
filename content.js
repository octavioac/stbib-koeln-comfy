'use strict';

/**
 * Bootstrap der Erweiterung: Styles einhängen, Theme setzen, Feature-Module
 * anwenden und den DOM beobachten.
 *
 * Die Feature-Module liegen in `src/` und werden über das Manifest vor dieser
 * Datei geladen (gemeinsamer Namensraum `globalThis.stbib`).
 */

/** Pfade relativ zur Erweiterungs-Root (web_accessible_resources). */
const STYLESHEETS = [
  'styles/tokens.css',
  'styles/base.css',
  'styles/layout.css',
  'styles/components.css',
  'styles/results.css',
  'styles/pages.css',
  'styles/features.css',
  'styles/print.css',
  'styles/theme-dark.css',
];

const LINK_ATTR = 'data-stbib-katalog-modern';

const STORAGE_DEFAULTS = {
  stbibModernEnabled: true,
  stbibDarkMode: false,
  stbibHoldings: true,
  stbibHoldingsAuto: false,
  stbibLoadMore: true,
  stbibSmartQuery: true,
};

/** Reihenfolge = Anwendungsreihenfolge; Facetten zuerst, damit Tiles stehen. */
const MODULES = [
  stbib.facets,
  stbib.holdings,
  stbib.loadmore,
  stbib.query,
  stbib.account,
  stbib.pages,
];

/** Verzögerung für den DOM-Beobachter (ms). */
const OBSERVE_DEBOUNCE = 200;

let observer = null;
let viewportNode = null;
let currentSettings = { ...STORAGE_DEFAULTS };

function syncViewport() {
  const nativeViewport = document.querySelector(
    `meta[name="viewport"]:not([${stbib.util.OWN_NODE_ATTR}])`
  );
  if (nativeViewport) {
    viewportNode?.remove();
    viewportNode = null;
    return;
  }
  if (!viewportNode?.isConnected) {
    viewportNode = stbib.util.ensureViewport();
  }
}

function inject(doc, enabled) {
  const existing = doc.querySelectorAll(`link[rel="stylesheet"][${LINK_ATTR}]`);
  if (enabled && matchesStylesheets(existing)) {
    return;
  }
  existing.forEach((el) => {
    el.remove();
  });
  if (!enabled) {
    return;
  }
  const head = doc.head || doc.documentElement;
  for (const path of STYLESHEETS) {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL(path);
    link.setAttribute(LINK_ATTR, '1');
    head.appendChild(link);
  }
}

/** Stimmen die vorhandenen Links exakt mit STYLESHEETS überein (Reihenfolge zählt)? */
function matchesStylesheets(links) {
  if (links.length !== STYLESHEETS.length) {
    return false;
  }
  return STYLESHEETS.every((path, index) => {
    const href = links[index].getAttribute('href') || '';
    return href.endsWith(path);
  });
}

/** @param {Document} doc */
function applyTheme(doc, modernEnabled, dark) {
  const root = doc.documentElement;
  if (!modernEnabled) {
    root.removeAttribute('data-stbib-theme');
    return;
  }
  root.setAttribute('data-stbib-theme', dark ? 'dark' : 'light');
}

function moduleEnabled(module, settings) {
  return module.storageKey ? settings[module.storageKey] !== false : true;
}

function applyModules(settings) {
  syncViewport();
  for (const module of MODULES) {
    try {
      if (moduleEnabled(module, settings)) {
        module.mount(settings);
      } else {
        module.unmount();
      }
    } catch (error) {
      console.warn(`[stbib] Modul "${module?.name ?? '?'}" fehlgeschlagen:`, error);
    }
  }
}

function unmountModules() {
  for (const module of MODULES) {
    try {
      module.unmount();
    } catch (error) {
      console.warn(`[stbib] Modul "${module?.name ?? '?'}" konnte nicht entfernt werden:`, error);
    }
  }
}

/**
 * Prüft, ob eine Mutation nur von der Erweiterung selbst stammt. Ohne diesen
 * Filter würde jede eigene Einfügung einen weiteren Durchlauf auslösen.
 */
function isOwnMutation(record) {
  const nodes = [...record.addedNodes, ...record.removedNodes];
  if (!nodes.length) {
    return true;
  }
  return nodes.every((node) => {
    if (node.nodeType !== 1) {
      return true;
    }
    return (
      node.hasAttribute(stbib.util.OWN_NODE_ATTR) ||
      node.hasAttribute(LINK_ATTR) ||
      node.closest(`[${stbib.util.OWN_NODE_ATTR}]`) !== null
    );
  });
}

/**
 * Teile der Seite entstehen erst nach dem Start: Bei `document_start` (nötig
 * gegen FOUC) existiert `document.body` noch nicht, wenn der erste
 * Storage-Callback zurückkommt – und auch danach kommen Facetten-Listen,
 * jQuery-Umsortierungen, Dialoge und „Mehr laden“-Zeilen erst nach und nach.
 * Der Beobachter hängt darum an `documentElement` (existiert bereits ab
 * `document_start`), nicht an `body`.
 */
function startObserver() {
  if (observer || !document.documentElement) {
    return;
  }

  const rerun = stbib.util.debounce(() => {
    applyModules(currentSettings);
  }, OBSERVE_DEBOUNCE);

  observer = new MutationObserver((records) => {
    if (records.every(isOwnMutation)) {
      return;
    }
    rerun();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function syncPage(stored) {
  currentSettings = { ...STORAGE_DEFAULTS, ...stored };
  const enabled = currentSettings.stbibModernEnabled !== false;

  if (!enabled) {
    stopObserver();
    unmountModules();
    viewportNode?.remove();
    viewportNode = null;
  }

  inject(document, enabled);
  applyTheme(document, enabled, currentSettings.stbibDarkMode === true);

  if (enabled) {
    applyModules(currentSettings);
    startObserver();
  }
}

chrome.storage.local.get(STORAGE_DEFAULTS, (stored) => {
  syncPage(stored);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') {
    return;
  }
  if (!Object.keys(STORAGE_DEFAULTS).some((key) => changes[key] !== undefined)) {
    return;
  }
  chrome.storage.local.get(STORAGE_DEFAULTS, (stored) => {
    syncPage(stored);
  });
});
