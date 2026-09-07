// @vitest-environment jsdom
/**
 * Das Portal drosselt `/alswww2.dll/` auf zwei gleichzeitige Abfragen. Darüber
 * kommt entweder ein 503 oder ein serverseitig abgebrochener HTTP/2-Stream,
 * der als TypeError ankommt. Beides ist vorübergehend und muss wiederholt
 * werden – ein Abbruch durch uns selbst dagegen nicht.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../src/logic.js";
import "../../src/util.js";

const util = globalThis.stbib.util;

const OK_HTML = "<html><body><div id='stock_header_A'>Zentrale</div></body></html>";

function okResponse() {
  return { ok: true, status: 200, text: async () => OK_HTML };
}

function errorResponse(status) {
  return { ok: false, status, text: async () => "" };
}

/**
 * Liefert der Reihe nach die übergebenen Ergebnisse; Fehler werden geworfen.
 * `DOMException` ist in jsdom keine `Error`-Instanz – darum beide prüfen.
 */
function fetchStub(...results) {
  const calls = [];
  globalThis.fetch = vi.fn(async (url) => {
    calls.push(url);
    const next = results.shift();
    if (next instanceof Error || next instanceof DOMException) {
      throw next;
    }
    return next;
  });
  return calls;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.fetch;
});

describe("isTransientFetchError", () => {
  it("erkennt den abgebrochenen Stream (TypeError)", () => {
    expect(util.isTransientFetchError(new TypeError("Failed to fetch"))).toBe(true);
    // Firefox formuliert anders, wirft aber ebenfalls TypeError.
    expect(
      util.isTransientFetchError(new TypeError("NetworkError when attempting to fetch resource."))
    ).toBe(true);
  });

  it("erkennt 5xx aus der Drosselung", () => {
    expect(util.isTransientFetchError(new Error("HTTP 503"))).toBe(true);
    expect(util.isTransientFetchError(new Error("HTTP 500"))).toBe(true);
  });

  it("behandelt 4xx und eigene Abbrüche nicht als vorübergehend", () => {
    expect(util.isTransientFetchError(new Error("HTTP 404"))).toBe(false);
    const abort = new DOMException("The user aborted a request.", "AbortError");
    expect(util.isTransientFetchError(abort)).toBe(false);
  });
});

describe("fetchDocumentRetrying", () => {
  it("gibt beim ersten Erfolg direkt zurück", async () => {
    const calls = fetchStub(okResponse());
    const doc = await util.fetchDocumentRetrying("/alswww2.dll/APS_ZONES?q=T1", { backoffMs: 0 });

    expect(calls).toHaveLength(1);
    expect(doc.getElementById("stock_header_A")).toBeTruthy();
  });

  it("wiederholt nach einem 503 und liefert dann das Dokument", async () => {
    const calls = fetchStub(errorResponse(503), okResponse());
    const doc = await util.fetchDocumentRetrying("/alswww2.dll/APS_ZONES?q=T1", { backoffMs: 0 });

    expect(calls).toHaveLength(2);
    expect(doc.getElementById("stock_header_A")).toBeTruthy();
  });

  it("wiederholt nach einem abgebrochenen Stream", async () => {
    const calls = fetchStub(new TypeError("Failed to fetch"), okResponse());
    const doc = await util.fetchDocumentRetrying("/alswww2.dll/APS_ZONES?q=T1", { backoffMs: 0 });

    expect(calls).toHaveLength(2);
    expect(doc.getElementById("stock_header_A")).toBeTruthy();
  });

  it("gibt nach `retries` Wiederholungen auf und wirft den letzten Fehler", async () => {
    const calls = fetchStub(
      errorResponse(503),
      errorResponse(503),
      new TypeError("Failed to fetch")
    );

    await expect(
      util.fetchDocumentRetrying("/alswww2.dll/APS_ZONES?q=T1", { retries: 2, backoffMs: 0 })
    ).rejects.toThrow("Failed to fetch");
    // Erstversuch + zwei Wiederholungen, nicht mehr.
    expect(calls).toHaveLength(3);
  });

  it("wiederholt einen 404 nicht", async () => {
    const calls = fetchStub(errorResponse(404), okResponse());

    await expect(
      util.fetchDocumentRetrying("/alswww2.dll/APS_ZONES?q=T1", { backoffMs: 0 })
    ).rejects.toThrow("HTTP 404");
    expect(calls).toHaveLength(1);
  });

  it("wiederholt einen eigenen Abbruch nicht", async () => {
    const abort = new DOMException("The user aborted a request.", "AbortError");
    const calls = fetchStub(abort, okResponse());

    await expect(
      util.fetchDocumentRetrying("/alswww2.dll/APS_ZONES?q=T1", { backoffMs: 0 })
    ).rejects.toThrow("The user aborted a request.");
    expect(calls).toHaveLength(1);
  });

  it("wartet mit steigendem Abstand", async () => {
    vi.useFakeTimers();
    try {
      fetchStub(errorResponse(503), errorResponse(503), okResponse());
      const pending = util.fetchDocumentRetrying("/x", { retries: 2, backoffMs: 100 });

      // 1. Wiederholung nach 100 ms, 2. nach 200 ms.
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);
      await expect(pending).resolves.toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
