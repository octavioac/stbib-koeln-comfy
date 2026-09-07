'use strict';

/**
 * Feature: Bestand direkt in der Trefferliste.
 *
 * Die Trefferliste des Portals zeigt nur Titel, Verfasser, Signatur, Jahr,
 * Auflage, Sprache und Verlag – kein Wort dazu, ob und wo ein Titel ausleihbar
 * ist. Dafür muss man jeden Treffer einzeln öffnen und wieder zurücknavigieren.
 *
 * Der Permalink eines Titels (`fn=ViewNotice&q=<ID>`) liefert den vollständigen
 * Bestand aller Zweigstellen bereits im HTML – ohne Session, gleiche Origin.
 * Wir holen ihn per `fetch`, lesen ihn aus und zeigen ihn in der Zeile an.
 */
var stbib = globalThis.stbib || (globalThis.stbib = {});

stbib.holdings = (() => {
  const util = stbib.util;
  const logic = stbib.logic;

  const ROOT_CLASS = 'stbib-holdings';
  const TOOLBAR_CLASS = 'stbib-toolbar';
  const ROW_FLAG = 'stbibHoldings';
  const DATA_CELL_SELECTOR = '[class*="SummaryDataCell"]';
  const MAX_PARALLEL = 4;
  /** Auto-Laden läuft gedrosselt: Das Portal antwortet auf Bursts mit 503. */
  const AUTO_STAGGER_MS = 250;

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Auto-Laden: höchstens MAX_PARALLEL Abfragen gleichzeitig, deren Start um
   * AUTO_STAGGER_MS auseinandergezogen.
   *
   * Beides ist nötig. Der Stagger allein genügt nicht: Nach „Mehr laden“
   * enthält `roots` alle neuen Zeilen, und ohne Deckel wären das bei mehreren
   * hundert Treffern ebenso viele offene Abfragen. Umgekehrt genügt der Deckel
   * allein nicht, weil die ersten MAX_PARALLEL sonst gleichzeitig losgehen –
   * genau solche Bursts beantwortet das Portal mit 503. Ab dem
   * MAX_PARALLEL-ten Eintrag sorgt die Laufzeit der Vorgänger für den Abstand.
   */
  function loadAllStaggered(roots) {
    void util.mapLimit(roots, MAX_PARALLEL, async (root, index) => {
      if (index < MAX_PARALLEL) {
        await delay(index * AUTO_STAGGER_MS);
      }
      await reveal(root, { expand: false });
    });
  }

  /** @type {Map<string, Promise<Branch[]>>} recordId → Bestand (dedupliziert parallele Abfragen) */
  const cache = new Map();

  let autoLoad = false;

  /**
   * @typedef {{area: string, signature: string, status: string, kind: 'available'|'onloan'|'other', dueDate: string}} Item
   * @typedef {{code: string, name: string, items: Item[]}} Branch
   */

  function load(recordId) {
    if (!cache.has(recordId)) {
      cache.set(
        recordId,
        util
          .fetchDocument(util.noticeUrl(recordId))
          .then(logic.parseHoldings)
          .catch((error) => {
            cache.delete(recordId);
            throw error;
          })
      );
    }
    return cache.get(recordId);
  }

  // ---------------------------------------------------------------- Rendering

  function renderItem(item, showSignature) {
    const parts = [];
    if (showSignature && item.signature) {
      parts.push(util.el('span', { className: 'stbib-item__signature', text: item.signature }));
    }

    let label = item.status;
    if (item.kind === 'onloan' && item.dueDate) {
      label = `Entliehen bis ${item.dueDate}`;
    }
    parts.push(util.el('span', { className: 'stbib-item__status', text: label }));

    if (item.area && !/^Freihand\/Ausleihbereich$/i.test(item.area)) {
      parts.push(util.el('span', { className: 'stbib-item__area', text: item.area }));
    }

    return util.el('li', {
      className: `stbib-item stbib-item--${item.kind}`,
      children: parts,
    });
  }

  function renderBranch(branch) {
    const signatures = new Set(branch.items.map((item) => item.signature).filter(Boolean));
    const sharedSignature = signatures.size === 1 ? [...signatures][0] : '';
    const available = branch.items.filter((item) => item.kind === 'available').length;

    const head = [util.el('span', { className: 'stbib-branch__name', text: branch.name })];
    // Bei einem einzigen Exemplar sagt die Statuszeile darunter schon alles.
    if (branch.items.length > 1) {
      head.push(
        util.el('span', {
          className: 'stbib-branch__count',
          text: `${available} von ${branch.items.length} verfügbar`,
        })
      );
    }

    const children = [util.el('div', { className: 'stbib-branch__head', children: head })];

    if (sharedSignature) {
      children.push(
        util.el('div', { className: 'stbib-branch__signature', text: sharedSignature })
      );
    }

    children.push(
      util.el('ul', {
        className: 'stbib-branch__items',
        children: branch.items.map((item) => renderItem(item, !sharedSignature)),
      })
    );

    return util.el('div', {
      className: 'stbib-branch',
      attrs: { 'data-stbib-available': available ? 'true' : 'false' },
      children,
    });
  }

  function renderInto(root, branches) {
    const summary = logic.renderSummary(branches);
    const summaryNode = root.querySelector(`.${ROOT_CLASS}__summary`);
    const bodyNode = root.querySelector(`.${ROOT_CLASS}__body`);

    summaryNode.textContent = '';
    summaryNode.setAttribute('data-stbib-kind', summary.kind);
    if (summary.text) {
      summaryNode.appendChild(
        util.el('span', { className: `${ROOT_CLASS}__badge`, text: summary.text })
      );
    }
    if (summary.detail) {
      summaryNode.appendChild(
        util.el('span', { className: `${ROOT_CLASS}__detail`, text: summary.detail })
      );
    }

    bodyNode.textContent = '';
    for (const branch of logic.sortBranches(branches)) {
      bodyNode.appendChild(renderBranch(branch));
    }

    root.setAttribute('data-stbib-state', branches.length ? 'done' : 'empty');
    updateToggleLabel(root);
  }

  function updateToggleLabel(root) {
    const button = root.querySelector(`.${ROOT_CLASS}__toggle`);
    const body = root.querySelector(`.${ROOT_CLASS}__body`);
    const state = root.getAttribute('data-stbib-state');

    if (state === 'loading') {
      button.textContent = 'Bestand wird geladen …';
      button.disabled = true;
      return;
    }

    button.disabled = false;

    if (state === 'error') {
      button.textContent = 'Bestand konnte nicht geladen werden – erneut versuchen';
      return;
    }
    if (state === 'empty') {
      button.textContent = 'Kein Bestand';
      button.disabled = true;
      return;
    }
    if (state === 'done') {
      const expanded = !body.hidden;
      button.textContent = expanded ? 'Bestand ausblenden' : 'Bestand je Zweigstelle';
      button.setAttribute('aria-expanded', String(expanded));
      return;
    }
    button.textContent = 'Bestand anzeigen';
    button.setAttribute('aria-expanded', 'false');
  }

  // ------------------------------------------------------------------ Ablauf

  async function reveal(root, { expand }) {
    const recordId = root.getAttribute('data-stbib-record');
    if (!recordId || root.getAttribute('data-stbib-state') === 'loading') {
      return;
    }

    root.setAttribute('data-stbib-state', 'loading');
    updateToggleLabel(root);

    try {
      const branches = await load(recordId);
      const body = root.querySelector(`.${ROOT_CLASS}__body`);
      body.hidden = !expand;
      renderInto(root, branches);
    } catch (error) {
      root.setAttribute('data-stbib-state', 'error');
      root.querySelector(`.${ROOT_CLASS}__summary`).textContent = '';
      updateToggleLabel(root);
      console.warn('[stbib] Bestand konnte nicht geladen werden:', error);
    }
  }

  function onToggle(event) {
    const root = event.currentTarget.closest(`.${ROOT_CLASS}`);
    const state = root.getAttribute('data-stbib-state');

    if (state === 'done') {
      const body = root.querySelector(`.${ROOT_CLASS}__body`);
      body.hidden = !body.hidden;
      updateToggleLabel(root);
      return;
    }
    reveal(root, { expand: true });
  }

  function buildContainer(recordId) {
    const bodyId = `stbib-holdings-${recordId}`;
    const toggle = util.el('button', {
      className: `${ROOT_CLASS}__toggle`,
      text: 'Bestand anzeigen',
      attrs: { type: 'button', 'aria-expanded': 'false', 'aria-controls': bodyId },
    });
    toggle.addEventListener('click', onToggle);

    return util.el('div', {
      className: ROOT_CLASS,
      attrs: { 'data-stbib-record': recordId, 'data-stbib-state': 'idle' },
      children: [
        toggle,
        util.el('div', { className: `${ROOT_CLASS}__summary` }),
        util.el('div', {
          className: `${ROOT_CLASS}__body`,
          attrs: { id: bodyId, hidden: 'hidden' },
        }),
      ],
    });
  }

  function resultRows() {
    return util.qsa('#BrowseList > tbody > tr, table.browseList > tbody > tr');
  }

  /** Alle noch nicht geladenen Zeilen der Trefferliste nachladen. */
  async function loadAll(button) {
    const pending = util
      .qsa(`.${ROOT_CLASS}[data-stbib-state="idle"], .${ROOT_CLASS}[data-stbib-state="error"]`);
    if (!pending.length) {
      return;
    }

    const originalLabel = button ? button.textContent : '';
    let done = 0;
    if (button) {
      button.disabled = true;
    }

    await util.mapLimit(pending, MAX_PARALLEL, async (root) => {
      await reveal(root, { expand: false });
      done += 1;
      if (button) {
        button.textContent = `Bestand wird geladen … ${done}/${pending.length}`;
      }
    });

    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }

  function mountToolbar() {
    const list = document.getElementById('BrowseList') || document.querySelector('table.browseList');
    if (!list || document.querySelector(`.${TOOLBAR_CLASS}`)) {
      return;
    }

    const button = util.el('button', {
      className: `${TOOLBAR_CLASS}__button`,
      text: 'Bestand für alle Treffer laden',
      attrs: { type: 'button' },
    });
    button.addEventListener('click', () => loadAll(button));

    const toolbar = util.el('div', {
      className: TOOLBAR_CLASS,
      children: [button],
    });
    list.parentNode.insertBefore(toolbar, list);
  }

  function mount(settings) {
    autoLoad = settings ? settings.stbibHoldingsAuto === true : autoLoad;

    const rows = resultRows();
    const fresh = [];
    for (const row of rows) {
      if (row.dataset[ROW_FLAG] === '1') {
        continue;
      }
      const cell = row.querySelector(DATA_CELL_SELECTOR);
      const recordId = util.recordId(row);
      if (!cell || !recordId) {
        continue;
      }
      row.dataset[ROW_FLAG] = '1';
      const container = buildContainer(recordId);
      cell.appendChild(container);
      fresh.push(container);
    }

    if (rows.length) {
      mountToolbar();
    }

    if (autoLoad && fresh.length) {
      loadAllStaggered(fresh);
    }
  }

  function unmount() {
    util.removeOwnNodes(document, `.${ROOT_CLASS}, .${TOOLBAR_CLASS}`);
    for (const row of resultRows()) {
      delete row.dataset[ROW_FLAG];
    }
  }

  return {
    name: 'holdings',
    storageKey: 'stbibHoldings',
    mount,
    unmount,
  };
})();
