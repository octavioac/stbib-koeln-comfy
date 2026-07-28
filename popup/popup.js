'use strict';

/** Schalter-ID → Storage-Key. Alle Werte sind Booleans in chrome.storage.local. */
const TOGGLES = {
  'stbib-toggle': { key: 'stbibModernEnabled', fallback: true },
  'stbib-toggle-dark': { key: 'stbibDarkMode', fallback: false },
  'stbib-toggle-holdings': { key: 'stbibHoldings', fallback: true },
  'stbib-toggle-holdings-auto': { key: 'stbibHoldingsAuto', fallback: false },
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

chrome.storage.local.get(DEFAULTS, (stored) => {
  for (const [id, { key, fallback }] of Object.entries(TOGGLES)) {
    const input = document.getElementById(id);
    if (input) {
      input.checked = fallback ? stored[key] !== false : stored[key] === true;
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
