'use strict';

/** Schalter-ID → Storage-Key. Alle Werte sind Booleans in chrome.storage.local. */
const TOGGLES = {
  'stbib-toggle': { key: 'stbibModernEnabled', fallback: true },
  'stbib-toggle-dark': { key: 'stbibDarkMode', fallback: false },
  'stbib-toggle-holdings': { key: 'stbibHoldings', fallback: true },
  'stbib-toggle-holdings-auto': { key: 'stbibHoldingsAuto', fallback: true },
  'stbib-toggle-loadmore': { key: 'stbibLoadMore', fallback: true },
  'stbib-toggle-smartquery': { key: 'stbibSmartQuery', fallback: true },
};

const DEFAULTS = Object.fromEntries(
  Object.values(TOGGLES).map(({ key, fallback }) => [key, fallback])
);

const DARK_KEY = 'stbibDarkMode';
const MODERN_KEY = 'stbibModernEnabled';

function applyPopupChrome(dark) {
  document.body.classList.toggle('popup--dark', dark);
}

/** Die Komfort-Funktionen greifen nur bei aktivem Komfort-Design. */
function applyDependentState(modernEnabled) {
  document.body.classList.toggle('popup--modern-off', !modernEnabled);
  for (const [id, { key }] of Object.entries(TOGGLES)) {
    if (key === MODERN_KEY) {
      continue;
    }
    const input = document.getElementById(id);
    if (input) {
      input.disabled = !modernEnabled;
    }
  }
}

/** Gespeicherter Wert oder Vorgabe – `undefined` (noch nie gesetzt) nutzt die Vorgabe. */
function checkedState(stored, { key, fallback }) {
  return stored[key] ?? fallback;
}

chrome.storage.local.get(DEFAULTS, (stored) => {
  for (const [id, toggle] of Object.entries(TOGGLES)) {
    const input = document.getElementById(id);
    if (input) {
      input.checked = checkedState(stored, toggle);
    }
  }
  applyPopupChrome(stored[DARK_KEY] === true);
  applyDependentState(stored[MODERN_KEY] !== false);
});

for (const [id, { key }] of Object.entries(TOGGLES)) {
  const input = document.getElementById(id);
  if (!input) {
    continue;
  }
  input.addEventListener('change', () => {
    chrome.storage.local.set({ [key]: input.checked });
    if (key === DARK_KEY) {
      applyPopupChrome(input.checked);
    }
    if (key === MODERN_KEY) {
      applyDependentState(input.checked);
    }
  });
}

/*
 * Katalogsuche aus dem Popup: öffnet die Trefferliste in einem neuen Tab.
 * `chrome.tabs.create` braucht keine zusätzliche Berechtigung. Die
 * ISBN-Umschreibung folgt dem Schalter „ISBN-Suche erkennen“ – ein direkter
 * Link umgeht das Suchfeld, an dem query.js sonst ansetzt.
 */
const SMART_QUERY_KEY = 'stbibSmartQuery';

function openCatalog(url) {
  chrome.tabs.create({ url }, () => window.close());
}

document.getElementById('stbib-search').addEventListener('submit', (event) => {
  event.preventDefault();
  const query = document.getElementById('stbib-search-input').value;
  chrome.storage.local.get({ [SMART_QUERY_KEY]: true }, (stored) => {
    openCatalog(stbib.logic.searchUrl(query, { isbnRewrite: stored[SMART_QUERY_KEY] !== false }));
  });
});

document.getElementById('stbib-open-catalog').addEventListener('click', (event) => {
  event.preventDefault();
  openCatalog(stbib.logic.searchUrl(''));
});
