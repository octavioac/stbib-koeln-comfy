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

  /** Ergänzt bei alten Portal-Seiten einen mobilen Viewport und gibt nur den eigenen Knoten zurück. */
  function ensureViewport() {
    if (document.querySelector('meta[name="viewport"]') || !document.head) {
      return null;
    }
    const viewport = el('meta', {
      attrs: { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    });
    document.head.appendChild(viewport);
    return viewport;
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

  /**
   * Sammelt reversible Eingriffe in Portal-Knoten und stellt den
   * ursprünglichen Zustand mit `restore()` wieder her. Jedes Modul, das
   * Portal-Knoten verändert, nutzt eine eigene Instanz; `restore()` leert die
   * Aufzeichnungen, danach darf die Instanz nicht mehr benutzt werden.
   *
   * Pro Element entweder `setText` oder `setChildren` – beides kombiniert
   * würde die Original-Kinder beim `setText` verlieren. Dasselbe gilt über
   * Elementgrenzen hinweg: Ein `setText` auf einem Vorfahren wirft beim
   * Wiederherstellen den Teilbaum weg, in dem ein `setChildren`-Element
   * hängt – dessen Kinder landen dann in einem abgehängten Knoten. Die
   * Reihenfolge in `restore()` kann das nicht auffangen; verschachtelte
   * Eingriffe gehören auf dieselbe Ebene.
   */
  function reverter() {
    /** element → Map(Attributname → ursprünglicher Wert oder `null` = fehlte) */
    const attributes = new Map();
    /** element → ursprünglicher textContent */
    const texts = new Map();
    /** element → ursprüngliche Kindknoten (leben als detached Nodes weiter) */
    const children = new Map();
    /** [element, className] in Reihenfolge des Hinzufügens */
    const classes = [];
    /** {node, parent, next} in Reihenfolge des Verschiebens */
    const placements = [];

    function setAttribute(element, name, value) {
      if (!element || element.getAttribute(name) === value) {
        return;
      }
      if (!attributes.has(element)) {
        attributes.set(element, new Map());
      }
      const map = attributes.get(element);
      if (!map.has(name)) {
        map.set(name, element.getAttribute(name));
      }
      element.setAttribute(name, value);
    }

    function setText(element, value) {
      if (!element || texts.has(element)) {
        return;
      }
      texts.set(element, element.textContent || '');
      element.textContent = value;
    }

    function setChildren(element, ...replacement) {
      if (!element || children.has(element)) {
        return;
      }
      children.set(element, Array.from(element.childNodes));
      element.replaceChildren(...replacement);
    }

    function addClass(element, className) {
      if (!element || element.classList.contains(className)) {
        return;
      }
      element.classList.add(className);
      classes.push([element, className]);
    }

    /** Verschiebt `node` direkt vor `target` und merkt die alte Position. */
    function moveBefore(node, target) {
      if (!node || !target?.parentElement) {
        return;
      }
      placements.push({ node, parent: node.parentNode, next: node.nextSibling });
      target.parentElement.insertBefore(node, target);
    }

    function restore() {
      placements.reverse().forEach(({ node, parent, next }) => {
        if (parent?.isConnected) {
          parent.insertBefore(node, next?.parentNode === parent ? next : null);
        }
      });
      placements.length = 0;

      // Vor den Kindknoten: textContent-Zurücksetzung würde bereits
      // wiederhergestellte Kinder wegwerfen.
      texts.forEach((value, element) => {
        element.textContent = value;
      });
      texts.clear();

      children.forEach((nodes, element) => {
        element.replaceChildren(...nodes);
      });
      children.clear();

      attributes.forEach((map, element) => {
        map.forEach((value, name) => {
          if (value == null) {
            element.removeAttribute(name);
          } else {
            element.setAttribute(name, value);
          }
        });
      });
      attributes.clear();

      classes.reverse().forEach(([element, className]) => element.classList.remove(className));
      classes.length = 0;
    }

    return { setAttribute, setText, setChildren, addClass, moveBefore, restore };
  }

  // Text-Helfer (normalisieren, an <br> zerlegen) leben in stbib.logic.
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
    ensureViewport,
    fetchDocument,
    mapLimit,
    nodesToText: stbib.logic.nodesToText,
    normalizeSpace: stbib.logic.normalizeSpace,
    noticeUrl,
    qsa,
    recordId,
    reverter,
    removeOwnNodes,
    splitAtBreaks: stbib.logic.splitAtBreaks,
  };
})();
