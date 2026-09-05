'use strict';

/**
 * Feature: Facetten („Einschränken der Suche").
 *
 * Das Portal liefert pro Facette `.FacetHeader` + `.FacetsList` als Geschwister
 * in einem `.FacetBox`. Wir wrappen jedes Paar in `.stbib-facet-tile`, damit
 * CSS-Grid mehrere Akkordeons pro Zeile legen kann.
 *
 * Zusätzlich: Lange Listen (Autor, Verlag, Schlagwort liefern bis zu 50
 * Einträge) bekommen ein Filterfeld – tippen ist schneller als scrollen.
 *
 * Wichtig: Der Klick-Handler des Portals ist
 *   $('.FacetHeader').click(… $(this).toggleClass('arrow_down').next().slideToggle() …)
 * Das Filterfeld darf deshalb **nicht** zwischen Header und Liste liegen,
 * sonst animiert `next()` das Filterfeld statt der Trefferliste. Es wird
 * darum als erstes Kind *innerhalb* der `.FacetsList` eingehängt.
 *
 * `arrow_down` am Header bedeutet „zu" (Pfeil zeigt nach unten = aufklappbar).
 */
var stbib = globalThis.stbib || (globalThis.stbib = {});

stbib.facets = (() => {
  const util = stbib.util;

  const TILE_CLASS = 'stbib-facet-tile';
  const FILTER_CLASS = 'stbib-facet-filter';
  const HIDDEN_CLASS = 'stbib-facet-hidden';
  const WRAPPED_FLAG = 'stbibFacetWrapped';
  const FILTERED_FLAG = 'stbibFacetFiltered';
  const ACTIVE_FILTER_CLASS = 'stbib-active-filter';
  /** Bereits umgebaute Filter-`<b>`-Knoten → ihr RemoveClause-Link. */
  const activeFilters = new Map();
  /** Einträge offen und positioniert (Header-Knoten), für Resize & Cleanup. */
  const facetHeaderHandlers = new Map();
  let filterUndo = null;
  /** Ab so vielen Einträgen lohnt ein Filterfeld. */
  const FILTER_THRESHOLD = 10;

  function facetBoxes() {
    return util.qsa('#leftMenuContainer .FacetBox, .FacetsContainer .FacetBox');
  }

  function wrapTiles() {
    for (const box of facetBoxes()) {
      if (box.dataset[WRAPPED_FLAG] === '1') {
        continue;
      }
      for (const header of util.qsa(':scope > .FacetHeader', box)) {
        const list = header.nextElementSibling;
        if (!list || !list.classList.contains('FacetsList')) {
          continue;
        }
        const tile = util.el('div', { className: TILE_CLASS });
        box.insertBefore(tile, header);
        tile.appendChild(header);
        tile.appendChild(list);
      }
      box.dataset[WRAPPED_FLAG] = '1';
    }
  }

  function unwrapTiles() {
    for (const box of facetBoxes()) {
      if (box.dataset[WRAPPED_FLAG] !== '1') {
        continue;
      }
      for (const tile of util.qsa(`:scope > .${TILE_CLASS}`, box)) {
        const fragment = document.createDocumentFragment();
        while (tile.firstChild) {
          fragment.appendChild(tile.firstChild);
        }
        box.insertBefore(fragment, tile);
        tile.remove();
      }
      delete box.dataset[WRAPPED_FLAG];
    }
  }

  function applyFilter(list, term) {
    const needle = term.trim().toLowerCase();
    let visible = 0;

    for (const link of util.qsa('.FacetLinkA', list)) {
      const haystack = (link.textContent || '').toLowerCase();
      const match = !needle || haystack.includes(needle);
      // Über eine Klasse ausblenden, nicht per Inline-Style: components.css
      // setzt `display: block !important` auf .FacetLinkA und würde ein
      // inline gesetztes `display: none` überstimmen.
      link.classList.toggle(HIDDEN_CLASS, !match);
      if (match) {
        visible += 1;
      }
    }

    const empty = list.querySelector(`.${FILTER_CLASS}__empty`);
    if (empty) {
      empty.hidden = visible > 0;
    }
  }

  function mountFilters() {
    for (const list of util.qsa(`.${TILE_CLASS} > .FacetsList`)) {
      if (list.dataset[FILTERED_FLAG] === '1') {
        continue;
      }
      const links = util.qsa('.FacetLinkA', list);
      if (links.length < FILTER_THRESHOLD) {
        // Kurze Listen sieht man auf einen Blick.
        list.dataset[FILTERED_FLAG] = 'skip';
        continue;
      }

      const input = util.el('input', {
        className: `${FILTER_CLASS}__input`,
        attrs: {
          type: 'search',
          placeholder: `${links.length} Einträge filtern …`,
          'aria-label': 'Facettenwerte filtern',
          autocomplete: 'off',
        },
      });
      input.addEventListener('input', () => applyFilter(list, input.value));
      // Klick im Feld darf das Akkordeon nicht schließen.
      input.addEventListener('click', (event) => event.stopPropagation());

      const empty = util.el('div', {
        className: `${FILTER_CLASS}__empty`,
        text: 'Kein Treffer im Filter.',
        attrs: { hidden: 'hidden' },
      });

      const box = util.el('div', {
        className: FILTER_CLASS,
        children: [input, empty],
      });

      list.insertBefore(box, list.firstChild);
      list.dataset[FILTERED_FLAG] = '1';
    }
  }

  function unmountFilters() {
    for (const list of util.qsa('.FacetsList')) {
      for (const link of util.qsa(`.${HIDDEN_CLASS}`, list)) {
        link.classList.remove(HIDDEN_CLASS);
      }
      delete list.dataset[FILTERED_FLAG];
    }
    util.removeOwnNodes(document, `.${FILTER_CLASS}`);
  }

  function mountActiveFilters() {
    const links = util.qsa(
      '.searchStatementCell a[href*="RemoveClause"], .SearchStatementBox a[href*="RemoveClause"]'
    );
    for (const link of links) {
      const filter = link.closest('b');
      if (!filter || activeFilters.has(filter)) {
        continue;
      }

      const label = util
        .normalizeSpace(filter.textContent)
        .replace(/^(?:and|und)\s*\(\s*/i, '')
        .replace(/\s*\)$/, '');
      if (!label) {
        continue;
      }

      activeFilters.set(filter, link);
      filterUndo = filterUndo || util.reverter();
      filterUndo.setChildren(
        filter,
        util.el('span', { className: `${ACTIVE_FILTER_CLASS}__label`, text: label }),
        link
      );
      filterUndo.addClass(filter, ACTIVE_FILTER_CLASS);
      link.classList.add(`${ACTIVE_FILTER_CLASS}__remove`);
      filterUndo.setAttribute(link, 'aria-label', `Filter ${label} entfernen`);
      filterUndo.setAttribute(link, 'title', `Filter ${label} entfernen`);
    }
  }

  function unmountActiveFilters() {
    for (const link of activeFilters.values()) {
      link.classList.remove(`${ACTIVE_FILTER_CLASS}__remove`);
    }
    activeFilters.clear();
    filterUndo?.restore();
    filterUndo = null;
  }

  function positionFacetPopover(header) {
    applyFacetMeasurements([measureFacet(header)]);
  }

  /**
   * Misst einen geöffneten Facetten-Header. Getrennt vom Schreiben, damit
   * mehrere Offsets gebündelt werden können (kein Read/Write-Wechsel → kein
   * wiederholtes Layout-Forcing beim Resize).
   */
  function measureFacet(header) {
    const tile = header.closest(`.${TILE_CLASS}`);
    const list = header.nextElementSibling;
    const box = tile?.parentElement;
    if (!tile || !list?.classList.contains('FacetsList') || !box) {
      return { header, tile: null };
    }
    if (header.classList.contains('arrow_down')) {
      return { header, tile, closed: true };
    }

    const boxRect = box.getBoundingClientRect();
    const tileRect = tile.getBoundingClientRect();
    const width = Math.min(512, boxRect.width, Math.max(0, window.innerWidth - 32));
    const offset = Math.min(0, boxRect.right - tileRect.left - width);
    return { header, tile, width, offset };
  }

  function applyFacetMeasurements(measurements) {
    for (const { header, tile, closed, width, offset } of measurements) {
      if (!tile) {
        continue;
      }
      if (closed || width == null) {
        tile.style.removeProperty('--stbib-facet-popover-width');
        tile.style.removeProperty('--stbib-facet-popover-offset');
        continue;
      }
      tile.style.setProperty('--stbib-facet-popover-width', `${width}px`);
      tile.style.setProperty('--stbib-facet-popover-offset', `${offset}px`);
    }
  }

  function positionOpenFacets() {
    // Erst alle Messungen, dann alle Schreibvorgänge.
    applyFacetMeasurements(Array.from(facetHeaderHandlers.keys(), measureFacet));
  }

  function mountFacetPopovers() {
    const bindResize = facetHeaderHandlers.size === 0;
    for (const header of util.qsa(`.${TILE_CLASS} > .FacetHeader`)) {
      if (facetHeaderHandlers.has(header)) {
        positionFacetPopover(header);
        continue;
      }
      const onClick = () => {
        window.setTimeout(() => positionFacetPopover(header), 0);
      };
      header.addEventListener('click', onClick);
      facetHeaderHandlers.set(header, onClick);
      positionFacetPopover(header);
    }
    if (bindResize && facetHeaderHandlers.size > 0) {
      window.addEventListener('resize', positionOpenFacets);
    }
  }

  function unmountFacetPopovers() {
    window.removeEventListener('resize', positionOpenFacets);
    facetHeaderHandlers.forEach((handler, header) => {
      header.removeEventListener('click', handler);
      const tile = header.closest(`.${TILE_CLASS}`);
      tile?.style.removeProperty('--stbib-facet-popover-width');
      tile?.style.removeProperty('--stbib-facet-popover-offset');
    });
    facetHeaderHandlers.clear();
  }

  function mount() {
    wrapTiles();
    mountFilters();
    mountActiveFilters();
    mountFacetPopovers();
  }

  function unmount() {
    unmountFacetPopovers();
    unmountActiveFilters();
    unmountFilters();
    unwrapTiles();
  }

  return {
    name: 'facets',
    // Teil des Komfort-Designs, kein eigener Schalter.
    storageKey: null,
    mount,
    unmount,
  };
})();
