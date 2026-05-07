'use strict';

/** Pfade relativ zur Erweiterungs-Root (web_accessible_resources). */
const STYLESHEETS = [
  'styles/tokens.css',
  'styles/base.css',
  'styles/layout.css',
  'styles/components.css',
  'styles/results.css',
  'styles/print.css',
  'styles/theme-dark.css',
];

const LINK_ATTR = 'data-stbib-katalog-modern';

const STORAGE_MODERN = 'stbibModernEnabled';
const STORAGE_DARK = 'stbibDarkMode';

function removeInjected(doc) {
  doc.querySelectorAll(`link[rel="stylesheet"][${LINK_ATTR}]`).forEach((el) => {
    el.remove();
  });
}

function inject(doc, enabled) {
  removeInjected(doc);
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

/** @param {Document} doc */
function applyTheme(doc, modernEnabled, dark) {
  const root = doc.documentElement;
  if (!modernEnabled) {
    root.removeAttribute('data-stbib-theme');
    return;
  }
  root.setAttribute('data-stbib-theme', dark ? 'dark' : 'light');
}

/**
 * Portal liefert pro Facette .FacetHeader + .FacetsList als Geschwister in einem .FacetBox.
 * Wir wrappen jedes Paar in .stbib-facet-tile, damit CSS-Grid mehrere Akkordeons pro Zeile legen kann.
 * @param {Document} doc
 */
function wrapFacetTiles(doc) {
  doc.querySelectorAll('#leftMenuContainer .FacetBox').forEach((box) => {
    if (box.dataset.stbibFacetWrapped === '1') {
      return;
    }
    const headers = box.querySelectorAll(':scope > .FacetHeader');
    headers.forEach((header) => {
      const list = header.nextElementSibling;
      if (!list || !list.classList.contains('FacetsList')) {
        return;
      }
      const tile = doc.createElement('div');
      tile.className = 'stbib-facet-tile';
      box.insertBefore(tile, header);
      tile.appendChild(header);
      tile.appendChild(list);
    });
    box.dataset.stbibFacetWrapped = '1';
  });
}

/**
 * @param {Document} doc
 */
function unwrapFacetTiles(doc) {
  doc.querySelectorAll('#leftMenuContainer .FacetBox').forEach((box) => {
    if (box.dataset.stbibFacetWrapped !== '1') {
      return;
    }
    box.querySelectorAll(':scope > .stbib-facet-tile').forEach((tile) => {
      const parent = tile.parentNode;
      if (!parent) {
        return;
      }
      const frag = doc.createDocumentFragment();
      while (tile.firstChild) {
        frag.appendChild(tile.firstChild);
      }
      parent.insertBefore(frag, tile);
      tile.remove();
    });
    delete box.dataset.stbibFacetWrapped;
  });
}

function modernEnabledFromStored(stored) {
  return stored[STORAGE_MODERN] !== false;
}

function darkEnabledFromStored(stored) {
  return stored[STORAGE_DARK] === true;
}

function syncPage(stored) {
  const enabled = modernEnabledFromStored(stored);
  const dark = darkEnabledFromStored(stored);

  if (!enabled) {
    unwrapFacetTiles(document);
  }

  inject(document, enabled);
  applyTheme(document, enabled, dark);

  if (enabled) {
    requestAnimationFrame(() => {
      wrapFacetTiles(document);
    });
  }
}

chrome.storage.local.get(
  { [STORAGE_MODERN]: true, [STORAGE_DARK]: false },
  (stored) => {
    syncPage(stored);
  }
);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') {
    return;
  }
  if (changes[STORAGE_MODERN] === undefined && changes[STORAGE_DARK] === undefined) {
    return;
  }
  chrome.storage.local.get(
    { [STORAGE_MODERN]: true, [STORAGE_DARK]: false },
    (stored) => {
      syncPage(stored);
    }
  );
});
