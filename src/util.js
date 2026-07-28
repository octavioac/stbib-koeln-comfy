'use strict';

/**
 * Gemeinsamer Namensraum. Alle Content-Script-Dateien laufen in derselben
 * isolierten Welt und teilen sich diesen globalen Eintrag.
 */
var stbib = globalThis.stbib || (globalThis.stbib = {});

stbib.util = (() => {
  const CATALOG_BASE = '/alswww2.dll/';

  /** Marker-Attribut für alle Knoten, die die Erweiterung selbst eingefügt hat. */
  const OWN_NODE_ATTR = 'data-stbib-own';

  /**
   * @param {string} tag
   * @param {{className?: string, text?: string, attrs?: Record<string, unknown>, children?: Node[]}} [options]
   */
  function el(tag, options = {}) {
    const node = document.createElement(tag);
    node.setAttribute(OWN_NODE_ATTR, '1');
    if (options.className) {
      node.className = options.className;
    }
    if (options.text != null) {
      node.textContent = String(options.text);
    }
    for (const [key, value] of Object.entries(options.attrs || {})) {
      if (value != null) {
        node.setAttribute(key, String(value));
      }
    }
    for (const child of options.children || []) {
      node.appendChild(child);
    }
    return node;
  }

  /**
   * Entfernt alle Knoten unterhalb von `root`, die auf `selector` passen.
   * Gedacht für die eigenen Bausteine der Erweiterung beim `unmount()`.
   */
  function removeOwnNodes(root, selector) {
    root.querySelectorAll(selector).forEach((node) => node.remove());
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  /** Aktueller Style des Portals (Portal3 | Mobile | …) – für Hintergrund-Abfragen. */
  function currentStyle() {
    const fromUrl = new URLSearchParams(location.search).get('Style');
    if (fromUrl) {
      return fromUrl;
    }
    const meta = document.querySelector('meta[name="ZonesRef"]');
    const fromMeta = meta && /Style=([^&"]+)/.exec(meta.getAttribute('content') || '');
    return (fromMeta && fromMeta[1]) || 'Portal3';
  }

  /** Permalink-URL eines Titels – funktioniert ohne Session. */
  function noticeUrl(recordId) {
    const params = new URLSearchParams({
      fn: 'ViewNotice',
      Style: currentStyle(),
      q: recordId,
    });
    return `${CATALOG_BASE}APS_ZONES?${params.toString()}`;
  }

  /** Holt eine Katalogseite und liefert sie als geparstes Dokument (führt kein JS aus). */
  async function fetchDocument(url, { signal } = {}) {
    const response = await fetch(url, { credentials: 'same-origin', signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return new DOMParser().parseFromString(await response.text(), 'text/html');
  }

  /** Führt `worker` über alle `items` aus, aber nie mehr als `limit` gleichzeitig. */
  async function mapLimit(items, limit, worker) {
    const results = new Array(items.length);
    let cursor = 0;

    async function drain() {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        try {
          results[index] = { value: await worker(items[index], index) };
        } catch (error) {
          results[index] = { error };
        }
      }
    }

    const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, drain);
    await Promise.all(workers);
    return results;
  }

  function debounce(fn, wait) {
    let timer = 0;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  function normalizeSpace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Zerlegt die Kindknoten eines Elements an `<br>`-Grenzen.
   * Das Portal trennt mehrere Exemplare einer Zweigstelle genau so.
   *
   * Kommentarknoten werden verworfen: Die Bestandsblöcke enthalten erklärende
   * HTML-Kommentare, deren `textContent` sonst im Ergebnis landen würde.
   *
   * @returns {Node[][]} Gruppen mit mindestens einem sichtbaren Zeichen
   */
  function splitAtBreaks(element) {
    const groups = [];
    let current = [];
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === 8) {
        continue;
      }
      if (node.nodeType === 1 && node.nodeName === 'BR') {
        groups.push(current);
        current = [];
      } else {
        current.push(node);
      }
    }
    groups.push(current);
    return groups.filter((group) => group.some((node) => normalizeSpace(node.textContent)));
  }

  function nodesToText(nodes) {
    return normalizeSpace(nodes.map((node) => node.textContent || '').join(' '));
  }

  const RECORD_ID_PATTERNS = [
    /fn=MakeReservation&(?:amp;)?q=(T\d+)/i,
    /[?&](?:amp;)?no=(T\d+)/i,
    /MakeNote\(\s*'(T\d+)'/i,
  ];

  /** Titel-ID (z. B. T015197147) aus einer Trefferzeile oder einem Detailbereich. */
  function recordId(scope) {
    const html = scope.innerHTML || '';
    for (const pattern of RECORD_ID_PATTERNS) {
      const match = pattern.exec(html);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  return {
    CATALOG_BASE,
    OWN_NODE_ATTR,
    currentStyle,
    debounce,
    el,
    fetchDocument,
    mapLimit,
    nodesToText,
    normalizeSpace,
    noticeUrl,
    qsa,
    recordId,
    removeOwnNodes,
    splitAtBreaks,
  };
})();
