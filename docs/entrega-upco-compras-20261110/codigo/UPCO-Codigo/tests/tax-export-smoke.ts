import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "../lib/tax/core";
import { bookRows, islrXml, ivaRows, ivaTxt, retentionRows, type JoinedDocument } from "../lib/tax/exports";

function row(id: number, period: string, half: 1 | 2, number: string, control: string): JoinedDocument {
  return {
    document: {
      id, vendorId: 1, status: "issued", type: "factura", period, half, number,
      controlNumber: control, issuedAt: `${period}-01`, eventAt: `${period}-01`,
      base16Cents: 10000, base8Cents: 0, totalCents: 11600, exemptCents: 0,
      ivaRetentionCents: 1200, ivaCertificateNumber: `${period.replace("-", "")}0000000${id}`,
      settingsSnapshot: "", affectedDocumentId: null, islrApplies: true,
      islrRetentionCents: 200, islrTaxableBaseCents: 10000, islrRate: 2,
      islrConceptCode: "055",
    },
    vendor: { rif: "J123456789", name: "Proveedor de prueba" },
  } as JoinedDocument;
}

const first = row(1, "2026-10", 1, "A1", "ZZP0001521");
const second = row(2, "2026-10", 1, "A2", "ZZP0001521");
const voided = row(4, "2026-10", 1, "A4", "ZZP0001521");
voided.document.status = "void";
assert.deepEqual(bookRows([first, voided], "2026-10", 1).map(x => x.document.id), [1]);
assert.deepEqual(ivaRows([first, voided], "2026-10", 1).map(x => x.document.id), [1]);
assert.deepEqual(retentionRows([first, voided], "2026-10", 1).map(x => x.document.id), [1]);
const txt = ivaTxt([first, second], [first, second], DEFAULT_SETTINGS, "2026-10", 1);
assert.equal(txt.trimEnd().split("\r\n").length, 2);
assert.equal(txt.trimEnd().split("\r\n")[0].split("\t").length, 16);
assert.match(islrXml([first], [first], DEFAULT_SETTINGS, "2026-10"), /<NumeroControl>ZZP0001521<\/NumeroControl>/);

const credit = row(3, "2026-10", 1, "NC1", "NC-01");
credit.document.type = "nota_credito";
credit.document.affectedDocumentId = first.document.id;
credit.document.issuedAt = "2026-10-02";
credit.document.eventAt = "2026-10-02";
credit.document.ivaRetentionCents = -1200;
assert.match(ivaTxt([first, credit], [first, credit], DEFAULT_SETTINGS, "2026-10", 1), /\t03\t/);
const crossHalf = row(5, "2026-10", 2, "NC2", "NC-02");
crossHalf.document.type = "nota_credito";
crossHalf.document.affectedDocumentId = first.document.id;
crossHalf.document.issuedAt = "2026-10-16";
crossHalf.document.eventAt = "2026-10-16";
crossHalf.document.ivaRetentionCents = -1200;
assert.throws(() => ivaTxt([crossHalf], [first, crossHalf], DEFAULT_SETTINGS, "2026-10", 2), /otra quincena/);
const crossMonth = row(6, "2026-11", 1, "NC3", "NC-03");
crossMonth.document.type = "nota_credito";
crossMonth.document.affectedDocumentId = first.document.id;
crossMonth.document.ivaRetentionCents = -1200;
assert.throws(() => ivaTxt([crossMonth], [first, crossMonth], DEFAULT_SETTINGS, "2026-11", 1), /otra quincena/);
assert.throws(() => ivaTxt([], [], DEFAULT_SETTINGS, "2026-11", 2), /sin movimientos/);
