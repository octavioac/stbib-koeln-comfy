'use strict';

const STORAGE_MODERN = 'stbibModernEnabled';
const STORAGE_DARK = 'stbibDarkMode';

const toggleModern = document.getElementById('stbib-toggle');
const toggleDark = document.getElementById('stbib-toggle-dark');

function applyPopupChrome(dark) {
  document.body.classList.toggle('popup--dark', dark);
}

chrome.storage.local.get(
  { [STORAGE_MODERN]: true, [STORAGE_DARK]: false },
  (stored) => {
    toggleModern.checked = stored[STORAGE_MODERN] !== false;
    toggleDark.checked = stored[STORAGE_DARK] === true;
    applyPopupChrome(stored[STORAGE_DARK] === true);
  }
);

toggleModern.addEventListener('change', () => {
  chrome.storage.local.set({ [STORAGE_MODERN]: toggleModern.checked });
});

toggleDark.addEventListener('change', () => {
  const dark = toggleDark.checked;
  chrome.storage.local.set({ [STORAGE_DARK]: dark });
  applyPopupChrome(dark);
});
