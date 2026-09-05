'use strict';

/**
 * Reine Logik ohne DOM-Zugriff: ISBN-Erkennung für die Suche und
 * Bestands-Parsing aus Permalink-Seiten.
 *
 * Bewusst eigenständig (ohne stbib.util und ohne `document`): Die Datei läuft
 * darum auch in Node-Tests (tests/unit) ohne Browser.
 */
var stbib = globalThis.stbib || (globalThis.stbib = {});

stbib.logic = (() => {
  // ------------------------------------------------------------- Text-Helfer

  function normalizeSpace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function nodesToText(nodes) {
    return normalizeSpace(nodes.map((node) => node.textContent || '').join(' '));
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

  // ----------------------------------------------------------- ISBN-Suche

  /** Bereits qualifizierte Suchen (au=, ti=, isbn=, …) nicht anfassen. */
  const QUALIFIED_QUERY = /^[a-z][a-z0-9]{1,12}\s*=/i;

  function stripSeparators(value) {
    return String(value || '').replace(/[\s-]/g, '');
  }

  function isbn10ChecksumOk(value) {
    let sum = 0;
    for (let i = 0; i < 9; i += 1) {
      sum += (10 - i) * Number(value[i]);
    }
    const last = value[9].toUpperCase();
    sum += last === 'X' ? 10 : Number(last);
    return sum % 11 === 0;
  }

  function isbn13ChecksumOk(value) {
    let sum = 0;
    for (let i = 0; i < 13; i += 1) {
      sum += Number(value[i]) * (i % 2 === 0 ? 1 : 3);
    }
    return sum % 10 === 0;
  }

  function isbn10To13(value) {
    const core = `978${value.slice(0, 9)}`;
    let sum = 0;
    for (let i = 0; i < 12; i += 1) {
      sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
    }
    return `${core}${(10 - (sum % 10)) % 10}`;
  }

  function isbn13To10(value) {
    if (!value.startsWith('978')) {
      return null;
    }
    const core = value.slice(3, 12);
    let sum = 0;
    for (let i = 0; i < 9; i += 1) {
      sum += (10 - i) * Number(core[i]);
    }
    const check = (11 - (sum % 11)) % 11;
    return `${core}${check === 10 ? 'X' : check}`;
  }

  /**
   * Erkennt eine ISBN und liefert alle Schreibweisen, unter denen der Katalog
   * sie führen kann (ISBN-10 und ISBN-13). Sonst `null`.
   * @returns {string[] | null}
   */
  function isbnVariants(rawQuery) {
    const compact = stripSeparators(rawQuery);

    if (/^\d{9}[\dX]$/i.test(compact) && isbn10ChecksumOk(compact)) {
      return [isbn10To13(compact), compact.toUpperCase()];
    }

    if (/^97[89]\d{10}$/.test(compact) && isbn13ChecksumOk(compact)) {
      const as10 = isbn13To10(compact);
      return as10 ? [compact, as10] : [compact];
    }

    return null;
  }

  /**
   * Baut aus einer Roheingabe die Katalog-Suchanfrage.
   * @returns {string | null} umgeschriebene Anfrage oder `null`, wenn nichts zu tun ist
   */
  function rewrite(rawQuery) {
    const trimmed = String(rawQuery || '').trim();
    if (!trimmed || QUALIFIED_QUERY.test(trimmed)) {
      return null;
    }
    const variants = isbnVariants(trimmed);
    if (!variants) {
      return null;
    }
    return variants.map((isbn) => `isbn=${isbn}`).join(' or ');
  }

  // -------------------------------------------------------------- Bestand

  const STATUS_AVAILABLE = /^verf(?:ü|ue)gbar/i;
  const STATUS_ON_LOAN = /^entliehen/i;

  /** `08/08/2026` → `08.08.2026` */
  function formatDate(raw) {
    const match = /(\d{2})\/(\d{2})\/(\d{4})/.exec(raw || '');
    return match ? `${match[1]}.${match[2]}.${match[3]}` : '';
  }

  function classifyStatus(status) {
    if (STATUS_AVAILABLE.test(status)) {
      return 'available';
    }
    if (STATUS_ON_LOAN.test(status)) {
      return 'onloan';
    }
    return 'other';
  }

  /**
   * Ein Exemplar sieht im Portal so aus:
   *   Freihand/Ausleihbereich <b>21.Pb Struwe</b> B50 831 860 5 <b>Entliehen</b>, voraussichtlich bis 08/08/2026
   * Der letzte fette Text ist der Status, der erste die Signatur.
   * @returns {Item | null}
   */
  function parseItem(nodes) {
    const bolds = nodes.filter((node) => node.nodeType === 1 && node.nodeName === 'B');
    if (!bolds.length) {
      return null;
    }

    const statusNode = bolds[bolds.length - 1];
    const status = normalizeSpace(statusNode.textContent);
    if (!status) {
      return null;
    }

    const signature = bolds.length > 1 ? normalizeSpace(bolds[0].textContent) : '';
    const area = nodesToText(nodes.slice(0, nodes.indexOf(bolds[0])));
    const tail = nodesToText(nodes.slice(nodes.indexOf(statusNode) + 1));

    return {
      area,
      signature,
      status,
      kind: classifyStatus(status),
      dueDate: formatDate(tail),
    };
  }

  /**
   * Liest die Bestandsblöcke `stock_header_<code>` / `stock_content_<code>`
   * einer Permalink-Seite.
   * @returns {Branch[]}
   */
  function parseHoldings(doc) {
    const branches = [];
    for (const header of doc.querySelectorAll('[id^="stock_header_"]')) {
      const code = header.id.slice('stock_header_'.length);
      if (!code) {
        continue;
      }
      const content = doc.getElementById(`stock_content_${code}`);
      const items = content
        ? splitAtBreaks(content).map(parseItem).filter(Boolean)
        : [];
      if (!items.length) {
        continue;
      }
      branches.push({
        code,
        name: normalizeSpace(header.textContent) || code,
        items,
      });
    }
    return branches;
  }

  function countItems(branches) {
    let total = 0;
    let available = 0;
    for (const branch of branches) {
      for (const item of branch.items) {
        total += 1;
        if (item.kind === 'available') {
          available += 1;
        }
      }
    }
    return { total, available };
  }

  function hasAvailable(branch) {
    return branch.items.some((item) => item.kind === 'available');
  }

  /** Zweigstellen mit verfügbaren Exemplaren zuerst, Reihenfolge sonst wie im Katalog. */
  function sortBranches(branches) {
    const withCopies = branches.filter(hasAvailable);
    const withoutCopies = branches.filter((branch) => !hasAvailable(branch));
    return [...withCopies, ...withoutCopies];
  }

  /** Frühestes Rückgabedatum als `TT.MM.JJJJ` – für „alles entliehen". */
  function earliestDueDate(branches) {
    const dates = branches
      .flatMap((branch) => branch.items)
      .map((item) => item.dueDate)
      .filter(Boolean)
      .map((date) => {
        const [day, month, year] = date.split('.');
        return { date, sort: `${year}${month}${day}` };
      })
      .sort((a, b) => a.sort.localeCompare(b.sort));
    return dates.length ? dates[0].date : '';
  }

  function renderSummary(branches) {
    const { total, available } = countItems(branches);

    if (!total) {
      return {
        kind: 'none',
        text: '',
        detail: 'Kein ausleihbarer Bestand hinterlegt – z. B. ein digitales Medium.',
      };
    }

    if (available) {
      const branchNames = sortBranches(branches).filter(hasAvailable).map((branch) => branch.name);
      const shown = branchNames.slice(0, 3).join(', ');
      const rest = branchNames.length > 3 ? ` +${branchNames.length - 3} weitere` : '';
      return {
        kind: 'available',
        text: total === 1 ? 'Verfügbar' : `${available} von ${total} verfügbar`,
        detail: `${shown}${rest}`,
      };
    }

    const due = earliestDueDate(branches);
    return {
      kind: 'onloan',
      text: total === 1 ? 'Entliehen' : `Alle ${total} Exemplare entliehen`,
      detail: due ? `frühestens frei ab ${due}` : '',
    };
  }

  return {
    QUALIFIED_QUERY,
    normalizeSpace,
    nodesToText,
    splitAtBreaks,
    stripSeparators,
    isbn10ChecksumOk,
    isbn13ChecksumOk,
    isbn10To13,
    isbn13To10,
    isbnVariants,
    rewrite,
    formatDate,
    classifyStatus,
    parseItem,
    parseHoldings,
    countItems,
    hasAvailable,
    sortBranches,
    earliestDueDate,
    renderSummary,
  };
})();
