// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import "../../src/logic.js";

const logic = globalThis.stbib.logic;

/**
 * Bestand-Blöcke, wie das Portal sie in Permalink-Seiten ausliefert:
 * pro Zweigstelle `stock_header_<code>` + `stock_content_<code>`, Exemplare
 * durch <br> getrennt, Signatur und Status fett.
 */
function stockHtml() {
  return `
    <div id="stock_header_ZENT">Zentralbibliothek</div>
    <div id="stock_content_ZENT">
      Freihand/Ausleihbereich <b>21.Pb Struwe</b> B50 831 860 5 <b>Verfügbar</b><br>
      Magazin <b>Mag 47/11</b> <b>Entliehen</b>, voraussichtlich bis 08/08/2026
    </div>
    <div id="stock_header_NORD">Bibliothek Nippes</div>
    <div id="stock_content_NORD">
      Kinderbuch <b>Kd 7 Harry</b> <b>Entliehen</b>, voraussichtlich bis 12/03/2026
    </div>
    <div id="stock_header_LEER">Digitale Zweigstelle</div>
    <div id="stock_content_LEER">nur Online-Medium</div>
  `;
}

let branches;

beforeAll(() => {
  document.body.innerHTML = stockHtml();
  branches = logic.parseHoldings(document);
});

describe("parseHoldings", () => {
  it("liest Zweigstellen mit Exemplaren, überspringt leere", () => {
    expect(branches.map((branch) => branch.code)).toEqual(["ZENT", "NORD"]);
    expect(branches[0].name).toBe("Zentralbibliothek");
  });

  it("zerlegt Exemplare an <br>-Grenzen und klassifiziert Status", () => {
    const [zentral] = branches;
    expect(zentral.items).toHaveLength(2);
    expect(zentral.items[0]).toMatchObject({
      area: "Freihand/Ausleihbereich",
      signature: "21.Pb Struwe",
      status: "Verfügbar",
      kind: "available",
      dueDate: "",
    });
    expect(zentral.items[1]).toMatchObject({
      signature: "Mag 47/11",
      kind: "onloan",
      dueDate: "08.08.2026",
    });
  });

  it("formatiert Rückgabedaten um", () => {
    expect(logic.formatDate("voraussichtlich bis 12/03/2026")).toBe("12.03.2026");
    expect(logic.formatDate("kein Datum")).toBe("");
  });
});

describe("renderSummary", () => {
  it("zählt verfügbare Exemplare und nennt Zweigstellen", () => {
    const summary = logic.renderSummary(branches);
    expect(summary.kind).toBe("available");
    expect(summary.text).toBe("1 von 3 verfügbar");
    expect(summary.detail).toBe("Zentralbibliothek");
  });

  it("nennt bei komplett entliehenem Bestand das früheste Rückgabedatum", () => {
    const [nord] = branches.filter((branch) => branch.code === "NORD");
    const summary = logic.renderSummary([nord]);
    expect(summary.kind).toBe("onloan");
    expect(summary.text).toBe("Entliehen");
    expect(summary.detail).toBe("frühestens frei ab 12.03.2026");
  });

  it("meldet fehlenden Bestand", () => {
    const summary = logic.renderSummary([]);
    expect(summary.kind).toBe("none");
    expect(summary.text).toBe("");
    expect(summary.detail).toContain("Kein ausleihbarer Bestand");
  });

  it("sortiert Zweigstellen mit Bestand nach vorn", () => {
    const sorted = logic.sortBranches(branches);
    expect(sorted[0].code).toBe("ZENT"); // ein verfügbarer Titel
    expect(sorted.every((branch) => branch.code !== "LEER")).toBe(true);
  });
});
